"""
Users Routes Module
Modular structure for user management routes

This module replaces the monolithic users.py file with a modular structure:
- management.py: CRUD operations (create, read, update, delete)
- profile.py: Profile management (avatar, password, profile update)
- balance.py: Balance management (topup, deduct)
- tokens.py: API tokens management
- referral_codes.py: Referral codes management
"""

from flask import Blueprint

from .balance import balance_bp

from .clients import clients_user_bp
from .management import management_bp
from .profile import profile_bp
from .referral_codes import referral_codes_bp
from .tokens import tokens_bp

users_bp = Blueprint("users", __name__)

users_bp.register_blueprint(management_bp)
users_bp.register_blueprint(profile_bp)
users_bp.register_blueprint(balance_bp, url_prefix="/balance")
users_bp.register_blueprint(tokens_bp)
users_bp.register_blueprint(referral_codes_bp)
users_bp.register_blueprint(clients_user_bp)

__all__ = ["users_bp"]
