"""set grace period to 17 min 30 sec for company 1 and recompute late attendance

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-10-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Company 1 is the only real company with employees — set its check-in
    # grace period to the requested 17 min 30 sec (late after 10:17:30 AM
    # for a 10:00 AM shift).
    conn.execute(sa.text(
        "UPDATE attendance_rules SET grace_period_minutes = 17, grace_period_seconds = 30 "
        "WHERE company_id = 1"
    ))

    # Re-evaluate every attendance record currently marked LATE against the
    # grace period now in effect for its employee's shift and company — any
    # check-in that now falls within the (extended) grace window is
    # corrected to PRESENT. Idempotent: once corrected to PRESENT a row no
    # longer matches status = 'LATE', so re-running this is a no-op for it.
    # TIME columns come back from raw SQL as datetime.timedelta (seconds
    # since midnight), not datetime.time — compared here as such.
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
    # Not reversible — the prior grace period value and which specific
    # records were LATE before this migration are not recoverable.
    pass
