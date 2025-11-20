"""Add FeatureConfigSchema table for Feature Management

Revision ID: add_feature_config_schema
Revises: add_gin_fulltext_indexes
Create Date: 2025-01-22 12:00:00.000000

This migration creates the feature_config_schema table to support Feature Management system.
This replaces hardcoded configuration templates (fps, moba, mmo) with flexible, user-defined JSON schemas.

The table allows:
- Storing JSON Schema definitions for validating configuration structures
- Storing default configuration templates
- Product-specific or project-level schemas
- Versioning and activation/deactivation of schemas
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_feature_config_schema'
down_revision = 'add_gin_fulltext_indexes'
branch_labels = None
depends_on = None


def upgrade():
    """
    Create feature_config_schema table for Feature Management.
    """
    op.create_table(
        'feature_config_schema',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('json_schema', sa.Text(), nullable=False),
        sa.Column('default_config', sa.Text(), nullable=True),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('version', sa.String(length=32), nullable=False, server_default='1.0.0'),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['game.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['project.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['user.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name', 'project_id', name='uq_feature_schema_name_project')
    )
    
    # Create indexes for common queries
    op.create_index('ix_feature_config_schema_project_id', 'feature_config_schema', ['project_id'])
    op.create_index('ix_feature_config_schema_product_id', 'feature_config_schema', ['product_id'])
    op.create_index('ix_feature_config_schema_is_active', 'feature_config_schema', ['is_active'])


def downgrade():
    """
    Drop feature_config_schema table.
    """
    op.drop_index('ix_feature_config_schema_is_active', table_name='feature_config_schema')
    op.drop_index('ix_feature_config_schema_product_id', table_name='feature_config_schema')
    op.drop_index('ix_feature_config_schema_project_id', table_name='feature_config_schema')
    op.drop_table('feature_config_schema')

