"""Add game_id to remote control tables

Revision ID: add_game_id_to_remote_control
Revises: add_keys_copy_see_analytics
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

This migration adds game_id to remote_category and remote_feature tables
to associate remote control sections and features with specific games.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'add_game_id_to_remote_control'
down_revision = 'add_keys_copy_see_analytics'
branch_labels = None
depends_on = None

def upgrade():
    # Get database connection
    bind = op.get_bind()
    connection = bind
    
    # Add game_id column to remote_category table
    op.add_column('remote_category', sa.Column('game_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint for game_id in remote_category
    op.create_foreign_key(
        'fk_remote_category_game_id',
        'remote_category', 'game',
        ['game_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # For existing categories, set game_id to the first game in the project
    # Check if there are categories without games
    result = connection.execute(text("""
        SELECT COUNT(*) 
        FROM remote_category rc
        WHERE rc.game_id IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM game g WHERE g.project_id = rc.project_id
        )
    """))
    categories_without_games = result.scalar()
    
    if categories_without_games > 0:
        raise Exception(
            f"Found {categories_without_games} categories in projects without games. "
            "Please create games for these projects or delete the categories before running this migration."
        )
    
    # Update categories with game_id
    connection.execute(text("""
        UPDATE remote_category rc
        SET game_id = (
            SELECT g.id 
            FROM game g 
            WHERE g.project_id = rc.project_id 
            ORDER BY g.id 
            LIMIT 1
        )
        WHERE rc.game_id IS NULL
    """))
    
    # Make game_id NOT NULL after setting values
    op.alter_column('remote_category', 'game_id', nullable=False)
    
    # Drop old unique constraint
    op.drop_constraint('uq_remote_category_name_project', 'remote_category', type_='unique')
    
    # Add new unique constraint with game_id
    op.create_unique_constraint(
        'uq_remote_category_name_project_game',
        'remote_category',
        ['name', 'project_id', 'game_id']
    )
    
    # Add game_id column to remote_feature table
    op.add_column('remote_feature', sa.Column('game_id', sa.Integer(), nullable=True))
    
    # Add foreign key constraint for game_id in remote_feature
    op.create_foreign_key(
        'fk_remote_feature_game_id',
        'remote_feature', 'game',
        ['game_id'], ['id'],
        ondelete='CASCADE'
    )
    
    # For existing features, set game_id from their category
    connection.execute(text("""
        UPDATE remote_feature rf
        SET game_id = (
            SELECT rc.game_id 
            FROM remote_category rc 
            WHERE rc.id = rf.category_id
        )
        WHERE rf.game_id IS NULL
    """))
    
    # Make game_id NOT NULL after setting values
    op.alter_column('remote_feature', 'game_id', nullable=False)
    
    # Drop old unique constraint
    op.drop_constraint('uq_remote_feature_name_project', 'remote_feature', type_='unique')
    
    # Add new unique constraint with game_id
    op.create_unique_constraint(
        'uq_remote_feature_name_project_game',
        'remote_feature',
        ['name', 'project_id', 'game_id']
    )

def downgrade():
    # Get database connection
    bind = op.get_bind()
    connection = bind
    
    # Drop new unique constraints
    op.drop_constraint('uq_remote_feature_name_project_game', 'remote_feature', type_='unique')
    op.drop_constraint('uq_remote_category_name_project_game', 'remote_category', type_='unique')
    
    # Restore old unique constraints
    op.create_unique_constraint(
        'uq_remote_feature_name_project',
        'remote_feature',
        ['name', 'project_id']
    )
    op.create_unique_constraint(
        'uq_remote_category_name_project',
        'remote_category',
        ['name', 'project_id']
    )
    
    # Drop foreign keys
    op.drop_constraint('fk_remote_feature_game_id', 'remote_feature', type_='foreignkey')
    op.drop_constraint('fk_remote_category_game_id', 'remote_category', type_='foreignkey')
    
    # Drop game_id columns
    op.drop_column('remote_feature', 'game_id')
    op.drop_column('remote_category', 'game_id')

