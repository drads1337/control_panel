"""Merge heads for secret_key migration

Revision ID: merge_heads_secret_key
Revises: ('rls_001', 'add_project_limits_google')
Create Date: 2025-01-XX XX:XX:XX

This merge migration combines multiple head revisions to allow
the add_project_secret_key migration to be applied.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_heads_secret_key'
down_revision = ('rls_001', 'add_project_limits_google')
branch_labels = None
depends_on = None


def upgrade():
    """
    Merge migration - no changes needed.
    This just merges the revision branches.
    """
    pass


def downgrade():
    """
    Merge migration - no changes needed.
    """
    pass

