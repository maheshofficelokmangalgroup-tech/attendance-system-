"""add employee kyc, assets, emergency contact, and split address

Revision ID: db8839487ea0
Revises: 9bca50847f31
Create Date: 2026-08-08 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'db8839487ea0'
down_revision: Union[str, None] = '9bca50847f31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Employee: emergency contact + address split into permanent/present
    op.add_column('employees', sa.Column('permanent_address', sa.Text(), nullable=True))
    op.add_column('employees', sa.Column('present_address', sa.Text(), nullable=True))
    op.add_column('employees', sa.Column('emergency_contact_name', sa.String(length=200), nullable=True))
    op.add_column('employees', sa.Column('emergency_contact_phone', sa.String(length=20), nullable=True))
    op.add_column('employees', sa.Column('emergency_contact_relation', sa.String(length=100), nullable=True))

    # Best-effort carry-forward of the old single `address` field. The
    # column itself is left in place (not dropped) — nothing reads it
    # going forward, but dropping a populated production column isn't free.
    op.execute("UPDATE employees SET permanent_address = address WHERE address IS NOT NULL")

    # KYC & bank details — one-to-one with employees, kept in its own table
    # so it can be gated by a dedicated RBAC permission (admin/HR only).
    op.create_table(
        'employee_kyc',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('aadhar_number', sa.String(length=20), nullable=True),
        sa.Column('pan_number', sa.String(length=20), nullable=True),
        sa.Column('bank_account_number', sa.String(length=30), nullable=True),
        sa.Column('bank_ifsc_code', sa.String(length=15), nullable=True),
        sa.Column('bank_name', sa.String(length=150), nullable=True),
        sa.Column('education_qualification', sa.String(length=150), nullable=True),
        sa.Column('education_institution', sa.String(length=200), nullable=True),
        sa.Column('education_year', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_employee_kyc_id'), 'employee_kyc', ['id'], unique=False)
    op.create_index(op.f('ix_employee_kyc_employee_id'), 'employee_kyc', ['employee_id'], unique=True)

    # Asset assignment — one-to-many with employees
    op.create_table(
        'employee_assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('asset_name', sa.String(length=150), nullable=False),
        sa.Column('asset_type', sa.String(length=100), nullable=True),
        sa.Column('serial_number', sa.String(length=100), nullable=True),
        sa.Column('assigned_date', sa.Date(), nullable=False),
        sa.Column('return_date', sa.Date(), nullable=True),
        sa.Column('condition_notes', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('ASSIGNED', 'RETURNED', 'DAMAGED', 'LOST', name='assetstatusenum'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_employee_assets_id'), 'employee_assets', ['id'], unique=False)
    op.create_index(op.f('ix_employee_assets_employee_id'), 'employee_assets', ['employee_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_employee_assets_employee_id'), table_name='employee_assets')
    op.drop_index(op.f('ix_employee_assets_id'), table_name='employee_assets')
    op.drop_table('employee_assets')

    op.drop_index(op.f('ix_employee_kyc_employee_id'), table_name='employee_kyc')
    op.drop_index(op.f('ix_employee_kyc_id'), table_name='employee_kyc')
    op.drop_table('employee_kyc')

    op.drop_column('employees', 'emergency_contact_relation')
    op.drop_column('employees', 'emergency_contact_phone')
    op.drop_column('employees', 'emergency_contact_name')
    op.drop_column('employees', 'present_address')
    op.drop_column('employees', 'permanent_address')
