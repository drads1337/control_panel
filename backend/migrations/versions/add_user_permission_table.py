"""Add user_permission table for individual user permissions

Revision ID: add_user_permission_table
Revises: add_user_key_counters
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'add_user_permission_table'
down_revision = 'add_project_counters'
branch_labels = None
depends_on = None

def upgrade():

    op.create_table(
        'user_permission',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.Column('permission_type', sa.String(length=10), nullable=False, server_default='allow'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_id'], ['permission.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_user_permission_user_id', 'user_permission', ['user_id'])
    op.create_index('ix_user_permission_permission_id', 'user_permission', ['permission_id'])
    op.create_index('ix_user_permission_user_permission', 'user_permission', ['user_id', 'permission_id'], unique=True)

def downgrade():

    op.drop_index('ix_user_permission_user_permission', table_name='user_permission')
    op.drop_index('ix_user_permission_permission_id', table_name='user_permission')
    op.drop_index('ix_user_permission_user_id', table_name='user_permission')
    op.drop_table('user_permission')
