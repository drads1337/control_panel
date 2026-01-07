"""Remove public_key_cert from project_encryption_keys

Revision ID: remove_public_key_cert
Revises: eb35e1487b67
Create Date: 2024-12-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'remove_public_key_cert'
down_revision = 'eb35e1487b67'
branch_labels = None
depends_on = None


def upgrade():
    # Remove public_key_cert column from project_encryption_keys table
    op.drop_column('project_encryption_keys', 'public_key_cert')


def downgrade():
    # Add back public_key_cert column (nullable=False for backward compatibility)
    op.add_column('project_encryption_keys', 
                  sa.Column('public_key_cert', sa.Text(), nullable=False, server_default=''))


