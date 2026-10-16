"""regularize Rushikesh's late check-in today: 10:18 -> 10:16, LATE -> PRESENT

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-10-16 00:00:01.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # One-off correction requested directly by the admin: employee Rushikesh
    # checked in today at 10:18 (just past the 10:17:30 grace-period
    # deadline) and was marked LATE. Scoped tightly — today's date, current
    # status LATE, first_name match — so this can't touch any other
    # employee's record or any other day's record, and is a no-op if it's
    # already been corrected (or on any environment with no such employee).
    rows = conn.execute(sa.text("""
        SELECT a.id, a.employee_id, a.check_in_time, a.status
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        WHERE e.first_name = 'Rushikesh'
          AND a.date = CURDATE()
          AND a.status = 'LATE'
    """)).fetchall()

    for row in rows:
        conn.execute(sa.text("""
            UPDATE attendance
            SET check_in_time = '10:16:00',
                status = 'PRESENT',
                is_regularized = 1,
                remarks = 'Regularized by admin: check-in time corrected to 10:16 AM, late mark removed'
            WHERE id = :id
        """), {"id": row.id})

        conn.execute(sa.text("""
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_data, after_data)
            VALUES (NULL, 'attendance_regularized', 'Attendance', :id, :before, :after)
        """), {
            "id": row.id,
            "before": '{"status": "LATE", "check_in_time": "%s"}' % row.check_in_time,
            "after": '{"status": "PRESENT", "check_in_time": "10:16:00"}',
        })


def downgrade() -> None:
    # Not reversible — the original check-in time/status before this
    # specific correction are not recoverable from here.
    pass
