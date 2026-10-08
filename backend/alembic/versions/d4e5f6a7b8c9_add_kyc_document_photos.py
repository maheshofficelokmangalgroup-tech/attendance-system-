"""add aadhar front/back and pan photo paths to employee_kyc

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('employee_kyc', sa.Column('aadhar_front_path', sa.String(255), nullable=True))
    op.add_column('employee_kyc', sa.Column('aadhar_back_path', sa.String(255), nullable=True))
    op.add_column('employee_kyc', sa.Column('pan_photo_path', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('employee_kyc', 'pan_photo_path')
    op.drop_column('employee_kyc', 'aadhar_back_path')
    op.drop_column('employee_kyc', 'aadhar_front_path')
