"""Add project limits google (stub migration)

Revision ID: add_project_limits_google
Revises: rls_001
Create Date: 2025-01-XX XX:XX:XX

This is a stub migration file for add_project_limits_google.
The actual migration was already applied to the database, but the file was lost.
This stub allows Alembic to recognize the revision in the database.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_project_limits_google'
down_revision = 'rls_001'
branch_labels = None
depends_on = None


def upgrade():
    """
    Stub migration - no changes needed.
    The actual migration was already applied to the database.
    """
    # This migration was already applied, so we do nothing
    pass


def downgrade():
    """
    Stub migration - no changes needed.
    """
    # This migration was already applied, so we do nothing
    pass

