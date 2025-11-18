"""Remove offline_ticket_max_devices from ProjectSettings

Revision ID: remove_offline_max_devices_001
Revises: add_offline_auth_001
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

This migration removes offline_ticket_max_devices field from ProjectSettings.
Max devices is now determined by key.max_devices, not by project settings.
"""
from alembic import op
import sqlalchemy as sa

revision = 'remove_offline_max_devices_001'
down_revision = 'add_offline_auth_001'
branch_labels = None
depends_on = None

def upgrade():

    op.drop_column('project_settings', 'offline_ticket_max_devices')

def downgrade():

    op.add_column('project_settings',
        sa.Column('offline_ticket_max_devices', sa.Integer(), nullable=True, server_default='1')
    )
