"""Replace PickleType with JSON in ReferralCode model

SECURITY FIX: Replace unsafe PickleType with JSON to prevent RCE attacks.
PickleType allows arbitrary code execution if attacker gains database access.
JSON is safe and provides the same functionality for list storage.

Revision ID: replace_pickle_json
Revises: f717e2105666
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'replace_pickle_json'
down_revision = 'f717e2105666'
branch_labels = None
depends_on = None


def upgrade():
    """
    Upgrade: Replace PickleType columns with JSON.
    
    SECURITY: PickleType is unsafe and allows RCE attacks.
    JSON is safe and provides the same functionality for list storage.
    
    For PostgreSQL, we use JSONB which is more efficient than JSON.
    For other databases, JSON will be used.
    
    NOTE: Existing PickleType data will need to be manually converted.
    This migration changes the column type, but existing binary pickle data
    may need to be converted separately using a data migration script.
    """
    # Check if we're using PostgreSQL
    bind = op.get_bind()
    is_postgresql = bind.dialect.name == 'postgresql'
    
    if is_postgresql:
        # PostgreSQL: Use JSONB for better performance
        # First, we need to handle existing data carefully
        # PickleType in PostgreSQL is stored as BYTEA
        
        # Step 1: Add temporary columns with JSONB type
        op.add_column('referral_code', 
                     sa.Column('game_ids_new', postgresql.JSONB, nullable=True))
        op.add_column('referral_code', 
                     sa.Column('rbac_role_ids_new', postgresql.JSONB, nullable=True))
        
        # Step 2: For existing data, we'll set to NULL
        # NOTE: In production, you should run a separate data migration script
        # to convert existing PickleType data to JSON before running this migration
        # This migration assumes existing data is already converted or can be lost
        
        # Step 3: Drop old columns
        op.drop_column('referral_code', 'game_ids')
        op.drop_column('referral_code', 'rbac_role_ids')
        
        # Step 4: Rename new columns
        op.alter_column('referral_code', 'game_ids_new', new_column_name='game_ids')
        op.alter_column('referral_code', 'rbac_role_ids_new', new_column_name='rbac_role_ids')
    else:
        # For other databases (SQLite, MySQL), use JSON type
        # SQLite doesn't have native JSON, but SQLAlchemy handles it
        op.alter_column('referral_code', 'game_ids',
                       existing_type=sa.PickleType(),
                       type_=sa.JSON(),
                       existing_nullable=True)
        
        op.alter_column('referral_code', 'rbac_role_ids',
                       existing_type=sa.PickleType(),
                       type_=sa.JSON(),
                       existing_nullable=True)


def downgrade():
    """
    Downgrade: Convert JSON back to PickleType.
    
    WARNING: This will lose data if JSON contains structures that can't be pickled.
    This downgrade is provided for completeness but should be avoided in production.
    """
    bind = op.get_bind()
    is_postgresql = bind.dialect.name == 'postgresql'
    
    if is_postgresql:
        # PostgreSQL: Convert JSONB back to PickleType (BYTEA)
        # Step 1: Add temporary columns
        op.add_column('referral_code', 
                     sa.Column('game_ids_old', sa.LargeBinary, nullable=True))
        op.add_column('referral_code', 
                     sa.Column('rbac_role_ids_old', sa.LargeBinary, nullable=True))
        
        # Step 2: Drop JSONB columns
        op.drop_column('referral_code', 'game_ids')
        op.drop_column('referral_code', 'rbac_role_ids')
        
        # Step 3: Rename old columns
        op.alter_column('referral_code', 'game_ids_old', new_column_name='game_ids')
        op.alter_column('referral_code', 'rbac_role_ids_old', new_column_name='rbac_role_ids')
        
        # Step 4: Change to PickleType (which is stored as BYTEA in PostgreSQL)
        op.alter_column('referral_code', 'game_ids',
                       existing_type=sa.LargeBinary,
                       type_=sa.PickleType(),
                       existing_nullable=True)
        
        op.alter_column('referral_code', 'rbac_role_ids',
                       existing_type=sa.LargeBinary,
                       type_=sa.PickleType(),
                       existing_nullable=True)
    else:
        # For other databases
        op.alter_column('referral_code', 'game_ids',
                       existing_type=sa.JSON(),
                       type_=sa.PickleType(),
                       existing_nullable=True)
        
        op.alter_column('referral_code', 'rbac_role_ids',
                       existing_type=sa.JSON(),
                       type_=sa.PickleType(),
                       existing_nullable=True)

