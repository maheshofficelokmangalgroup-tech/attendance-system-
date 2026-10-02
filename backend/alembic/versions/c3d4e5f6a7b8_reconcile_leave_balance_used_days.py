"""reconcile leave_balances.used_days from leave records

Revision ID: c3d4e5f6a7b8
Revises: a2b3c4d5e6f7
Create Date: 2026-10-02 00:00:00.000000

Balance used to be deducted only at final approval; it is now reserved
the moment an employee applies (see leave_service.apply_leave()). Any
leave that was already PENDING or FIRST_APPROVED before that change
never had its balance reserved, so approving it today would silently
skip the deduction.

This recomputes used_days/balance_days directly from the leaves table
instead of incrementing a counter, which makes it idempotent and
correct regardless of which environment or prior state it runs
against: used_days for (employee, leave_type, year) is defined as the
sum of total_days across every leave currently holding balance
(pending, first-level approved, or fully approved) — rejected and
cancelled leaves never hold balance.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    rows = conn.execute(sa.text("""
        SELECT employee_id, leave_type_id, YEAR(from_date) AS yr, SUM(total_days) AS used
        FROM leaves
        WHERE status IN ('PENDING', 'FIRST_APPROVED', 'APPROVED')
        GROUP BY employee_id, leave_type_id, YEAR(from_date)
    """)).fetchall()

    for employee_id, leave_type_id, year, used in rows:
        used = float(used or 0)

        existing = conn.execute(
            sa.text("""
                SELECT id, total_days FROM leave_balances
                WHERE employee_id = :eid AND leave_type_id = :ltid AND year = :yr
            """),
            {"eid": employee_id, "ltid": leave_type_id, "yr": year},
        ).fetchone()

        if existing:
            bal_id, total_days = existing
            total_days = float(total_days or 0)
            new_balance = max(0.0, total_days - used)
            conn.execute(
                sa.text("UPDATE leave_balances SET used_days = :used, balance_days = :bal WHERE id = :id"),
                {"used": used, "bal": new_balance, "id": bal_id},
            )
        else:
            lt_row = conn.execute(
                sa.text("SELECT days_per_year FROM leave_types WHERE id = :id"),
                {"id": leave_type_id},
            ).fetchone()
            total_days = float(lt_row[0]) if lt_row else 0.0
            new_balance = max(0.0, total_days - used)
            conn.execute(
                sa.text("""
                    INSERT INTO leave_balances
                        (employee_id, leave_type_id, year, total_days, used_days, balance_days, updated_at)
                    VALUES
                        (:eid, :ltid, :yr, :total, :used, :bal, NOW())
                """),
                {"eid": employee_id, "ltid": leave_type_id, "yr": year, "total": total_days, "used": used, "bal": new_balance},
            )


def downgrade() -> None:
    # Data reconciliation only — not meaningfully reversible.
    pass
