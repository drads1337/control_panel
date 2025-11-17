"""Add offline authentication settings to ProjectSettings

Revision ID: add_offline_auth_001
Revises: add_connect_token_001
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

This migration adds offline authentication settings to ProjectSettings:
- offline_auth_enabled: Enable/disable offline authentication with cached tickets
- offline_ticket_expiration_hours: Expiration time for offline tickets in hours (default: 12)
- offline_ticket_max_devices: Maximum number of devices that can use offline tickets (default: 1)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_offline_auth_001'
down_revision = 'add_connect_token_001'
branch_labels = None
depends_on = None


def upgrade():
    # Add offline authentication settings columns to project_settings table
    op.add_column('project_settings', 
        sa.Column('offline_auth_enabled', sa.Boolean(), nullable=True, server_default='0')
    )
    op.add_column('project_settings',
        sa.Column('offline_ticket_expiration_hours', sa.Integer(), nullable=True, server_default='12')
    )
    op.add_column('project_settings',
        sa.Column('offline_ticket_max_devices', sa.Integer(), nullable=True, server_default='1')
    )


def downgrade():
    # Remove offline authentication settings columns from project_settings table
    op.drop_column('project_settings', 'offline_ticket_max_devices')
    op.drop_column('project_settings', 'offline_ticket_expiration_hours')
    op.drop_column('project_settings', 'offline_auth_enabled')

