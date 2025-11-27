"""add webhook_pending_task table

Revision ID: add_webhook_pending_task
Revises: add_unique_id_user
Create Date: 2025-11-27 11:42:34.000000

SECURITY: This table stores webhook tasks that failed to be queued in Celery.
It prevents blocking API workers when Celery/Redis is unavailable.
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = 'add_webhook_pending_task'
down_revision = 'add_unique_id_user'
branch_labels = None
depends_on = None


def upgrade():
    """Create webhook_pending_task table"""
    op.create_table(
        'webhook_pending_task',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('webhook_id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('event', sa.String(length=100), nullable=False),
        sa.Column('webhook_data', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('processed_at', sa.DateTime(), nullable=True),
        sa.Column('next_retry_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['webhook_id'], ['webhook.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['project.id'], ondelete='CASCADE'),
    )
    
    # Create indexes for better query performance
    op.create_index('idx_webhook_pending_task_status', 'webhook_pending_task', ['status'])
    op.create_index('idx_webhook_pending_task_webhook_id', 'webhook_pending_task', ['webhook_id'])
    op.create_index('idx_webhook_pending_task_project_id', 'webhook_pending_task', ['project_id'])
    op.create_index('idx_webhook_pending_task_next_retry_at', 'webhook_pending_task', ['next_retry_at'])


def downgrade():
    """Drop webhook_pending_task table"""
    op.drop_index('idx_webhook_pending_task_next_retry_at', table_name='webhook_pending_task')
    op.drop_index('idx_webhook_pending_task_project_id', table_name='webhook_pending_task')
    op.drop_index('idx_webhook_pending_task_webhook_id', table_name='webhook_pending_task')
    op.drop_index('idx_webhook_pending_task_status', table_name='webhook_pending_task')
    op.drop_table('webhook_pending_task')

