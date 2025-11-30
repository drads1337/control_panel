"""Add project secret_key for token generation

Revision ID: add_project_secret_key
Revises: add_envelope_encryption
Create Date: 2025-01-XX XX:XX:XX

This migration adds a per-project secret_key field to replace TOKEN_STATIC_WORD.
Each project will have a unique secret key for token generation, improving security
by isolating token salts per project.

SECURITY: If TOKEN_STATIC_WORD is compromised, only tokens for projects with
compromised secret_key are affected, not all projects.
"""
from alembic import op
import sqlalchemy as sa
import secrets


# revision identifiers, used by Alembic.
revision = 'add_project_secret_key'
down_revision = 'merge_heads_secret_key'  # Based on merged heads
branch_labels = None
depends_on = None


def upgrade():
    """
    Add secret_key column to project table and populate it for existing projects.
    
    Steps:
    1. Add secret_key column (nullable initially for migration)
    2. Generate unique secret_key for all existing projects
    3. Make secret_key non-nullable and unique
    """
    # Add secret_key column (nullable initially)
    op.add_column('project', 
                  sa.Column('secret_key', sa.String(length=64), nullable=True))
    
    # Generate unique secret_key for all existing projects
    connection = op.get_bind()
    
    # Get all projects without secret_key
    result = connection.execute(
        sa.text("SELECT id FROM project WHERE secret_key IS NULL")
    )
    
    updated_count = 0
    for row in result:
        project_id = row[0]
        # Generate a secure 32-byte (64 hex characters) secret key
        secret_key = secrets.token_hex(32)
        
        # Ensure uniqueness (retry if collision, though extremely unlikely)
        max_retries = 10
        for _ in range(max_retries):
            existing = connection.execute(
                sa.text("SELECT id FROM project WHERE secret_key = :secret_key"),
                {"secret_key": secret_key}
            ).first()
            
            if not existing:
                break
            secret_key = secrets.token_hex(32)
        else:
            # If we couldn't generate a unique key after retries, use project_id as suffix
            secret_key = secrets.token_hex(30) + f"{project_id:04d}"
        
        # Update the project
        connection.execute(
            sa.text("""
                UPDATE project 
                SET secret_key = :secret_key 
                WHERE id = :id
            """),
            {"secret_key": secret_key, "id": project_id}
        )
        updated_count += 1
    
    if updated_count > 0:
        connection.commit()
        print(f"✅ Generated secret_key for {updated_count} existing projects")
    
    # Make secret_key non-nullable and unique
    # First, ensure all projects have secret_key (should be done above, but double-check)
    connection.execute(
        sa.text("""
            UPDATE project 
            SET secret_key = :default_key 
            WHERE secret_key IS NULL
        """),
        {"default_key": secrets.token_hex(32)}
    )
    
    # Add unique constraint
    op.create_unique_constraint('uq_project_secret_key', 'project', ['secret_key'])
    
    # Make non-nullable
    op.alter_column('project', 'secret_key',
                    existing_type=sa.String(length=64),
                    nullable=False,
                    existing_nullable=True)


def downgrade():
    """
    Remove secret_key column from project table.
    
    Note: This will remove all project-specific secret keys.
    Token generation will fall back to TOKEN_STATIC_WORD.
    """
    # Remove unique constraint
    op.drop_constraint('uq_project_secret_key', 'project', type_='unique')
    
    # Remove column
    op.drop_column('project', 'secret_key')

