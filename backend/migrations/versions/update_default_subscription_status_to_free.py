"""Update default subscription status to free

Revision ID: update_subscription_to_free
Revises: partition_user_activity
Create Date: 2025-01-XX XX:XX:XX

This migration updates the default subscription_status from 'trial' to 'free'
and migrates existing projects with 'trial' status to 'free' status.

Changes:
1. Update default value in database schema (via ALTER COLUMN)
2. Migrate existing projects with 'trial' status to 'free' status
3. Set storage_limit to 500 MB for free tier projects
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'update_subscription_to_free'
down_revision = 'partition_user_activity'
branch_labels = None
depends_on = None


def upgrade():
    """
    Update subscription_status default to 'free' and migrate existing projects.
    
    Steps:
    1. Update existing projects with 'trial' status to 'free'
    2. Set storage_limit to 500 MB for free tier projects
    3. Update default value in schema (if supported by database)
    """
    connection = op.get_bind()
    
    # Step 1: Update existing projects with 'trial' status to 'free'
    result = connection.execute(
        text("""
            UPDATE project 
            SET subscription_status = 'free'
            WHERE subscription_status = 'trial' OR subscription_status IS NULL
        """)
    )
    updated_count = result.rowcount
    
    if updated_count > 0:
        print(f"✅ Updated {updated_count} projects from 'trial' to 'free' status")
    
    # Step 2: Set storage_limit to 500 MB for free tier projects
    # 500 MB = 500 * 1024 * 1024 bytes = 524288000 bytes
    free_tier_storage_bytes = 500 * (1024 ** 2)
    
    result = connection.execute(
        text("""
            UPDATE project 
            SET storage_limit = :storage_limit
            WHERE subscription_status = 'free' 
            AND (storage_limit IS NULL OR storage_limit > :storage_limit)
        """),
        {"storage_limit": free_tier_storage_bytes}
    )
    updated_storage_count = result.rowcount
    
    if updated_storage_count > 0:
        print(f"✅ Updated storage_limit for {updated_storage_count} free tier projects to 500 MB")
    
    # Step 3: Update default value in schema
    # Note: Some databases don't support changing default values directly
    # This is handled by the model definition, but we can try to update it
    try:
        # For PostgreSQL
        connection.execute(
            text("""
                ALTER TABLE project 
                ALTER COLUMN subscription_status SET DEFAULT 'free'
            """)
        )
        print("✅ Updated default value for subscription_status to 'free'")
    except Exception as e:
        # If altering default fails, it's not critical - the model default will handle it
        print(f"⚠️  Could not update default value in schema (this is OK): {e}")
    
    connection.commit()


def downgrade():
    """
    Revert subscription_status changes.
    
    Note: This will change 'free' projects back to 'trial', but cannot
    restore original storage_limit values.
    """
    connection = op.get_bind()
    
    # Revert 'free' projects back to 'trial'
    result = connection.execute(
        text("""
            UPDATE project 
            SET subscription_status = 'trial'
            WHERE subscription_status = 'free'
        """)
    )
    reverted_count = result.rowcount
    
    if reverted_count > 0:
        print(f"✅ Reverted {reverted_count} projects from 'free' back to 'trial' status")
    
    # Try to revert default value (if supported)
    try:
        connection.execute(
            text("""
                ALTER TABLE project 
                ALTER COLUMN subscription_status SET DEFAULT 'trial'
            """)
        )
        print("✅ Reverted default value for subscription_status to 'trial'")
    except Exception as e:
        print(f"⚠️  Could not revert default value in schema: {e}")
    
    connection.commit()

