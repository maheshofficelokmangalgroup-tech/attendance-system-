"""add wfh_requests table and attendance.wfh_request_id linkage

Revision ID: c4f7e9a21b58
Revises: db8839487ea0
Create Date: 2026-09-09 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4f7e9a21b58'
down_revision: Union[str, None] = 'db8839487ea0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'wfh_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('from_date', sa.Date(), nullable=False),
        sa.Column('to_date', sa.Date(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', name='wfhstatusenum'), nullable=False),
        sa.Column('approver_id', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approver_id'], ['employees.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_wfh_requests_id'), 'wfh_requests', ['id'], unique=False)
    op.create_index(op.f('ix_wfh_requests_employee_id'), 'wfh_requests', ['employee_id'], unique=False)
    op.create_index(op.f('ix_wfh_requests_from_date'), 'wfh_requests', ['from_date'], unique=False)
    op.create_index(op.f('ix_wfh_requests_to_date'), 'wfh_requests', ['to_date'], unique=False)
    op.create_index(op.f('ix_wfh_requests_status'), 'wfh_requests', ['status'], unique=False)

    op.add_column('attendance', sa.Column('wfh_request_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_attendance_wfh_request_id'), 'attendance', ['wfh_request_id'], unique=False)
    op.create_foreign_key(
        'attendance_ibfk_wfh_request', 'attendance', 'wfh_requests',
        ['wfh_request_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('attendance_ibfk_wfh_request', 'attendance', type_='foreignkey')
    op.drop_index(op.f('ix_attendance_wfh_request_id'), table_name='attendance')
    op.drop_column('attendance', 'wfh_request_id')

    op.drop_index(op.f('ix_wfh_requests_status'), table_name='wfh_requests')
    op.drop_index(op.f('ix_wfh_requests_to_date'), table_name='wfh_requests')
    op.drop_index(op.f('ix_wfh_requests_from_date'), table_name='wfh_requests')
    op.drop_index(op.f('ix_wfh_requests_employee_id'), table_name='wfh_requests')
    op.drop_index(op.f('ix_wfh_requests_id'), table_name='wfh_requests')
    op.drop_table('wfh_requests')
