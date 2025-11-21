"""add unique_id to user table

Revision ID: add_unique_id_user
Revises: add_unique_id_fields
Create Date: 2025-11-21 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import random
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'add_unique_id_user'
down_revision = 'add_unique_id_fields'
branch_labels = None
depends_on = None


def generate_unique_id(length):
    """Generate a random numeric string of given length"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def upgrade():
    # Add unique_id column to user table (9 digits)
    op.add_column('user', sa.Column('unique_id', sa.String(length=9), nullable=True))
    
    # Generate unique IDs for existing users
    connection = op.get_bind()
    users = connection.execute(text("SELECT id FROM \"user\"")).fetchall()
    for user_id, in users:
        while True:
            unique_id = generate_unique_id(9)
            # Check if this ID already exists
            existing = connection.execute(
                text("SELECT id FROM \"user\" WHERE unique_id = :uid"),
                {"uid": unique_id}
            ).fetchone()
            if not existing:
                connection.execute(
                    text("UPDATE \"user\" SET unique_id = :uid WHERE id = :id"),
                    {"uid": unique_id, "id": user_id}
                )
                break
    
    # Make unique_id NOT NULL and add unique constraint
    op.alter_column('user', 'unique_id', nullable=False)
    op.create_unique_constraint('uq_user_unique_id', 'user', ['unique_id'])


def downgrade():
    # Remove unique constraint
    op.drop_constraint('uq_user_unique_id', 'user', type_='unique')
    
    # Remove column
    op.drop_column('user', 'unique_id')

