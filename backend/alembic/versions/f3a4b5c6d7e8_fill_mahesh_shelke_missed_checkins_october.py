"""fill in Mahesh Shelke's missed check-in/check-out (internet outage): 3, 12, 16, 24 Oct

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-10-27 00:00:00.000000

"""
import json
from datetime import time, timedelta

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None

# One-off correction requested directly by the admin: employee Mahesh Shelke
# couldn't mark these from the app because of an internet problem.
# date -> (check_in, check_out). check_in None = only the check-out was
# missed; the check-in already on record is kept as-is.
CORRECTIONS = {
    '2026-10-03': (None, '18:11:00'),
    '2026-10-12': (None, '18:06:00'),
    '2026-10-16': ('10:05:00', '18:10:00'),
    '2026-10-24': (None, '18:10:00'),
}


def _seconds(value) -> float:
    # TIME columns come back from raw SQL as datetime.timedelta on MySQL.
    if isinstance(value, timedelta):
        return value.total_seconds()
    if isinstance(value, time):
        return value.hour * 3600 + value.minute * 60 + value.second
    h, m, s = str(value).split('.')[0].split(':')
    return int(h) * 3600 + int(m) * 60 + int(s)


def _hms(value) -> str:
    secs = int(_seconds(value))
    return '%02d:%02d:%02d' % (secs // 3600, secs % 3600 // 60, secs % 60)


def upgrade() -> None:
    conn = op.get_bind()

    # Scoped to exactly one employee by full name — a no-op on any
    # environment with no (or more than one) such employee.
    employees = conn.execute(sa.text("""
        SELECT e.id, e.company_id, s.start_time, s.half_day_hours,
               ar.grace_period_minutes, ar.grace_period_seconds
        FROM employees e
        LEFT JOIN shifts s ON s.id = e.shift_id
        LEFT JOIN attendance_rules ar ON ar.company_id = e.company_id
        WHERE e.first_name = 'Mahesh' AND e.last_name = 'Shelke'
    """)).fetchall()
    if len(employees) != 1:
        print(f"Mahesh Shelke correction: {len(employees)} matching employees, skipping")
        return
    emp = employees[0]
    half_day_hours = float(emp.half_day_hours) if emp.half_day_hours is not None else 4.0

    for work_date, (new_check_in, check_out) in CORRECTIONS.items():
        row = conn.execute(sa.text("""
            SELECT id, check_in_time, check_out_time, status, leave_id
            FROM attendance
            WHERE employee_id = :emp_id AND date = :d
        """), {"emp_id": emp.id, "d": work_date}).fetchone()

        # Never overwrite a time that's already recorded, and leave leave days alone.
        if row and (row.check_out_time is not None or row.leave_id is not None):
            print(f"{work_date}: already has a check-out or is a leave day, skipping")
            continue

        if row and row.check_in_time is not None:
            check_in = _hms(row.check_in_time)
            status = row.status
        elif new_check_in:
            check_in = new_check_in
            # Same rule as AttendanceService._compute_check_in_status.
            holiday = conn.execute(sa.text(
                "SELECT id FROM holidays WHERE company_id = :c AND date = :d"
            ), {"c": emp.company_id, "d": work_date}).fetchone()
            if holiday:
                status = 'HOLIDAY'
            elif emp.start_time is None:
                status = 'PRESENT'
            else:
                grace_mins = emp.grace_period_minutes if emp.grace_period_minutes is not None else 15
                grace_secs = emp.grace_period_seconds if emp.grace_period_seconds is not None else 0
                deadline = _seconds(emp.start_time) + grace_mins * 60 + grace_secs
                status = 'LATE' if _seconds(check_in) > deadline else 'PRESENT'
        else:
            print(f"{work_date}: no check-in on record to add a check-out to, skipping")
            continue

        working_hours = round(max(0.0, (_seconds(check_out) - _seconds(check_in)) / 3600.0), 2)
        # Same rule as AttendanceService.process_check_out.
        if working_hours < half_day_hours and status not in ('LATE', 'WFH', 'ON_DUTY'):
            status = 'HALF_DAY'

        if new_check_in and not (row and row.check_in_time is not None):
            remarks = 'Regularized by admin: check-in and check-out added (missed due to internet problem)'
        else:
            remarks = 'Regularized by admin: check-out added (missed due to internet problem)'

        values = {
            "check_in": check_in, "check_out": check_out, "hours": working_hours,
            "status": status, "remarks": remarks,
        }
        if row:
            conn.execute(sa.text("""
                UPDATE attendance
                SET check_in_time = :check_in, check_out_time = :check_out,
                    working_hours = :hours, status = :status,
                    is_regularized = 1, remarks = :remarks
                WHERE id = :id
            """), {**values, "id": row.id})
            attendance_id = row.id
            before = {
                "status": row.status,
                "check_in_time": _hms(row.check_in_time) if row.check_in_time is not None else None,
                "check_out_time": None,
            }
        else:
            conn.execute(sa.text("""
                INSERT INTO attendance
                    (employee_id, date, check_in_time, check_out_time,
                     working_hours, status, is_regularized, remarks)
                VALUES (:emp_id, :d, :check_in, :check_out, :hours, :status, 1, :remarks)
            """), {**values, "emp_id": emp.id, "d": work_date})
            attendance_id = conn.execute(sa.text(
                "SELECT id FROM attendance WHERE employee_id = :emp_id AND date = :d"
            ), {"emp_id": emp.id, "d": work_date}).scalar()
            before = None

        conn.execute(sa.text("""
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_data, after_data)
            VALUES (NULL, 'attendance_regularized', 'Attendance', :id, :before, :after)
        """), {
            "id": attendance_id,
            "before": json.dumps(before) if before else None,
            "after": json.dumps({
                "status": status, "check_in_time": check_in,
                "check_out_time": check_out, "working_hours": working_hours,
            }),
        })
        print(f"{work_date}: {check_in} -> {check_out} ({working_hours}h, {status})")


def downgrade() -> None:
    # Not reversible — the before-state of each record is kept in audit_logs.
    pass
