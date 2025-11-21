"""add unique_id to agent, key, and file tables

Revision ID: add_unique_id_fields
Revises: 8d5e8da95720
Create Date: 2025-11-21 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import random
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'add_unique_id_fields'
down_revision = '8d5e8da95720'
branch_labels = None
depends_on = None


def generate_unique_id(length):
    """Generate a random numeric string of given length"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def upgrade():
    # Add unique_id column to agent table (8 digits)
    op.add_column('agent', sa.Column('unique_id', sa.String(length=8), nullable=True))
    
    # Generate unique IDs for existing agents
    connection = op.get_bind()
    agents = connection.execute(text("SELECT id FROM agent")).fetchall()
    for agent_id, in agents:
        while True:
            unique_id = generate_unique_id(8)
            # Check if this ID already exists
            existing = connection.execute(
                text("SELECT id FROM agent WHERE unique_id = :uid"),
                {"uid": unique_id}
            ).fetchone()
            if not existing:
                connection.execute(
                    text("UPDATE agent SET unique_id = :uid WHERE id = :id"),
                    {"uid": unique_id, "id": agent_id}
                )
                break
    
    # Make unique_id NOT NULL and add unique constraint
    op.alter_column('agent', 'unique_id', nullable=False)
    op.create_unique_constraint('uq_agent_unique_id', 'agent', ['unique_id'])
    
    # Add unique_id column to key table (9 digits)
    op.add_column('key', sa.Column('unique_id', sa.String(length=9), nullable=True))
    
    # Generate unique IDs for existing keys
    keys = connection.execute(text("SELECT id FROM key")).fetchall()
    for key_id, in keys:
        while True:
            unique_id = generate_unique_id(9)
            # Check if this ID already exists
            existing = connection.execute(
                text("SELECT id FROM key WHERE unique_id = :uid"),
                {"uid": unique_id}
            ).fetchone()
            if not existing:
                connection.execute(
                    text("UPDATE key SET unique_id = :uid WHERE id = :id"),
                    {"uid": unique_id, "id": key_id}
                )
                break
    
    # Make unique_id NOT NULL and add unique constraint
    op.alter_column('key', 'unique_id', nullable=False)
    op.create_unique_constraint('uq_key_unique_id', 'key', ['unique_id'])
    
    # Add unique_id column to productfileconfig table (8 digits)
    op.add_column('productfileconfig', sa.Column('unique_id', sa.String(length=8), nullable=True))
    
    # Add unique_id column to productextrafile table (8 digits) - add before generating IDs
    op.add_column('productextrafile', sa.Column('unique_id', sa.String(length=8), nullable=True))
    
    # Generate unique IDs for existing configs and extra files
    # We need to ensure uniqueness across both tables
    configs = connection.execute(text("SELECT id FROM productfileconfig")).fetchall()
    extra_files = connection.execute(text("SELECT id FROM productextrafile")).fetchall()
    
    # Get all existing unique_ids from both tables (should be empty, but just in case)
    existing_ids = set()
    existing_config_ids = connection.execute(text("SELECT unique_id FROM productfileconfig WHERE unique_id IS NOT NULL")).fetchall()
    existing_extra_ids = connection.execute(text("SELECT unique_id FROM productextrafile WHERE unique_id IS NOT NULL")).fetchall()
    existing_ids.update([row[0] for row in existing_config_ids if row[0]])
    existing_ids.update([row[0] for row in existing_extra_ids if row[0]])
    
    # Generate IDs for configs
    for config_id, in configs:
        while True:
            unique_id = generate_unique_id(8)
            if unique_id not in existing_ids:
                existing_ids.add(unique_id)
                connection.execute(
                    text("UPDATE productfileconfig SET unique_id = :uid WHERE id = :id"),
                    {"uid": unique_id, "id": config_id}
                )
                break
    
    # Generate IDs for extra files
    for extra_id, in extra_files:
        while True:
            unique_id = generate_unique_id(8)
            if unique_id not in existing_ids:
                existing_ids.add(unique_id)
                connection.execute(
                    text("UPDATE productextrafile SET unique_id = :uid WHERE id = :id"),
                    {"uid": unique_id, "id": extra_id}
                )
                break
    
    # Make unique_id NOT NULL and add unique constraint for productfileconfig
    op.alter_column('productfileconfig', 'unique_id', nullable=False)
    op.create_unique_constraint('uq_productfileconfig_unique_id', 'productfileconfig', ['unique_id'])
    
    # Make unique_id NOT NULL and add unique constraint for productextrafile
    op.alter_column('productextrafile', 'unique_id', nullable=False)
    op.create_unique_constraint('uq_productextrafile_unique_id', 'productextrafile', ['unique_id'])


def downgrade():
    # Remove unique constraints
    op.drop_constraint('uq_productextrafile_unique_id', 'productextrafile', type_='unique')
    op.drop_constraint('uq_productfileconfig_unique_id', 'productfileconfig', type_='unique')
    op.drop_constraint('uq_key_unique_id', 'key', type_='unique')
    op.drop_constraint('uq_agent_unique_id', 'agent', type_='unique')
    
    # Remove columns
    op.drop_column('productextrafile', 'unique_id')
    op.drop_column('productfileconfig', 'unique_id')
    op.drop_column('key', 'unique_id')
    op.drop_column('agent', 'unique_id')

