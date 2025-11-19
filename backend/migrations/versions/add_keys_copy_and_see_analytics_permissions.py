"""Add keys.copy and keys.see_analytics permissions

Revision ID: add_keys_copy_see_analytics
Revises: add_user_permission_table
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

This migration adds two new permissions:
- keys.copy: Copy key to clipboard
- keys.see_analytics: See analytics for keys

And assigns them to admin and seller roles for all existing projects.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime, timezone

revision = 'add_keys_copy_see_analytics'
down_revision = 'add_user_key_counters'  # Current DB revision
branch_labels = None
depends_on = None

def upgrade():
    # Get database connection
    bind = op.get_bind()
    connection = bind
    
    # Get all project IDs
    projects_result = connection.execute(text("SELECT id FROM project"))
    project_ids = [row[0] for row in projects_result]
    
    # Get all role IDs for admin and seller roles
    roles_result = connection.execute(
        text("SELECT id, name, project_id FROM role WHERE name IN ('admin', 'seller')")
    )
    roles = [(row[0], row[1], row[2]) for row in roles_result]
    
    # Create a mapping of project_id -> {role_name: role_id}
    project_roles = {}
    for role_id, role_name, project_id in roles:
        if project_id not in project_roles:
            project_roles[project_id] = {}
        project_roles[project_id][role_name] = role_id
    
    # Process each project
    for project_id in project_ids:
        # Insert keys.copy permission if it doesn't exist
        connection.execute(
            text("""
                INSERT INTO permission (project_id, name, description, resource, action, scope, created_at)
                SELECT :project_id, 'keys.copy', 'Copy key', 'keys', 'copy', 'global', :now
                WHERE NOT EXISTS (
                    SELECT 1 FROM permission 
                    WHERE project_id = :project_id AND name = 'keys.copy'
                )
            """),
            {"project_id": project_id, "now": datetime.now(timezone.utc)}
        )
        
        # Insert keys.see_analytics permission if it doesn't exist
        connection.execute(
            text("""
                INSERT INTO permission (project_id, name, description, resource, action, scope, created_at)
                SELECT :project_id, 'keys.see_analytics', 'See analytics', 'keys', 'see_analytics', 'global', :now
                WHERE NOT EXISTS (
                    SELECT 1 FROM permission 
                    WHERE project_id = :project_id AND name = 'keys.see_analytics'
                )
            """),
            {"project_id": project_id, "now": datetime.now(timezone.utc)}
        )
        
        # Get permission IDs for this project
        copy_perm_result = connection.execute(
            text("SELECT id FROM permission WHERE project_id = :project_id AND name = 'keys.copy'"),
            {"project_id": project_id}
        )
        copy_perm_id = copy_perm_result.fetchone()
        if copy_perm_id:
            copy_perm_id = copy_perm_id[0]
        else:
            continue
            
        see_analytics_perm_result = connection.execute(
            text("SELECT id FROM permission WHERE project_id = :project_id AND name = 'keys.see_analytics'"),
            {"project_id": project_id}
        )
        see_analytics_perm_id = see_analytics_perm_result.fetchone()
        if see_analytics_perm_id:
            see_analytics_perm_id = see_analytics_perm_id[0]
        else:
            continue
        
        # Assign permissions to admin and seller roles for this project
        if project_id in project_roles:
            for role_name in ['admin', 'seller']:
                if role_name in project_roles[project_id]:
                    role_id = project_roles[project_id][role_name]
                    
                    # Assign keys.copy permission
                    connection.execute(
                        text("""
                            INSERT INTO role_permission (role_id, permission_id, permission_type, created_at)
                            SELECT :role_id, :permission_id, 'allow', :now
                            WHERE NOT EXISTS (
                                SELECT 1 FROM role_permission 
                                WHERE role_id = :role_id AND permission_id = :permission_id
                            )
                        """),
                        {"role_id": role_id, "permission_id": copy_perm_id, "now": datetime.now(timezone.utc)}
                    )
                    
                    # Assign keys.see_analytics permission
                    connection.execute(
                        text("""
                            INSERT INTO role_permission (role_id, permission_id, permission_type, created_at)
                            SELECT :role_id, :permission_id, 'allow', :now
                            WHERE NOT EXISTS (
                                SELECT 1 FROM role_permission 
                                WHERE role_id = :role_id AND permission_id = :permission_id
                            )
                        """),
                        {"role_id": role_id, "permission_id": see_analytics_perm_id, "now": datetime.now(timezone.utc)}
                    )

def downgrade():
    # Get database connection
    bind = op.get_bind()
    connection = bind
    
    # Remove role_permission assignments
    connection.execute(
        text("""
            DELETE FROM role_permission 
            WHERE permission_id IN (
                SELECT id FROM permission WHERE name IN ('keys.copy', 'keys.see_analytics')
            )
        """)
    )
    
    # Remove permissions
    connection.execute(
        text("DELETE FROM permission WHERE name IN ('keys.copy', 'keys.see_analytics')")
    )

