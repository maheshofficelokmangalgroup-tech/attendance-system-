"""add username to users

Revision ID: 9bca50847f31
Revises: 043853e78be8
Create Date: 2026-08-01 11:28:59.013169

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9bca50847f31'
down_revision: Union[str, None] = '043853e78be8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('username', sa.String(length=150), nullable=True))
    op.create_unique_constraint('uq_users_username', 'users', ['username'])
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_constraint('uq_users_username', 'users', type_='unique')
    op.drop_column('users', 'username')
