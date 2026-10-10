"""scope leave_balances to month (for COL) and re-backfill COL per month

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-10-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c9d0e1f2a3b4'
down_revision = 'b8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 0 = year-scoped (CL/SL/PL/PWL, unchanged); 1-12 = scoped to that single
    # month only (COL) — existing rows default to 0, which is correct for
    # all of them (the only COL rows so far were year-scoped from the prior
    # migration and are about to be rebuilt below).
    op.add_column('leave_balances', sa.Column('month', sa.Integer(), nullable=False, server_default='0'))
    op.drop_constraint('uq_leave_balance_employee_type_year', 'leave_balances', type_='unique')
    op.create_unique_constraint(
        'uq_leave_balance_employee_type_year_month',
        'leave_balances', ['employee_id', 'leave_type_id', 'year', 'month'],
    )

    # The previous migration backfilled COL at year granularity — redo it at
    # month granularity now that the column exists. Safe to wipe and rebuild:
    # no one has applied/used COL leave yet (the type only went live this
    # deploy), so there's no used_days to preserve.
    conn.execute(sa.text("""
        DELETE lb FROM leave_balances lb
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE lt.code = 'COL'
    """))

    rows = conn.execute(sa.text("""
        SELECT a.employee_id, YEAR(a.date) AS yr, MONTH(a.date) AS mo,
               COUNT(DISTINCT a.date) AS sunday_count, e.company_id
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        WHERE DAYOFWEEK(a.date) = 1 AND a.check_in_time IS NOT NULL
        GROUP BY a.employee_id, YEAR(a.date), MONTH(a.date), e.company_id
    """)).fetchall()

    for row in rows:
        lt_row = conn.execute(
            sa.text("SELECT id FROM leave_types WHERE company_id = :cid AND code = 'COL' LIMIT 1"),
            {"cid": row.company_id},
        ).fetchone()
        if not lt_row:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO leave_balances (employee_id, leave_type_id, year, month, total_days, used_days, balance_days) "
                "VALUES (:eid, :ltid, :yr, :mo, :total, 0, :total)"
            ),
            {"eid": row.employee_id, "ltid": lt_row.id, "yr": row.yr, "mo": row.mo, "total": row.sunday_count},
        )


def downgrade() -> None:
    # Not reversible — once COL has rows in more than one month within the
    # same year (expected in normal use), collapsing back to a year-only
    # unique constraint would conflict. The pre-migration year-level COL
    # backfill isn't recoverable either.
    pass
