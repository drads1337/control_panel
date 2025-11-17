"""
Blueprint registration module
Centralizes all blueprint imports and registration logic
"""

from flask import Flask

from ..routes.admin.system import system_bp
from ..routes.admin.users import admin_users_bp
from ..routes.admin_main import admin_bp
from ..routes.analytics import analytics_bp

# Import all blueprints
from ..routes.auth import auth_bp
from ..routes.cache_management import cache_bp
from ..routes.changelog import changelog_bp
from ..routes.chat import chat_bp
from ..routes.clients import clients_bp
from ..routes.connect.connect import connect_bp
from ..routes.dashboard import dashboard_bp
from ..routes.dynamic_config import dynamic_config_bp
from ..routes.files import files_bp
# Import modular blueprints (using directory structure)
# These imports use the modular directory structure with __init__.py:
# - routes/games/ (management, prices, files, bulk_operations, metadata)
# - routes/keys/ (management, bulk_operations, analytics, loader, validation)
# - routes/users/ (management, profile, balance, clients, tokens, referral_codes)
from ..routes.games import games_bp
from ..routes.heartbeat import heartbeat_bp
from ..routes.keys import keys_bp
from ..routes.loaders import loaders_bp

# Import other blueprints
from ..routes.logs import logs_bp
from ..routes.notifications import notifications_bp
from ..routes.profile import profile_bp
from ..routes.projects import projects_bp
from ..routes.rbac import rbac_bp
from ..routes.remote_control import remote_control_bp
from ..routes.servers import servers_bp
from ..routes.sessions import sessions_bp
from ..routes.settings import settings_bp
from ..routes.users import users_bp
from ..routes.webhooks import webhooks_bp


def register_blueprints(app: Flask) -> None:
    """
    Register all application blueprints with their URL prefixes

    Args:
        app: Flask application instance
    """
    # Core API blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(admin_bp, url_prefix="/api")
    app.register_blueprint(connect_bp, url_prefix="/api")
    app.register_blueprint(projects_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
    app.register_blueprint(heartbeat_bp, url_prefix="/api")
    app.register_blueprint(dynamic_config_bp, url_prefix="/api")

    # User management blueprints
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(profile_bp, url_prefix="/api/profile")
    app.register_blueprint(keys_bp, url_prefix="/api/keys")
    app.register_blueprint(sessions_bp, url_prefix="/api/sessions")
    app.register_blueprint(clients_bp, url_prefix="/api/clients")

    # Admin blueprints
    app.register_blueprint(system_bp, url_prefix="/api/admin")
    app.register_blueprint(admin_users_bp, url_prefix="/api/admin/users")

    # Resource management blueprints
    app.register_blueprint(servers_bp, url_prefix="/api/servers")
    app.register_blueprint(files_bp, url_prefix="/api/files")
    app.register_blueprint(games_bp, url_prefix="/api/games")
    app.register_blueprint(loaders_bp, url_prefix="/api/loaders")

    # Communication blueprints
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
    app.register_blueprint(chat_bp, url_prefix="/api/chat")

    # System blueprints
    app.register_blueprint(logs_bp, url_prefix="/api/logs")
    app.register_blueprint(changelog_bp, url_prefix="/api/changelog")
    app.register_blueprint(analytics_bp, url_prefix="/api/analytics")
    app.register_blueprint(webhooks_bp, url_prefix="/api/webhooks")
    app.register_blueprint(rbac_bp, url_prefix="/api/rbac")
    app.register_blueprint(remote_control_bp, url_prefix="/api/remote-control")
    app.register_blueprint(cache_bp, url_prefix="/api/cache")

    # Settings blueprint (no prefix)
    app.register_blueprint(settings_bp, url_prefix="")
