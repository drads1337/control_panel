"""
Blueprint registration module
Centralizes all blueprint imports and registration logic
"""
from flask import Flask

from ..routes.admin.system import system_bp
from ..routes.admin.users import admin_users_bp
from ..routes.admin_main import admin_bp
from ..routes.analytics import analytics_bp

from ..routes.auth import auth_bp
from ..routes.cache_management import cache_bp
from ..routes.changelog import changelog_bp
from ..routes.chat import chat_bp
from ..routes.connect.connect import connect_bp
from ..routes.dashboard import dashboard_bp
from ..routes.dynamic_config import dynamic_config_bp
from ..routes.files import files_bp

from ..routes.products import products_bp
from ..routes.heartbeat import heartbeat_bp
from ..routes.keys import keys_bp
from ..routes.agents import agents_bp

from ..routes.logs import logs_bp
from ..routes.monitoring import monitoring_bp
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
    Register all application blueprints with their URL prefixes.

    Args:
        app: Flask application instance
    """
    API_VERSION = "/api"

    app.register_blueprint(auth_bp, url_prefix=f"{API_VERSION}/auth")
    app.register_blueprint(admin_bp, url_prefix=API_VERSION)
    app.register_blueprint(connect_bp, url_prefix=API_VERSION)
    app.register_blueprint(projects_bp, url_prefix=API_VERSION)
    app.register_blueprint(dashboard_bp, url_prefix=f"{API_VERSION}/dashboard")
    app.register_blueprint(heartbeat_bp, url_prefix=API_VERSION)
    app.register_blueprint(dynamic_config_bp, url_prefix=API_VERSION)
    app.register_blueprint(users_bp, url_prefix=f"{API_VERSION}/users")
    app.register_blueprint(profile_bp, url_prefix=f"{API_VERSION}/profile")
    app.register_blueprint(keys_bp, url_prefix=f"{API_VERSION}/keys")
    app.register_blueprint(sessions_bp, url_prefix=f"{API_VERSION}/sessions")
    app.register_blueprint(system_bp, url_prefix=f"{API_VERSION}/admin")
    app.register_blueprint(admin_users_bp, url_prefix=f"{API_VERSION}/admin/users")
    app.register_blueprint(servers_bp, url_prefix=f"{API_VERSION}/servers")
    app.register_blueprint(files_bp, url_prefix=f"{API_VERSION}/files")
    app.register_blueprint(products_bp, url_prefix=f"{API_VERSION}/products", name="products")
    app.register_blueprint(agents_bp, url_prefix=f"{API_VERSION}/agents", name="agents")
    app.register_blueprint(notifications_bp, url_prefix=f"{API_VERSION}/notifications")
    app.register_blueprint(chat_bp, url_prefix=f"{API_VERSION}/chat")
    app.register_blueprint(logs_bp, url_prefix=f"{API_VERSION}/logs")
    app.register_blueprint(changelog_bp, url_prefix=f"{API_VERSION}/changelog")
    app.register_blueprint(analytics_bp, url_prefix=f"{API_VERSION}/analytics")
    app.register_blueprint(monitoring_bp, url_prefix=f"{API_VERSION}/monitoring")
    app.register_blueprint(webhooks_bp, url_prefix=f"{API_VERSION}/webhooks")
    app.register_blueprint(rbac_bp, url_prefix=f"{API_VERSION}/rbac")
    app.register_blueprint(remote_control_bp, url_prefix=f"{API_VERSION}/remote-control")
    app.register_blueprint(cache_bp, url_prefix=f"{API_VERSION}/cache")
    app.register_blueprint(settings_bp, url_prefix="")