"""Add library build hash tables for Product and Agent

Revision ID: add_library_build_hash
Revises: remove_public_key_cert
Create Date: 2025-01-11 17:50:10.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = 'add_library_build_hash'
down_revision = 'remove_public_key_cert'
branch_labels = None
depends_on = None


def upgrade():
    # Create product_library_build_hashes table
    op.create_table(
        'product_library_build_hashes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('hash_sha256', sa.String(length=64), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['user.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id', 'hash_sha256', name='uq_product_hash')
    )
    
    # Create indexes for product_library_build_hashes
    op.create_index('idx_product_library_hashes_product', 'product_library_build_hashes', ['product_id'])
    op.create_index('idx_product_library_hashes_hash', 'product_library_build_hashes', ['hash_sha256'])
    
    # Create agent_library_build_hashes table
    op.create_table(
        'agent_library_build_hashes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('hash_sha256', sa.String(length=64), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agent.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['user.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agent_id', 'hash_sha256', name='uq_agent_hash')
    )
    
    # Create indexes for agent_library_build_hashes
    op.create_index('idx_agent_library_hashes_agent', 'agent_library_build_hashes', ['agent_id'])
    op.create_index('idx_agent_library_hashes_hash', 'agent_library_build_hashes', ['hash_sha256'])
    
    # Create product_library_hash_settings table
    op.create_table(
        'product_library_hash_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('library_hash_check_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('mismatch_action', sa.String(length=20), nullable=False, server_default='block'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['product_id'], ['product.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id')
    )
    
    # Create agent_library_hash_settings table
    op.create_table(
        'agent_library_hash_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agent_id', sa.Integer(), nullable=False),
        sa.Column('library_hash_check_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('mismatch_action', sa.String(length=20), nullable=False, server_default='block'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['agent_id'], ['agent.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('agent_id')
    )


def downgrade():
    # Drop tables in reverse order
    op.drop_table('agent_library_hash_settings')
    op.drop_table('product_library_hash_settings')
    
    op.drop_index('idx_agent_library_hashes_hash', table_name='agent_library_build_hashes')
    op.drop_index('idx_agent_library_hashes_agent', table_name='agent_library_build_hashes')
    op.drop_table('agent_library_build_hashes')
    
    op.drop_index('idx_product_library_hashes_hash', table_name='product_library_build_hashes')
    op.drop_index('idx_product_library_hashes_product', table_name='product_library_build_hashes')
    op.drop_table('product_library_build_hashes')
