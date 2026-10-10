"""rename Compensatory Off (COMP) to Comp Off Leave (COL) and backfill Sunday-worked credits

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-10-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b8c9d0e1f2a3'
down_revision = 'a7b8c9d0e1f2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Reuse the existing (previously dormant, days_per_year=0) "Compensatory
    # Off" leave type instead of adding a redundant duplicate — rename it to
    # COL and correct is_paid (earning a day off for working a Sunday is
    # compensated time, not unpaid leave).
    conn.execute(sa.text(
        "UPDATE leave_types SET code = 'COL', name = 'Comp Off Leave', is_paid = 1 WHERE code = 'COMP'"
    ))

    # Backfill: credit 1 COL day per distinct Sunday an employee has an
    # actual check-in on record, per year. Idempotent — recomputes
    # total_days from source attendance data rather than incrementing.
    rows = conn.execute(sa.text("""
        SELECT a.employee_id, YEAR(a.date) AS yr, COUNT(DISTINCT a.date) AS sunday_count, e.company_id
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        WHERE DAYOFWEEK(a.date) = 1 AND a.check_in_time IS NOT NULL
        GROUP BY a.employee_id, YEAR(a.date), e.company_id
    """)).fetchall()

    for row in rows:
        lt_row = conn.execute(
            sa.text("SELECT id FROM leave_types WHERE company_id = :cid AND code = 'COL' LIMIT 1"),
            {"cid": row.company_id},
        ).fetchone()
        if not lt_row:
            continue
        leave_type_id = lt_row.id

        bal_row = conn.execute(
            sa.text(
                "SELECT id, used_days FROM leave_balances "
                "WHERE employee_id = :eid AND leave_type_id = :ltid AND year = :yr"
            ),
            {"eid": row.employee_id, "ltid": leave_type_id, "yr": row.yr},
        ).fetchone()

        if bal_row:
            new_total = row.sunday_count
            new_balance = new_total - float(bal_row.used_days)
            conn.execute(
                sa.text("UPDATE leave_balances SET total_days = :total, balance_days = :bal WHERE id = :id"),
                {"total": new_total, "bal": new_balance, "id": bal_row.id},
            )
        else:
            conn.execute(
                sa.text(
                    "INSERT INTO leave_balances (employee_id, leave_type_id, year, total_days, used_days, balance_days) "
                    "VALUES (:eid, :ltid, :yr, :total, 0, :total)"
                ),
                {"eid": row.employee_id, "ltid": leave_type_id, "yr": row.yr, "total": row.sunday_count},
            )


def downgrade() -> None:
    # Not reversible — original COMP naming/is_paid and which balances were
    # backfilled are not recoverable.
    pass
