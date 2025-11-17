"""Add denormalized statistics counters to project table

Revision ID: add_project_counters
Revises: add_fulltext_search_001
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

This migration adds denormalized statistics fields to the project table
to avoid expensive JOIN queries with subqueries in get_projects_cached.
These counters are updated automatically when resources are created/deleted/updated.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_project_counters'
down_revision = 'add_fulltext_search_001'
branch_labels = None
depends_on = None


def upgrade():
    # Add denormalized statistics fields to project table
    # These fields store cached counts to avoid expensive JOIN queries
    op.add_column('project', sa.Column('total_users', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('project', sa.Column('total_keys', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('project', sa.Column('total_games', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('project', sa.Column('total_servers', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('project', sa.Column('active_users', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('project', sa.Column('active_keys', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    # Remove denormalized statistics fields
    op.drop_column('project', 'active_keys')
    op.drop_column('project', 'active_users')
    op.drop_column('project', 'total_servers')
    op.drop_column('project', 'total_games')
    op.drop_column('project', 'total_keys')
    op.drop_column('project', 'total_users')

