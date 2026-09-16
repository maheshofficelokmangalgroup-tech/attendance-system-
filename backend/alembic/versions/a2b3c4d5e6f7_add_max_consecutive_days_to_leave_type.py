"""add max_consecutive_days to leave_types

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a2b3c4d5e6f7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('leave_types', sa.Column('max_consecutive_days', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('leave_types', 'max_consecutive_days')
