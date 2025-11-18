"""
Project Service
Provides cached access to project data and operations
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func

from ...core.extensions import db
from ...models.core import Project, ProjectEncryptionKeys, ProjectInviteCode, User, UserActivity
from ...models.games import Game, GameKeyPrice
from ...models.keys import Key
from ...models.servers import Server
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles
from ...services.cache import cache_service

class ProjectService:
    """Service for managing project data with caching"""

    def __init__(self, cache_service=None, logger=None):
        self.cache_service = cache_service
        self.logger = logger or logging.getLogger(__name__)

    @property
    def _cache_service(self):
        """Get cache service instance"""
        return self.cache_service if self.cache_service is not None else cache_service

    def get_projects_cached(
        self, user_id: int, page: int = 1, per_page: int = 20, search: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get projects with caching support"""

        self.logger.info(
            f"get_projects_cached called - user_id: {user_id}, page: {page}, "
            f"per_page: {per_page}, search: {search}"
        )

        def fetch_projects():
            """Fetch projects from database"""
            try:
                self.logger.info(f"[FETCH] Fetching projects from database for user {user_id}")

                user = User.query.get(user_id)
                if not user:
                    self.logger.error(f"[FETCH] User {user_id} not found in database!")
                    return {
                        "projects": [],
                        "total": 0,
                        "pages": 0,
                        "current_page": page,
                        "per_page": per_page,
                    }

                user_roles_log = RBACManager.get_user_role_names(user)
                primary_role_log = user_roles_log[0] if user_roles_log else UserRoles.CLIENT.value
                self.logger.info(
                    f"[FETCH] User found - id: {user.id}, username: {user.username}, "
                    f"roles: {user_roles_log}, primary_role: {primary_role_log}, project_id: {user.project_id}"
                )

                is_owner = RBACManager.is_owner(user)

                self.logger.info(
                    f"get_projects_cached - user_id: {user_id}, "
                    f"is_owner: {is_owner}, "
                    f"user.project_id: {user.project_id}"
                )

                total_projects_count = Project.query.count()
                self.logger.info(f"[FETCH] Total projects in database: {total_projects_count}")

                if total_projects_count > 0:
                    all_projects = Project.query.all()
                    project_info = [(p.id, p.name, p.status) for p in all_projects]
                    self.logger.info(f"[FETCH] All projects in DB: {project_info}")

                query = Project.query
                self.logger.info(f"[FETCH] Starting base query: {query}")

                if not is_owner:
                    if user.project_id:
                        self.logger.info(f"[FETCH] User is NOT owner, filtering by project_id: {user.project_id}")

                        project_exists = Project.query.filter(Project.id == user.project_id).first()
                        if project_exists:
                            self.logger.info(f"[FETCH] Project {user.project_id} exists: {project_exists.name}")
                        else:
                            self.logger.warning(f"[FETCH] Project {user.project_id} does NOT exist in database!")
                        query = query.filter(Project.id == user.project_id)
                    else:

                        self.logger.warning(
                            f"[FETCH] User {user_id} is not owner and has no project_id, "
                            f"returning empty list"
                        )
                        return {
                            "projects": [],
                            "total": 0,
                            "pages": 0,
                            "current_page": page,
                            "per_page": per_page,
                        }
                else:
                    self.logger.info(f"[FETCH] User is owner, showing all {total_projects_count} projects")

                if search:
                    self.logger.info(f"[FETCH] Applying full-text search filter: {search}")

                    query = fulltext_search_filter(query, search, "search_vector")

                self.logger.info("[FETCH] Using denormalized counters from Project model")

                try:
                    query_count = query.count()
                    self.logger.info(f"[FETCH] Query count: {query_count}")
                except Exception as e:
                    self.logger.error(f"[FETCH] Error counting query: {e}")

                self.logger.info(f"[FETCH] Applying pagination: page={page}, per_page={per_page}")
                pagination = query.order_by(Project.created_at.desc()).paginate(
                    page=page, per_page=per_page, error_out=False
                )

                self.logger.info(
                    f"[FETCH] Pagination result - total: {pagination.total}, "
                    f"pages: {pagination.pages}, "
                    f"items on page: {len(pagination.items)}, "
                    f"has_next: {pagination.has_next}, "
                    f"has_prev: {pagination.has_prev}, "
                    f"search: {search}, "
                    f"is_owner: {is_owner}, "
                    f"user.project_id: {user.project_id}"
                )

                if is_owner and pagination.total == 0:
                    all_projects = Project.query.all()
                    self.logger.warning(
                        f"[FETCH] WARNING: Owner user {user_id} sees 0 projects, "
                        f"but database has {len(all_projects)} projects: "
                        f"{[p.id for p in all_projects]}"
                    )

                if not is_owner and user.project_id and pagination.total == 0:
                    project_check = Project.query.filter(Project.id == user.project_id).first()
                    self.logger.warning(
                        f"[FETCH] WARNING: Non-owner user {user_id} with project_id {user.project_id} "
                        f"sees 0 projects. Project exists: {project_check is not None}"
                    )

                projects = []
                self.logger.info(f"[FETCH] Processing {len(pagination.items)} project items")

                for idx, project in enumerate(pagination.items):
                    self.logger.info(
                        f"[FETCH] Processing project {idx+1}/{len(pagination.items)}: "
                        f"id={project.id}, name={project.name}, status={project.status}"
                    )
                    projects.append(
                        {
                            "id": project.id,
                            "unique_id": project.unique_id,
                            "name": project.name,
                            "description": project.description,
                            "admin_id": project.admin_id,
                            "created_at": (
                                project.created_at.isoformat() if project.created_at else None
                            ),
                            "status": project.status,
                            "subscription_status": project.subscription_status,
                            "subscription_expires_at": (
                                project.subscription_expires_at.isoformat()
                                if project.subscription_expires_at
                                else None
                            ),
                            "days_until_expiry": project.days_until_expiry,
                            "is_active": project.is_active,
                            "subscription_status_display": project.subscription_status_display,
                            "storage_limit_gb": project.storage_limit_gb,
                            "stats": {
                                "users": project.total_users or 0,
                                "keys": project.total_keys or 0,
                                "games": project.total_games or 0,
                                "servers": project.total_servers or 0,
                            },
                        }
                    )

                result = {
                    "projects": projects,
                    "total": pagination.total,
                    "pages": pagination.pages,
                    "current_page": page,
                    "per_page": per_page,
                }

                self.logger.info(
                    f"[FETCH] Returning result with {len(projects)} projects, "
                    f"total: {pagination.total}, pages: {pagination.pages}"
                )

                return result

            except Exception as e:
                import traceback
                self.logger.error(f"[FETCH] ERROR fetching projects: {str(e)}")
                self.logger.error(f"[FETCH] Traceback: {traceback.format_exc()}")
                return {
                    "projects": [],
                    "total": 0,
                    "pages": 0,
                    "current_page": page,
                    "per_page": per_page,
                    "error": str(e),
                }

        cache_key_params = {"user_id": user_id, "page": page, "per_page": per_page}

        if search:
            cache_key_params["search"] = search

        self.logger.info(f"[CACHE] Cache key params: {cache_key_params}")

        cached_result = self._cache_service.get_or_set(
            cache_type="projects", fetch_func=fetch_projects, **cache_key_params
        )

        if cached_result:
            self.logger.info(
                f"[CACHE] Cache hit or set - returning {len(cached_result.get('projects', []))} projects"
            )
        else:
            self.logger.warning("[CACHE] Cache returned None, returning empty result")

        return cached_result or {
            "projects": [],
            "total": 0,
            "pages": 0,
            "current_page": page,
            "per_page": per_page,
        }

    def get_project_cached(self, project_id: int, user_id: int) -> Dict[str, Any]:
        """Get single project with caching support"""

        def fetch_project():
            """Fetch single project from database"""
            try:
                self.logger.info(f"Fetching project {project_id} from database")

                user = User.query.get(user_id)
                if not user:
                    return {"error": "User not found"}

                try:
                    user_roles = RBACManager.get_user_role_names(user)
                except Exception as e:
                    self.logger.error(f"Failed to get RBAC roles for user {user.id}: {e}")

                    user_roles = [UserRoles.CLIENT.value]

                if user.project_id and user.project_id == project_id:
                    self.logger.info(
                        f"TEMPORARY FIX: Allowing access for user {user_id} to project {project_id} (matching project_id)"
                    )
                else:
                    self.logger.warning(
                        f"TEMPORARY FIX: Access denied - user {user_id} project_id {user.project_id} does not match requested project_id {project_id}"
                    )
                    return {"error": "Access denied"}

                project = Project.query.get(project_id)
                if not project:
                    return {"error": "Project not found"}

                return {
                    "id": project.id,
                    "unique_id": project.unique_id,
                    "name": project.name,
                    "description": project.description,
                    "admin_id": project.admin_id,
                    "created_at": project.created_at.isoformat() if project.created_at else None,
                    "status": project.status,
                    "subscription_status": project.subscription_status,
                    "subscription_expires_at": (
                        project.subscription_expires_at.isoformat()
                        if project.subscription_expires_at
                        else None
                    ),
                    "days_until_expiry": project.days_until_expiry,
                    "is_active": project.is_active,
                    "subscription_status_display": project.subscription_status_display,
                    "storage_limit_gb": project.storage_limit_gb,
                }

            except Exception as e:
                self.logger.error(f"Error fetching project {project_id}: {str(e)}")
                return {"error": f"Failed to retrieve project: {str(e)}"}

        cache_key_params = {"project_id": project_id, "user_id": user_id}

        cached_result = self._cache_service.get_or_set(
            cache_type="projects", fetch_func=fetch_project, **cache_key_params
        )

        return cached_result or {"error": "Failed to retrieve project"}

    def get_project_stats_cached(self, project_id: int, user_id: int) -> Dict[str, Any]:
        """Get project statistics with caching support"""

        def fetch_project_stats():
            """Fetch project statistics from database"""
            try:
                self.logger.info(f"Fetching project stats for project {project_id}")

                user = User.query.get(user_id)
                if not user:
                    return {"error": "User not found"}

                is_owner = RBACManager.is_owner(user)

                if not is_owner:
                    if not user.project_id or user.project_id != project_id:
                        return {"error": "Access denied"}

                project = Project.query.get(project_id)
                if not project:
                    return {"error": "Project not found"}

                stats = (
                    db.session.query(
                        func.count(User.id).label("total_users"),
                        func.count(Key.id).label("total_keys"),
                        func.count(Game.id).label("total_games"),
                        func.count(Server.id).label("total_servers"),
                        func.count(func.distinct(User.id))
                        .filter(User.is_active == True)
                        .label("active_users"),
                        func.count(func.distinct(Key.id))
                        .filter(Key.is_active == True)
                        .label("active_keys"),
                    )
                    .outerjoin(User, User.project_id == project_id)
                    .outerjoin(Key, Key.project_id == project_id)
                    .outerjoin(Game, Game.project_id == project_id)
                    .outerjoin(Server, Server.project_id == project_id)
                    .first()
                )

                top_games = (
                    db.session.query(Game.name, func.count(Key.id).label("key_count"))
                    .outerjoin(Key, and_(Key.game_id == Game.id, Key.project_id == project_id))
                    .filter(Game.project_id == project_id)
                    .group_by(Game.id, Game.name)
                    .order_by(func.count(Key.id).desc())
                    .limit(5)
                    .all()
                )

                return {
                    "project_id": project_id,
                    "stats": {
                        "total_users": stats.total_users or 0,
                        "total_keys": stats.total_keys or 0,
                        "total_games": stats.total_games or 0,
                        "total_servers": stats.total_servers or 0,
                        "active_users": stats.active_users or 0,
                        "active_keys": stats.active_keys or 0,
                    },
                    "top_games": [{"game": game, "keys": count} for game, count in top_games],
                }

            except Exception as e:
                self.logger.error(f"Error fetching project stats {project_id}: {str(e)}")
                return {"error": f"Failed to retrieve project statistics: {str(e)}"}

        cache_key_params = {"project_id": project_id, "user_id": user_id}

        cached_result = self._cache_service.get_or_set(
            cache_type="stats", fetch_func=fetch_project_stats, **cache_key_params
        )

        return cached_result or {"error": "Failed to retrieve project statistics"}

    def invalidate_project_cache(self, project_id: int) -> bool:
        """Invalidate project cache"""
        try:
            self._cache_service.invalidate_project_cache(project_id)
            self.logger.info(f"Project cache invalidated for project {project_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error invalidating project cache: {e}")
            return False

    def create_project(
        self, user_id: int, name: str, description: str = "", ip_address: str = None, user_agent: str = None
    ) -> Dict[str, Any]:
        """
        Create a new project with all business logic

        Args:
            user_id: ID of the user creating the project
            name: Project name
            description: Project description
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with project data or error
        """
        try:
            from datetime import datetime, timedelta
            import uuid
            from ..activity import activity_service

            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            name = name.strip()
            if not name:
                return {"error": "Project name is required"}

            existing_project = Project.query.filter_by(name=name).first()
            if existing_project:
                return {"error": "Project with this name already exists"}

            project = Project(
                name=name,
                description=description.strip(),
                admin_id=user.id,
                unique_id=str(uuid.uuid4()),
                status="active",
                subscription_status="trial",
                subscription_expires_at=datetime.utcnow() + timedelta(days=30),
                is_active=True,
                storage_limit_gb=10,
            )

            db.session.add(project)
            db.session.commit()

            try:
                activity_service.log_activity(
                    user,
                    "project_created",
                    ip=ip_address,
                    details=f"Created project: {name}",
                    user_agent=user_agent,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log project creation activity: {e}")

            try:
                self.invalidate_project_cache(project.id)
                from ...services.cache import cache_service
                cache_service.invalidate_pattern("projects:*")
                self.logger.info(f"Cache invalidated after project creation: {project.id}")
            except Exception as e:
                self.logger.warning(f"Failed to invalidate cache after project creation: {e}")

            return {
                "message": "Project created successfully",
                "project": {
                    "id": project.id,
                    "name": project.name,
                    "description": project.description,
                    "unique_id": project.unique_id,
                    "created_at": project.created_at.isoformat(),
                },
            }

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating project: {str(e)}")
            return {"error": "Failed to create project"}

    def update_project(
        self,
        project_id: int,
        user_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[str] = None,
        subscription_status: Optional[str] = None,
        storage_limit_gb: Optional[float] = None,
        ip_address: str = None,
        user_agent: str = None,
    ) -> Dict[str, Any]:
        """
        Update project with all business logic

        Args:
            project_id: ID of the project to update
            user_id: ID of the user updating the project
            name: New project name (optional)
            description: New project description (optional)
            status: New project status (optional)
            subscription_status: New subscription status (optional)
            storage_limit_gb: New storage limit in GB (optional)
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with updated project data or error
        """
        try:
            from ..activity import activity_service
            from ...utils.rbac_utils import RBACManager
            from ...utils.role_constants import UserRoles

            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            try:
                user_roles = RBACManager.get_user_role_names(user)
            except Exception as e:
                self.logger.warning(f"Failed to get user roles for user {user.id}: {e}")

            is_owner = RBACManager.is_owner(user)

            if not is_owner:
                if not user.project_id or user.project_id != project_id:
                    return {"error": "Access denied"}

            project = Project.query.get(project_id)
            if not project:
                return {"error": "Project not found"}

            if name is not None:
                name = name.strip()
                if not name:
                    return {"error": "Project name cannot be empty"}

                existing_project = Project.query.filter(
                    and_(Project.name == name, Project.id != project_id)
                ).first()
                if existing_project:
                    return {"error": "Project with this name already exists"}

                project.name = name

            if description is not None:
                project.description = description.strip()

            if status is not None:
                if status not in ["active", "inactive", "expired"]:
                    return {"error": f"Invalid status: {status}"}
                project.status = status

            if subscription_status is not None and is_owner:
                project.subscription_status = subscription_status

            if storage_limit_gb is not None and is_owner:
                if isinstance(storage_limit_gb, (int, float)) and storage_limit_gb >= 0:
                    project.storage_limit = int(storage_limit_gb * (1024**3))
                else:
                    return {"error": "Invalid storage_limit_gb value"}

            db.session.commit()

            try:
                activity_service.log_activity(
                    user,
                    "project_updated",
                    ip=ip_address,
                    details=f"Updated project: {project.name}",
                    user_agent=user_agent,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log project update activity: {e}")

            try:
                self.invalidate_project_cache(project_id)
                from ...services.cache import cache_service
                cache_service.invalidate_pattern("projects:*")
                self.logger.info(f"Cache invalidated after project update: {project_id}")
            except Exception as e:
                self.logger.warning(f"Failed to invalidate cache after project update: {e}")

            return {
                "message": "Project updated successfully",
                "project": {
                    "id": project.id,
                    "name": project.name,
                    "description": project.description,
                    "status": project.status,
                    "subscription_status": project.subscription_status,
                    "storage_limit_gb": project.storage_limit_gb,
                },
            }

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error updating project {project_id}: {str(e)}")
            import traceback
            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return {"error": "Failed to update project", "message": str(e)}

    def delete_project(
        self, project_id: int, user_id: int, ip_address: str = None, user_agent: str = None
    ) -> Dict[str, Any]:
        """
        Delete project and all related data with all business logic

        Args:
            project_id: ID of the project to delete
            user_id: ID of the user deleting the project
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with success message or error
        """
        try:
            from ..activity import activity_service

            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            project = Project.query.get(project_id)
            if not project:
                return {"error": "Project not found"}

            project_name = project.name

            db.session.begin_nested()

            try:

                affected_user_ids = db.session.query(Key.user_id).filter_by(project_id=project_id).distinct().all()
                affected_user_ids = [uid[0] for uid in affected_user_ids if uid[0] is not None]

                Key.query.filter_by(project_id=project_id).delete()

                from ...utils.key_counters import update_user_key_counters
                for user_id in affected_user_ids:
                    update_user_key_counters(user_id, project_id=project_id)
                Game.query.filter_by(project_id=project_id).delete()
                Server.query.filter_by(project_id=project_id).delete()
                User.query.filter_by(project_id=project_id).delete()
                UserActivity.query.filter_by(project_id=project_id).delete()
                ProjectInviteCode.query.filter_by(project_id=project_id).delete()
                ProjectEncryptionKeys.query.filter_by(project_id=project_id).delete()

                db.session.delete(project)

                db.session.commit()

                try:
                    activity_service.log_activity(
                        user,
                        "project_deleted",
                        ip=ip_address,
                        details=f"Deleted project: {project_name}",
                        user_agent=user_agent,
                    )
                except Exception as e:
                    self.logger.warning(f"Failed to log project deletion activity: {e}")

                return {"message": "Project deleted successfully"}

            except Exception as e:

                db.session.rollback()
                raise e

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting project {project_id}: {str(e)}")
            return {"error": "Failed to delete project"}

    def create_project_invite_code(
        self,
        user_id: int,
        expires_in_days: int = 7,
        ip_address: str = None,
        user_agent: str = None,
    ) -> Dict[str, Any]:
        """
        Create a new project invite code with all business logic

        Args:
            user_id: ID of the user creating the invite code
            expires_in_days: Number of days until expiration (default: 7)
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with invite code data or error
        """
        try:
            import random
            import string
            from datetime import datetime, timedelta
            from ..activity import activity_service

            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            from ...utils.rbac_utils import RBACManager
            is_owner = RBACManager.is_owner(user)

            if not user.project_id and not is_owner:
                return {"error": "User must be assigned to a project"}

            project_id = user.project_id if user.project_id else None

            def generate_invite_code():
                """Generate a unique 8-character alphanumeric code"""
                while True:
                    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
                    existing = ProjectInviteCode.query.filter_by(code=code).first()
                    if not existing:
                        return code

            invite_code = generate_invite_code()

            expires_at = (
                datetime.utcnow() + timedelta(days=expires_in_days) if expires_in_days > 0 else None
            )

            new_code = ProjectInviteCode(
                code=invite_code,
                project_id=project_id,
                created_by=user_id,
                expires_at=expires_at,
                is_used=False,
                is_expired=False,
            )

            db.session.add(new_code)
            db.session.commit()

            try:
                activity_service.log_activity(
                    user,
                    "project_invite_code_created",
                    ip=ip_address,
                    details=f"Created project invite code: {invite_code}",
                    user_agent=user_agent,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log invite code creation activity: {e}")

            return {
                "id": new_code.id,
                "code": new_code.code,
                "created_at": new_code.created_at.isoformat() if new_code.created_at else None,
                "expires_at": new_code.expires_at.isoformat() if new_code.expires_at else None,
                "used": new_code.is_used,
                "is_expired": new_code.is_expired,
            }

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating project invite code: {str(e)}")
            return {"error": "Failed to create project invite code"}

    def delete_project_invite_code(
        self, code_id: int, user_id: int, ip_address: str = None, user_agent: str = None
    ) -> Dict[str, Any]:
        """
        Delete a project invite code with all business logic

        Args:
            code_id: ID of the invite code to delete
            user_id: ID of the user deleting the code
            ip_address: IP address for activity logging
            user_agent: User agent for activity logging

        Returns:
            Dictionary with success message or error
        """
        try:
            from ..activity import activity_service

            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            if not user.project_id:
                return {"error": "User must be assigned to a project"}

            project_id = user.project_id

            invite_code = ProjectInviteCode.query.filter_by(id=code_id, project_id=project_id).first()
            if not invite_code:
                return {"error": "Invite code not found"}

            if invite_code.is_used:
                return {"error": "Cannot delete used invite code"}

            code_value = invite_code.code

            db.session.delete(invite_code)
            db.session.commit()

            try:
                activity_service.log_activity(
                    user,
                    "project_invite_code_deleted",
                    ip=ip_address,
                    details=f"Deleted project invite code: {code_value}",
                    user_agent=user_agent,
                )
            except Exception as e:
                self.logger.warning(f"Failed to log invite code deletion activity: {e}")

            return {"message": "Invite code deleted successfully"}

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error deleting project invite code: {str(e)}")
            return {"error": "Failed to delete project invite code"}

    def get_project_invite_codes(self, user_id: int) -> Dict[str, Any]:
        """
        Get all project invite codes for the current user's project

        Args:
            user_id: ID of the user requesting codes

        Returns:
            Dictionary with list of invite codes or error
        """
        try:
            from sqlalchemy import desc
            from ...utils.rbac_utils import RBACManager

            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            is_owner = RBACManager.is_owner(user)

            if not user.project_id and not is_owner:
                return {"error": "User must be assigned to a project"}

            if user.project_id:
                project_id = user.project_id
                invite_codes = (
                    ProjectInviteCode.query.filter_by(project_id=project_id)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .all()
                )
            else:

                invite_codes = (
                    ProjectInviteCode.query.filter_by(project_id=None)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .all()
                )

            codes_data = []
            for code in invite_codes:
                from datetime import datetime
                codes_data.append(
                    {
                        "id": code.id,
                        "code": code.code,
                        "created_at": code.created_at.isoformat() if code.created_at else None,
                        "expires_at": code.expires_at.isoformat() if code.expires_at else None,
                        "used": code.is_used,
                        "is_expired": code.is_expired
                        or (code.expires_at and code.expires_at < datetime.utcnow()),
                    }
                )

            return {"codes": codes_data}

        except Exception as e:
            self.logger.error(f"Error getting project invite codes: {str(e)}")
            return {"error": "Failed to retrieve project invite codes"}

    def get_latest_project_invite_code(self, user_id: int) -> Dict[str, Any]:
        """
        Get the latest project invite code for the current user's project

        Args:
            user_id: ID of the user requesting the code

        Returns:
            Dictionary with latest invite code or error
        """
        try:
            from sqlalchemy import desc
            from datetime import datetime
            from ...utils.rbac_utils import RBACManager

            user = User.query.get(user_id)
            if not user:
                return {"error": "User not found"}

            is_owner = RBACManager.is_owner(user)

            if not user.project_id and not is_owner:
                return {"error": "User must be assigned to a project"}

            if user.project_id:
                project_id = user.project_id
                latest_code = (
                    ProjectInviteCode.query.filter_by(project_id=project_id)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .first()
                )
            else:

                latest_code = (
                    ProjectInviteCode.query.filter_by(project_id=None)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .first()
                )

            if latest_code:
                code_data = {
                    "id": latest_code.id,
                    "code": latest_code.code,
                    "created_at": (
                        latest_code.created_at.isoformat() if latest_code.created_at else None
                    ),
                    "expires_at": (
                        latest_code.expires_at.isoformat() if latest_code.expires_at else None
                    ),
                    "used": latest_code.is_used,
                    "is_expired": latest_code.is_expired
                    or (latest_code.expires_at and latest_code.expires_at < datetime.utcnow()),
                }
                return {"invite_code": code_data}
            else:
                return {"invite_code": None}

        except Exception as e:
            self.logger.error(f"Error getting latest project invite code: {str(e)}")
            return {"error": "Failed to retrieve latest project invite code"}

project_service = ProjectService()
