"""Change game_key_price.price from Integer to Float

Revision ID: change_price_to_float_001
Revises: 1c4a30168a7a885b
Create Date: 2025-01-20 15:00:00.000000

This migration changes the price column in game_key_price table from Integer to Float
to support decimal prices (e.g., 0.4, 1.5, etc.)
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'change_price_to_float_001'
down_revision = '1c4a30168a7a885b'
branch_labels = None
depends_on = None


def upgrade():
    """
    Change price column from Integer to Float
    """
    # For PostgreSQL, we can directly alter the column type
    # SQLAlchemy will handle the conversion
    op.alter_column('game_key_price', 'price',
                    existing_type=sa.Integer(),
                    type_=sa.Float(),
                    existing_nullable=False)


def downgrade():
    """
    Revert price column back to Integer
    Note: This will truncate decimal values
    """
    op.alter_column('game_key_price', 'price',
                    existing_type=sa.Float(),
                    type_=sa.Integer(),
                    existing_nullable=False)

