"""
Project Cache Service
Handles caching operations for projects

Single Responsibility: Project data caching and retrieval
Extracted from ProjectService to follow SRP (Single Responsibility Principle)
"""

import logging
from typing import Any, Dict, Optional

from sqlalchemy import func

from ...core.extensions import db
from ...models.core import Project, User
from ...utils.fulltext_search import fulltext_search_filter
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles
from ...utils.service_exceptions import ServiceError

class ProjectCacheService:
    """
    Service for handling project caching operations.
    
    Single Responsibility: Cache project data and provide cached retrieval methods.
    """

    def __init__(self, cache_service=None, logger=None, project_crud_service=None):
        self._project_crud_service = project_crud_service
        self.cache_service = cache_service
        self.logger = logger or logging.getLogger(__name__)

    @property
    def _cache_service(self):
        """Get cache service instance via DI container"""
        if self.cache_service is not None:
            return self.cache_service
        # SECURITY: Dependency should be injected via __init__
        # If not injected, raise error instead of using get_service()
        raise ServiceError(
            "CacheService dependency not injected",
            status_code=500
        )

    def get_projects_cached(
        self, user_id: int, page: int = 1, per_page: int = 20, search: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get projects with caching support

        Args:
            user_id: ID of the user requesting projects
            page: Page number (default: 1)
            per_page: Items per page (default: 20)
            search: Search query (optional)

        Returns:
            Dictionary with projects list and pagination info
        """
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

                query = Project.query

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
                    # For owners, exclude system project used for owner roles
                    query = query.filter(Project.name != "__SYSTEM_OWNER_ROLES__")
                    self.logger.info(f"[FETCH] User is owner, showing all projects except system project")

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

                projects = []
                self.logger.info(f"[FETCH] Processing {len(pagination.items)} project items")

                for idx, project in enumerate(pagination.items):
                    self.logger.info(
                        f"[FETCH] Processing project {idx+1}/{len(pagination.items)}: "
                        f"id={project.id}, name={project.name}, status={project.status}"
                    )
                    projects.append(
                        {
                            "id": project.unique_id,
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
                                "products": project.total_products or 0,
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
                    f"[FETCH] Returning {len(projects)} projects (page {page} of {pagination.pages})"
                )
                return result

            except Exception as e:
                self.logger.error(f"[FETCH] Error fetching projects: {e}", exc_info=True)
                return {
                    "projects": [],
                    "total": 0,
                    "pages": 0,
                    "current_page": page,
                    "per_page": per_page,
                    "error": str(e),
                }

        # Try to get from cache first
        cache_key = f"projects:user_id={user_id}:page={page}:per_page={per_page}:search={search or ''}"
        
        try:
            cached_result = self._cache_service.get(cache_key)
            if cached_result:
                self.logger.info(f"[CACHE] Cache hit for projects: user_id={user_id}, page={page}")
                return cached_result
        except Exception as e:
            self.logger.warning(f"[CACHE] Error getting from cache: {e}")

        # Cache miss - fetch from database
        self.logger.info(f"[CACHE] Cache miss for projects: user_id={user_id}, page={page}")
        result = fetch_projects()

        # Store in cache
        try:
            self._cache_service.set(cache_key, result, ttl=300)  # 5 minutes TTL
            self.logger.info(f"[CACHE] Stored projects in cache: user_id={user_id}, page={page}")
        except Exception as e:
            self.logger.warning(f"[CACHE] Error storing in cache: {e}")

        return result

    def get_project_cached(self, project_id: int, user_id: int) -> Dict[str, Any]:
        """
        Get a single project with caching support

        Args:
            project_id: ID of the project
            user_id: ID of the user requesting the project

        Returns:
            Dictionary with project data or error
        """
        def fetch_project():
            """Fetch project from database"""
            try:
                
                if not self._project_crud_service:
                    raise ServiceError(
                        "Project Crud Service dependency not injected",
                        status_code=500
                    )
                project_crud_service = self._project_crud_service
                project = project_crud_service._find_project_by_id_or_unique_id(project_id)
                if not self._project_crud_service:
                    raise ServiceError(
                        "Project Crud Service dependency not injected",
                        status_code=500
                    )
                project_crud_service = self._project_crud_service
                if not project:
                    return {"error": "Project not found"}

                user = User.query.get(user_id)
                if not user:
                    return {"error": "User not found"}

                is_owner = RBACManager.is_owner(user)
                if not is_owner and user.project_id != project.id:
                    return {"error": "Access denied"}

                result = {
                    "id": project.unique_id,
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
                    "storage_limit_gb": project.storage_limit_gb,
                }
                self.logger.info(f"[FETCH] Project data - unique_id: {project.unique_id}, result keys: {list(result.keys())}")
                return result
            except Exception as e:
                self.logger.error(f"Error fetching project: {e}", exc_info=True)
                return {"error": "Failed to retrieve project"}

        # Try to get from cache first
        # v2: Added unique_id and days_until_expiry to response
        cache_key = f"project:v2:project_id={project_id}:user_id={user_id}"
        
        try:
            cached_result = self._cache_service.get(cache_key)
            if cached_result:
                self.logger.info(f"[CACHE] Cache hit for project: project_id={project_id}")
                self.logger.info(f"[CACHE] Cached result keys: {list(cached_result.keys()) if isinstance(cached_result, dict) else 'not a dict'}")
                self.logger.info(f"[CACHE] Has unique_id? {('unique_id' in cached_result) if isinstance(cached_result, dict) else 'N/A'}")
                # If cached result doesn't have unique_id, invalidate and fetch fresh
                if isinstance(cached_result, dict) and 'unique_id' not in cached_result:
                    self.logger.warning(f"[CACHE] Cached result missing unique_id, invalidating cache")
                    try:
                        self._cache_service.delete(cache_key)
                    except:
                        pass
                    cached_result = None
                else:
                    return cached_result
        except Exception as e:
            self.logger.warning(f"[CACHE] Error getting from cache: {e}")

        # Cache miss - fetch from database
        self.logger.info(f"[CACHE] Cache miss for project: project_id={project_id}")
        result = fetch_project()

        # Store in cache (only if successful)
        if "error" not in result:
            try:
                self._cache_service.set(cache_key, result, ttl=300)  # 5 minutes TTL
                self.logger.info(f"[CACHE] Stored project in cache: project_id={project_id}")
            except Exception as e:
                self.logger.warning(f"[CACHE] Error storing in cache: {e}")

        return result

    def get_project_stats_cached(self, project_id: int, user_id: int) -> Dict[str, Any]:
        """
        Get project statistics with caching support

        Args:
            project_id: ID of the project
            user_id: ID of the user requesting statistics

        Returns:
            Dictionary with project statistics or error
        """
        def fetch_project_stats():
            """Fetch project statistics from database"""
            try:
                if not self._project_crud_service:
                    raise ServiceError(
                        "ProjectCRUDService dependency not injected",
                        status_code=500
                    )
                project = self._project_crud_service._find_project_by_id_or_unique_id(project_id)
                if not project:
                    return {"error": "Project not found"}

                user = User.query.get(user_id)
                if not user:
                    return {"error": "User not found"}

                is_owner = RBACManager.is_owner(user)
                if not is_owner and user.project_id != project.id:
                    return {"error": "Access denied"}

                # Use denormalized counters from Project model
                stats = {
                    "total_users": project.total_users or 0,
                    "total_keys": project.total_keys or 0,
                    "active_keys": project.active_keys or 0,
                    "total_products": project.total_products or 0,
                    "total_servers": project.total_servers or 0,
                }

                return {
                    "project_id": project_id,
                    "stats": stats,
                }
            except Exception as e:
                self.logger.error(f"Error fetching project stats: {e}", exc_info=True)
                return {"error": "Failed to retrieve project statistics"}

        # Try to get from cache first
        cache_key = f"project_stats:project_id={project_id}:user_id={user_id}"
        
        try:
            cached_result = self._cache_service.get(cache_key)
            if cached_result:
                self.logger.info(f"[CACHE] Cache hit for project stats: project_id={project_id}")
                return cached_result
        except Exception as e:
            self.logger.warning(f"[CACHE] Error getting from cache: {e}")

        # Cache miss - fetch from database
        self.logger.info(f"[CACHE] Cache miss for project stats: project_id={project_id}")
        result = fetch_project_stats()

        # Store in cache (only if successful)
        if "error" not in result:
            try:
                self._cache_service.set(cache_key, result, ttl=60)  # 1 minute TTL for stats
                self.logger.info(f"[CACHE] Stored project stats in cache: project_id={project_id}")
            except Exception as e:
                self.logger.warning(f"[CACHE] Error storing in cache: {e}")

        return result

    def invalidate_project_cache(self, project_id: int) -> bool:
        """
        Invalidate project cache

        Args:
            project_id: ID of the project

        Returns:
            True if successful, False otherwise
        """
        try:
            # Invalidate all cache keys related to this project
            patterns = [
                f"project:project_id={project_id}:*",
                f"project_stats:project_id={project_id}:*",
                "projects:*",  # Invalidate all projects lists
            ]
            
            for pattern in patterns:
                try:
                    self._cache_service.invalidate_pattern(pattern)
                    self.logger.info(f"Invalidated cache pattern: {pattern}")
                except Exception as e:
                    self.logger.warning(f"Error invalidating pattern {pattern}: {e}")
            
            self.logger.info(f"Project cache invalidated for project {project_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error invalidating project cache: {e}")
            return False
