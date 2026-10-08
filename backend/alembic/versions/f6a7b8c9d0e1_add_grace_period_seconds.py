"""add grace_period_seconds to attendance_rules

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('attendance_rules', sa.Column('grace_period_seconds', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('attendance_rules', 'grace_period_seconds')
