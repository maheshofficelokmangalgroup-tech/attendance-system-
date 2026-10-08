"""add degree_certificate_path to employee_kyc

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('employee_kyc', sa.Column('degree_certificate_path', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('employee_kyc', 'degree_certificate_path')
