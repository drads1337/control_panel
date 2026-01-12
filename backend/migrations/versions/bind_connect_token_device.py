"""Bind connect tokens to device and certificate fingerprints

Revision ID: bind_connect_token_device
Revises: add_library_build_hash
Create Date: 2026-01-12

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bind_connect_token_device'
down_revision = 'add_library_build_hash'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('connect_token', sa.Column('fingerprint', sa.String(length=128), nullable=True))
    op.add_column('connect_token', sa.Column('cert_fingerprint', sa.String(length=128), nullable=True))


def downgrade():
    op.drop_column('connect_token', 'cert_fingerprint')
    op.drop_column('connect_token', 'fingerprint')

