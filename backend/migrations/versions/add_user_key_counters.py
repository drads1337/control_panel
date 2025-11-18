"""Add denormalized key counters to user table

Revision ID: add_user_key_counters
Revises: add_perf_indexes_001
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_user_key_counters'
down_revision = 'add_perf_indexes_001'
branch_labels = None
depends_on = None

def upgrade():

    op.add_column('user', sa.Column('total_keys', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('user', sa.Column('active_keys', sa.Integer(), nullable=False, server_default='0'))

def downgrade():

    op.drop_column('user', 'active_keys')
    op.drop_column('user', 'total_keys')
