"""Add connect_token table for secure token validation

Revision ID: add_connect_token_001
Revises: add_perf_indexes_001
Create Date: 2025-11-15 06:39:28.256243

This migration adds the connect_token table to store connect tokens in the database
with indexed lookup, preventing DoS attacks from token enumeration.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_connect_token_001'
down_revision = 'add_perf_indexes_001'
branch_labels = None
depends_on = None


def upgrade():
    # Create connect_token table for secure token validation
    op.create_table('connect_token',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('key_id', sa.Integer(), nullable=True),
        sa.Column('game_name', sa.String(length=128), nullable=True),
        sa.Column('serial', sa.String(length=128), nullable=True),
        sa.Column('is_classic', sa.Boolean(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('last_used', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['key_id'], ['key.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    
    # Create index on token field for O(1) lookup performance
    op.create_index('idx_connect_token_token', 'connect_token', ['token'], unique=False)
    
    # Additional indexes for common query patterns
    op.create_index('idx_connect_token_user_id', 'connect_token', ['user_id'], unique=False)
    op.create_index('idx_connect_token_key_id', 'connect_token', ['key_id'], unique=False)
    op.create_index('idx_connect_token_expires_at', 'connect_token', ['expires_at'], unique=False)
    op.create_index('idx_connect_token_is_classic', 'connect_token', ['is_classic'], unique=False)


def downgrade():
    # Drop indexes first
    op.drop_index('idx_connect_token_is_classic', table_name='connect_token')
    op.drop_index('idx_connect_token_expires_at', table_name='connect_token')
    op.drop_index('idx_connect_token_key_id', table_name='connect_token')
    op.drop_index('idx_connect_token_user_id', table_name='connect_token')
    op.drop_index('idx_connect_token_token', table_name='connect_token')
    
    # Drop table
    op.drop_table('connect_token')

