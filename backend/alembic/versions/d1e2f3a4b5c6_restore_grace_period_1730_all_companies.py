"""restore grace period to 17 min 30 sec for every company and recompute late

Revision ID: d1e2f3a4b5c6
Revises: c9d0e1f2a3b4
Create Date: 2026-10-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'c9d0e1f2a3b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Restore the documented check-in grace period (late after 10:17:30 AM
    # for a 10:00 AM shift) for every company's existing attendance_rules
    # row — this had drifted to 16 min via a manual admin-panel edit (which
    # only ever operates on company_id=1; a separate, pre-existing issue).
    conn.execute(sa.text(
        "UPDATE attendance_rules SET grace_period_minutes = 17, grace_period_seconds = 30"
    ))

    # Companies created after the original a7b8c9d0e1f2 migration never got
    # an attendance_rules row at all (nothing creates one automatically on
    # company creation), so they were silently falling back to the
    # hardcoded 15 min / 0 sec default in AttendanceService instead of the
    # intended 17:30 policy. Give every such company an explicit row,
    # mirroring company_id=1's other defaults.
    conn.execute(sa.text("""
        INSERT INTO attendance_rules
            (company_id, grace_period_minutes, grace_period_seconds,
             half_day_hours, full_day_hours, overtime_threshold_minutes,
             comp_off_threshold_minutes, allow_wfh, allow_on_duty)
        SELECT c.id, 17, 30, 4.00, 8.00, 30, 240, 1, 1
        FROM companies c
        LEFT JOIN attendance_rules ar ON ar.company_id = c.id
        WHERE ar.id IS NULL
    """))

    # Re-evaluate every attendance record currently marked LATE against the
    # (now-restored, wider) grace period in effect for its employee's shift
    # and company. A wider window can only ever move a record from LATE to
    # PRESENT, never the reverse, so this is safe to run unconditionally.
    # Mirrors a7b8c9d0e1f2's recompute logic. TIME columns come back from
    # raw SQL as datetime.timedelta (seconds since midnight), not
    # datetime.time.
    rows = conn.execute(sa.text("""
        SELECT a.id AS attendance_id, a.check_in_time, s.start_time,
               ar.grace_period_minutes, ar.grace_period_seconds
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        JOIN shifts s ON s.id = e.shift_id
        JOIN attendance_rules ar ON ar.company_id = e.company_id
        WHERE a.status = 'LATE' AND a.check_in_time IS NOT NULL
    """)).fetchall()

    for row in rows:
        deadline_seconds = row.start_time.total_seconds() + row.grace_period_minutes * 60 + row.grace_period_seconds
        if row.check_in_time.total_seconds() <= deadline_seconds:
            conn.execute(
                sa.text("UPDATE attendance SET status = 'PRESENT' WHERE id = :id"),
                {"id": row.attendance_id},
            )


def downgrade() -> None:
    # Not reversible — the prior grace period value(s), which companies had
    # no row at all, and which specific records were LATE before this
    # migration are not recoverable.
    pass
