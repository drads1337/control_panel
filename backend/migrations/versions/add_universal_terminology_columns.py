"""Add universal terminology columns for B2B/SaaS compatibility

Revision ID: add_universal_terminology
Revises: add_feature_config_schema
Create Date: 2025-01-22 15:00:00.000000

This migration adds new columns with universal terminology (Product, Agent, DeviceFingerprint)
alongside existing gaming-specific columns (Game, Loader, HWID) for B2B/SaaS compatibility.

The migration:
1. Adds product_id columns alongside game_id columns (where applicable)
2. Adds device_fingerprint column alongside hwid column
3. Syncs data from old columns to new columns
4. Creates triggers to keep columns in sync
5. Creates indexes on new columns

This allows the system to use universal terminology while maintaining backward compatibility.
Old columns remain for existing code, new columns are available for new code.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'add_universal_terminology'
down_revision = 'add_feature_config_schema'
branch_labels = None
depends_on = None


def upgrade():
    """
    Add universal terminology columns and sync data.
    """
    connection = op.get_bind()
    
    # 1. Add device_fingerprint column to blockedhwid table (alongside hwid)
    # Check if column already exists
    try:
        result = connection.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'blockedhwid' AND column_name = 'device_fingerprint'
        """))
        
        if result.fetchone() is None:
        op.add_column('blockedhwid', 
            sa.Column('device_fingerprint', sa.String(256), nullable=True)
        )
        
        # Sync data from hwid to device_fingerprint
        connection.execute(text("""
            UPDATE blockedhwid 
            SET device_fingerprint = hwid 
            WHERE device_fingerprint IS NULL
        """))
        
        # Create index on device_fingerprint
        op.create_index(
            'ix_blockedhwid_device_fingerprint',
            'blockedhwid',
            ['device_fingerprint']
        )
        
        # Create unique constraint on device_fingerprint + project_id (if it doesn't exist)
        # Note: We keep the old constraint on hwid for backward compatibility
        try:
                op.create_unique_constraint(
                    'uq_blockedhwid_device_fingerprint_project',
                    'blockedhwid',
                    ['device_fingerprint', 'project_id']
                )
            except Exception:
                # Constraint might already exist, ignore
                pass
    except Exception as e:
        # Table might not exist or other error, skip
        print(f"Warning: Could not add device_fingerprint to blockedhwid: {e}")
        pass
    
    # 2. Add product_id columns to tables that have game_id
    # We'll add product_id as a computed column or regular column that syncs with game_id
    
    # For gamechatsettings table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gamechatsettings' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('gamechatsettings',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        # Sync data
        connection.execute(text("""
            UPDATE gamechatsettings 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        # Add foreign key
        op.create_foreign_key(
            'fk_gamechatsettings_product_id',
            'gamechatsettings',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
        # Create unique constraint
        try:
            op.create_unique_constraint(
                'uq_gamechatsettings_product_id',
                'gamechatsettings',
                ['product_id']
            )
        except Exception:
            pass
    
    # For gamestatus table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gamestatus' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('gamestatus',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE gamestatus 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_gamestatus_product_id',
            'gamestatus',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # For gameconfiguration (RemoteConfig) table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gameconfiguration' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('gameconfiguration',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE gameconfiguration 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_gameconfiguration_product_id',
            'gameconfiguration',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
        try:
            op.create_unique_constraint(
                'uq_gameconfiguration_product_id',
                'gameconfiguration',
                ['product_id']
            )
        except Exception:
            pass
    
    # For gameinvitecode table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gameinvitecode' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('gameinvitecode',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE gameinvitecode 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_gameinvitecode_product_id',
            'gameinvitecode',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # For gamesecuritylog table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gamesecuritylog' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('gamesecuritylog',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE gamesecuritylog 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_gamesecuritylog_product_id',
            'gamesecuritylog',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # For gamekeyprice table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gamekeyprice' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('gamekeyprice',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE gamekeyprice 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_gamekeyprice_product_id',
            'gamekeyprice',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
        try:
            op.create_unique_constraint(
                'uq_gamekeyprice_product_period',
                'gamekeyprice',
                ['product_id', 'period']
            )
        except Exception:
            pass
    
    # For gamefileconfig table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gamefileconfig' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('gamefileconfig',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE gamefileconfig 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_gamefileconfig_product_id',
            'gamefileconfig',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # For gameextrafile table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gameextrafile' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('gameextrafile',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE gameextrafile 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_gameextrafile_product_id',
            'gameextrafile',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # For changelog_entry table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'changelog_entry' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('changelog_entry',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE changelog_entry 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_changelog_entry_product_id',
            'changelog_entry',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # For announcement table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'announcement' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('announcement',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE announcement 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_announcement_product_id',
            'announcement',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # For file_meta table
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'file_meta' AND column_name = 'product_id'
    """))
    if result.fetchone() is None:
        op.add_column('file_meta',
            sa.Column('product_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE file_meta 
            SET product_id = game_id 
            WHERE product_id IS NULL
        """))
        op.create_foreign_key(
            'fk_file_meta_product_id',
            'file_meta',
            'game',
            ['product_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # For feature_config_schema table (already has product_id, but ensure it's synced)
    result = connection.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'feature_config_schema' AND column_name = 'game_id'
    """))
    if result.fetchone() is None:
        # Add game_id as alias column if it doesn't exist
        op.add_column('feature_config_schema',
            sa.Column('game_id', sa.Integer(), nullable=True)
        )
        connection.execute(text("""
            UPDATE feature_config_schema 
            SET game_id = product_id 
            WHERE game_id IS NULL
        """))
        op.create_foreign_key(
            'fk_feature_config_schema_game_id',
            'feature_config_schema',
            'game',
            ['game_id'],
            ['id'],
            ondelete='CASCADE'
        )
    
    # Create triggers to keep columns in sync
    # Trigger for blockedhwid: sync hwid <-> device_fingerprint
    connection.execute(text("""
        CREATE OR REPLACE FUNCTION sync_blockedhwid_columns()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
                IF NEW.hwid IS NOT NULL AND NEW.device_fingerprint IS NULL THEN
                    NEW.device_fingerprint := NEW.hwid;
                ELSIF NEW.device_fingerprint IS NOT NULL AND NEW.hwid IS NULL THEN
                    NEW.hwid := NEW.device_fingerprint;
                END IF;
                RETURN NEW;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """))
    
    # Check if trigger already exists
    result = connection.execute(text("""
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE trigger_name = 'trg_sync_blockedhwid_columns'
    """))
    if result.fetchone() is None:
        connection.execute(text("""
            CREATE TRIGGER trg_sync_blockedhwid_columns
            BEFORE INSERT OR UPDATE ON blockedhwid
            FOR EACH ROW
            EXECUTE FUNCTION sync_blockedhwid_columns();
        """))
    
    # Trigger for game_id <-> product_id sync (generic function)
    connection.execute(text("""
        CREATE OR REPLACE FUNCTION sync_game_product_columns()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
                -- Sync game_id -> product_id
                IF NEW.game_id IS NOT NULL AND NEW.product_id IS NULL THEN
                    NEW.product_id := NEW.game_id;
                -- Sync product_id -> game_id
                ELSIF NEW.product_id IS NOT NULL AND NEW.game_id IS NULL THEN
                    NEW.game_id := NEW.product_id;
                END IF;
                RETURN NEW;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """))
    
    # Apply trigger to all tables with game_id and product_id
    tables_with_game_id = [
        'gamechatsettings', 'gamestatus', 'gameconfiguration', 'gameinvitecode',
        'gamesecuritylog', 'gamekeyprice', 'gamefileconfig', 'gameextrafile',
        'changelog_entry', 'announcement', 'file_meta'
    ]
    
    for table in tables_with_game_id:
        result = connection.execute(text(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table}' 
            AND (column_name = 'game_id' OR column_name = 'product_id')
        """))
        if len(result.fetchall()) >= 2:  # Both columns exist
            trigger_name = f'trg_sync_{table}_game_product'
            result = connection.execute(text(f"""
                SELECT trigger_name 
                FROM information_schema.triggers 
                WHERE trigger_name = '{trigger_name}'
            """))
            if result.fetchone() is None:
                connection.execute(text(f"""
                    CREATE TRIGGER {trigger_name}
                    BEFORE INSERT OR UPDATE ON {table}
                    FOR EACH ROW
                    EXECUTE FUNCTION sync_game_product_columns();
                """))


def downgrade():
    """
    Remove universal terminology columns and triggers.
    """
    connection = op.get_bind()
    
    # Drop triggers first
    tables_with_triggers = [
        'gamechatsettings', 'gamestatus', 'gameconfiguration', 'gameinvitecode',
        'gamesecuritylog', 'gamekeyprice', 'gamefileconfig', 'gameextrafile',
        'changelog_entry', 'announcement', 'file_meta', 'blockedhwid'
    ]
    
    for table in tables_with_triggers:
        trigger_name = f'trg_sync_{table}_game_product'
        if table == 'blockedhwid':
            trigger_name = 'trg_sync_blockedhwid_columns'
        try:
            connection.execute(text(f"DROP TRIGGER IF EXISTS {trigger_name} ON {table}"))
        except Exception:
            pass
    
    # Drop functions
    try:
        connection.execute(text("DROP FUNCTION IF EXISTS sync_blockedhwid_columns()"))
        connection.execute(text("DROP FUNCTION IF EXISTS sync_game_product_columns()"))
    except Exception:
        pass
    
    # Drop columns (in reverse order)
    tables_to_downgrade = [
        'file_meta', 'announcement', 'changelog_entry', 'gameextrafile',
        'gamefileconfig', 'gamekeyprice', 'gamesecuritylog', 'gameinvitecode',
        'gameconfiguration', 'gamestatus', 'gamechatsettings', 'blockedhwid'
    ]
    
    for table in tables_to_downgrade:
        if table == 'blockedhwid':
            try:
                op.drop_index('ix_blockedhwid_device_fingerprint', table_name='blockedhwid')
                op.drop_constraint('uq_blockedhwid_device_fingerprint_project', table_name='blockedhwid', type_='unique')
                op.drop_column(table, 'device_fingerprint')
            except Exception:
                pass
        elif table == 'feature_config_schema':
            try:
                op.drop_constraint('fk_feature_config_schema_game_id', table_name='feature_config_schema', type_='foreignkey')
                op.drop_column(table, 'game_id')
            except Exception:
                pass
        else:
            try:
                # Drop foreign keys
                op.drop_constraint(f'fk_{table}_product_id', table_name=table, type_='foreignkey')
                # Drop unique constraints if they exist
                if table == 'gamechatsettings':
                    op.drop_constraint('uq_gamechatsettings_product_id', table_name=table, type_='unique')
                elif table == 'gameconfiguration':
                    op.drop_constraint('uq_gameconfiguration_product_id', table_name=table, type_='unique')
                elif table == 'gamekeyprice':
                    op.drop_constraint('uq_gamekeyprice_product_period', table_name=table, type_='unique')
                # Drop column
                op.drop_column(table, 'product_id')
            except Exception:
                pass

