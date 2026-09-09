"""add late_reason to attendance

Revision ID: f1a2b3c4d5e6
Revises: c4f7e9a21b58
Create Date: 2026-09-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'c4f7e9a21b58'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('attendance', sa.Column('late_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('attendance', 'late_reason')
