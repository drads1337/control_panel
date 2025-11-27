"""
Server Service
Handles server management operations and all server-related business logic
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from ...core.extensions import db
from ...models.core import Project, User
from ...utils.project_settings_migration import ProjectSettingsHelper
from ...models.servers import Server
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.rbac_utils import RBACManager

class ServerService:
    """Service for handling server management operations"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """
        Get user by ID

        Args:
            user_id: User ID

        Returns:
            User object or None if not found
        """
        try:
            return User.query.get(user_id)
        except Exception as e:
            self.logger.error(f"Error getting user by ID {user_id}: {str(e)}")
            return None

    def get_server_by_id(
        self, server_id: int, user: User, enforce_isolation: bool = True
    ) -> Optional[Server]:
        """
        Get server by ID with proper project isolation

        Args:
            server_id: Server ID
            user: Current user for access control
            enforce_isolation: Whether to enforce project isolation

        Returns:
            Server object or None if not found or access denied
        """
        try:
            if RBACManager.is_owner(user) and not enforce_isolation:
                server = Server.query.filter_by(id=server_id).first()
            else:
                server = Server.query.filter_by(id=server_id, project_id=user.project_id).first()

            return server
        except Exception as e:
            self.logger.error(f"Error getting server by ID {server_id}: {str(e)}")
            return None

    def get_servers(
        self,
        user: User,
        page: int = 1,
        per_page: int = 20,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        include_password: bool = False,
    ) -> Dict[str, Any]:
        """
        Get paginated list of servers with filtering

        Args:
            user: Current user for access control
            page: Page number
            per_page: Items per page
            status_filter: Filter by status
            search: Search query for full-text search
            include_password: Whether to include decrypted passwords

        Returns:
            Dictionary with servers list and pagination info
        """
        try:
            query = Server.query

            if not RBACManager.is_owner(user):
                query = query.filter_by(project_id=user.project_id)

            if status_filter:
                query = query.filter_by(status=status_filter)

            if search:

                query = fulltext_search_filter(query, search, "search_vector")

            pagination = query.order_by(Server.created_at.desc()).paginate(
                page=page, per_page=per_page, error_out=False
            )

            project_ids = list(set([server.project_id for server in pagination.items]))
            project_settings_dict = {}
            if project_ids and include_password:
                # Get project master keys from encryption settings
                for pid in project_ids:
                    helper = ProjectSettingsHelper(pid)
                    encryption_settings = helper.get_encryption_settings()
                    if encryption_settings.project_master_key:
                        project_settings_dict[pid] = encryption_settings.project_master_key

            servers = []
            for server in pagination.items:

                project_master_key = None
                if include_password:
                    project_master_key = project_settings_dict.get(server.project_id)

                server_data = server.to_dict(
                    include_password=include_password, project_master_key=project_master_key
                )
                servers.append(server_data)

            return {
                "servers": servers,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        except Exception as e:
            self.logger.error(f"Error getting servers: {str(e)}")
            raise

    def create_server(
        self,
        user: User,
        name: str,
        ip_address: str,
        username: str,
        password: str,
        port: int = 22,
        description: Optional[str] = None,
        is_active: bool = True,
        project_id: Optional[int] = None,
    ) -> Tuple[Optional[Server], Optional[str]]:
        """
        Create a new server

        Args:
            user: Current user creating the server
            name: Server name
            ip_address: Server IP address
            username: SSH username
            password: SSH password (plain text, will be encrypted)
            port: SSH port (default: 22)
            description: Server description
            is_active: Whether server is active
            project_id: Project ID (required if user is owner)

        Returns:
            Tuple of (Server object or None, error message or None)
        """
        try:

            if not project_id:
                if RBACManager.is_owner(user):
                    return None, "Project ID is required for owner users"
                project_id = user.project_id

            if not project_id:
                return None, "Project ID is required"

            if Server.query.filter_by(name=name, project_id=project_id).first():
                return None, "Server with this name already exists"

            if Server.query.filter_by(ip_address=ip_address, project_id=project_id).first():
                return None, "Server with this IP address already exists"

            helper = ProjectSettingsHelper(project_id)
            encryption_settings = helper.get_encryption_settings()
            if not encryption_settings.project_master_key:
                return (
                    None,
                    "Project encryption key not found. Please contact administrator.",
                )

            server = Server(
                name=name,
                ip_address=ip_address,
                port=port,
                username=username,
                password="",
                description=description or "",
                is_active=is_active,
                status="offline",
                project_id=project_id,
                created_at=datetime.utcnow(),
            )

            server.set_password(password, encryption_settings.project_master_key)

            db.session.add(server)

            if project_id:
                from ...utils.project_counters import increment_project_server_counters
                increment_project_server_counters(project_id)

            db.session.commit()

            return server, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating server: {str(e)}")
            return None, f"Failed to create server: {str(e)}"

    def delete_server(self, server_id: int, user: User) -> Tuple[bool, Optional[str]]:
        """
        Delete a server

        Args:
            server_id: Server ID to delete
            user: Current user performing the deletion

        Returns:
            Tuple of (success, error_message)
        """
        try:
            server = self.get_server_by_id(server_id, user)

            if not server:
                return False, "Server not found"

            project_id = server.project_id
            if project_id:
                # Invalidate statistics cache instead of using deprecated counters
                from ...utils.service_helpers import get_service
                cache_service = get_service('cache_service')
                cache_service = get_service('cache_service')
                cache_service = get_service('cache_service')
                cache_service.invalidate_pattern(f"stats:project_id={project_id}:*")

            db.session.delete(server)
            db.session.commit()

            return True, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting server {server_id}: {str(e)}")
            return False, f"Failed to delete server: {str(e)}"

    def get_server_stats(self, user: User) -> Dict[str, Any]:
        """
        Get server statistics

        Args:
            user: Current user requesting stats

        Returns:
            Dictionary with server statistics
        """
        try:
            query = Server.query

            if not RBACManager.is_owner(user):
                query = query.filter_by(project_id=user.project_id)

            total_servers = query.count()
            online_servers = query.filter_by(status="online").count()
            offline_servers = query.filter_by(status="offline").count()
            starting_servers = query.filter_by(status="starting").count()
            stopping_servers = query.filter_by(status="stopping").count()

            project_stats = []
            if RBACManager.is_owner(user):
                project_stats = (
                    db.session.query(Project.name, func.count(Server.id))
                    .join(Server, Project.id == Server.project_id)
                    .group_by(Project.name)
                    .all()
                )

            return {
                "overview": {
                    "total": total_servers,
                    "online": online_servers,
                    "offline": offline_servers,
                    "starting": starting_servers,
                    "stopping": stopping_servers,
                    "uptime_rate": 99.0,
                },
                "project_stats": [
                    {"project": project, "count": count} for project, count in project_stats
                ],
            }
        except Exception as e:
            self.logger.error(f"Error getting server stats: {str(e)}")
            raise

    def get_servers_by_ids(
        self, server_ids: List[int], user: User
    ) -> List[Server]:
        """
        Get multiple servers by IDs with proper project isolation

        Args:
            server_ids: List of server IDs
            user: Current user for access control

        Returns:
            List of Server objects
        """
        try:
            if RBACManager.is_owner(user):
                query = Server.query.filter(Server.id.in_(server_ids))
            else:
                query = Server.query.filter(
                    Server.id.in_(server_ids), Server.project_id == user.project_id
                )

            return query.all()
        except Exception as e:
            self.logger.error(f"Error getting servers by IDs: {str(e)}")
            return []

    def get_project_settings(self, project_id: int) -> Optional[Any]:
        """
        Get project settings for a project

        Args:
            project_id: Project ID

        Returns:
            Aggregated settings object or None if not found
        """
        try:
            from ...services.settings.settings_repository import SettingsRepository
            repo = SettingsRepository()
            return repo.get_all_project_settings(project_id)
        except Exception as e:
            self.logger.error(f"Error getting project settings for project {project_id}: {str(e)}")
            return None

# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   server_service = get_service('server_service')
