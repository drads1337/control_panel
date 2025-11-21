"""
Utility functions for maintaining denormalized statistics counters in Project model.
These functions update the counters when users, keys, products, or servers are created,
deleted, or their status changes. This avoids expensive JOIN queries with subqueries.

DEPRECATED: The increment_* and decrement_* functions are deprecated due to race conditions.
Use CachedStatisticsService instead, which uses cached COUNT queries for better data consistency.

For migration, use:
- CachedStatisticsService.invalidate_on_user_change(project_id) instead of increment_project_user_counters
- CachedStatisticsService.invalidate_on_key_change(user_id, project_id) instead of increment_project_key_counters
- CachedStatisticsService.invalidate_on_product_change(project_id) instead of increment_project_product_counters
- CachedStatisticsService.invalidate_on_server_change(project_id) instead of increment_project_server_counters

See: backend/services/statistics/cached_statistics_service.py
"""

from typing import Optional
from datetime import datetime
from sqlalchemy import func, case, and_, or_
from ..core.extensions import db
from ..models.core import Project, User
from ..models.keys import Key
from ..models.products import Product
from ..models.servers import Server

def update_project_counters(project_id: Optional[int]):
    """
    Recalculate and update all statistics counters for a project.

    This function recalculates all counters by querying the related tables.
    Use this when you need to ensure counters are accurate (e.g., after bulk operations or data migrations).

    Args:
        project_id: ID of the project to update counters for
    """
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    total_users = User.query.filter(User.project_id == project_id).count()

    active_users = User.query.filter(
        and_(
            User.project_id == project_id,
            or_(User.expires_at.is_(None), User.expires_at > datetime.utcnow())
        )
    ).count()

    total_keys = Key.query.filter(Key.project_id == project_id).count()

    active_keys = Key.query.filter(
        and_(Key.project_id == project_id, Key.status == 1)
    ).count()

    total_products = Product.query.filter(Product.project_id == project_id).count()

    total_servers = Server.query.filter(Server.project_id == project_id).count()

    project.total_users = total_users
    project.active_users = active_users
    project.total_keys = total_keys
    project.active_keys = active_keys
    project.total_products = total_products
    project.total_servers = total_servers

    db.session.flush()

def increment_project_user_counters(project_id: Optional[int], is_active: bool = True):
    """
    DEPRECATED: This function is deprecated due to race conditions.
    Use CachedStatisticsService.invalidate_on_user_change() instead.
    
    Increment user counters when a new user is created or assigned to a project.

    Args:
        project_id: ID of the project
        is_active: Whether the new user is active (not expired)
    
    Deprecated:
        This function causes race conditions under high concurrency.
        Use CachedStatisticsService.invalidate_on_user_change(project_id) instead.
    """
    import warnings
    warnings.warn(
        "increment_project_user_counters is deprecated. "
        "Use CachedStatisticsService.invalidate_on_user_change() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    project.total_users = (project.total_users or 0) + 1
    if is_active:
        project.active_users = (project.active_users or 0) + 1

    db.session.flush()

def decrement_project_user_counters(project_id: Optional[int], was_active: bool = True):
    """
    DEPRECATED: This function is deprecated due to race conditions.
    Use CachedStatisticsService.invalidate_on_user_change() instead.
    
    Decrement user counters when a user is deleted or removed from a project.

    Args:
        project_id: ID of the project
        was_active: Whether the deleted user was active
    
    Deprecated:
        This function causes race conditions under high concurrency.
        Use CachedStatisticsService.invalidate_on_user_change(project_id) instead.
    """
    import warnings
    warnings.warn(
        "decrement_project_user_counters is deprecated. "
        "Use CachedStatisticsService.invalidate_on_user_change() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    project.total_users = max(0, (project.total_users or 0) - 1)
    if was_active:
        project.active_users = max(0, (project.active_users or 0) - 1)

    db.session.flush()

def update_project_user_counters_on_status_change(
    project_id: Optional[int],
    old_is_active: bool,
    new_is_active: bool
):
    """
    Update active user counter when a user's active status changes.

    Args:
        project_id: ID of the project
        old_is_active: Previous active status of the user
        new_is_active: New active status of the user
    """
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    if old_is_active != new_is_active:
        if old_is_active and not new_is_active:

            project.active_users = max(0, (project.active_users or 0) - 1)
        elif not old_is_active and new_is_active:

            project.active_users = (project.active_users or 0) + 1

    db.session.flush()

def increment_project_key_counters(project_id: Optional[int], is_active: bool = True):
    """
    DEPRECATED: This function is deprecated due to race conditions.
    Use CachedStatisticsService.invalidate_on_key_change() instead.
    
    Increment key counters when a new key is created.

    Args:
        project_id: ID of the project
        is_active: Whether the new key is active (status == 1)
    
    Deprecated:
        This function causes race conditions under high concurrency.
        Use CachedStatisticsService.invalidate_on_key_change(user_id, project_id) instead.
    """
    import warnings
    warnings.warn(
        "increment_project_key_counters is deprecated. "
        "Use CachedStatisticsService.invalidate_on_key_change() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    project.total_keys = (project.total_keys or 0) + 1
    if is_active:
        project.active_keys = (project.active_keys or 0) + 1

    db.session.flush()

def decrement_project_key_counters(project_id: Optional[int], was_active: bool = True):
    """
    DEPRECATED: This function is deprecated due to race conditions.
    Use CachedStatisticsService.invalidate_on_key_change() instead.
    
    Decrement key counters when a key is deleted.

    Args:
        project_id: ID of the project
        was_active: Whether the deleted key was active (status == 1)
    
    Deprecated:
        This function causes race conditions under high concurrency.
        Use CachedStatisticsService.invalidate_on_key_change(user_id, project_id) instead.
    """
    import warnings
    warnings.warn(
        "decrement_project_key_counters is deprecated. "
        "Use CachedStatisticsService.invalidate_on_key_change() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    project.total_keys = max(0, (project.total_keys or 0) - 1)
    if was_active:
        project.active_keys = max(0, (project.active_keys or 0) - 1)

    db.session.flush()

def update_project_key_counters_on_status_change(
    project_id: Optional[int],
    old_status: int,
    new_status: int
):
    """
    Update active key counter when a key's status changes.

    Args:
        project_id: ID of the project
        old_status: Previous status of the key
        new_status: New status of the key
    """
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    was_active = old_status == 1
    is_active = new_status == 1

    if was_active != is_active:
        if was_active and not is_active:

            project.active_keys = max(0, (project.active_keys or 0) - 1)
        elif not was_active and is_active:

            project.active_keys = (project.active_keys or 0) + 1

    db.session.flush()

def increment_project_product_counters(project_id: Optional[int]):
    """
    DEPRECATED: This function is deprecated due to race conditions.
    Use CachedStatisticsService.invalidate_on_product_change() instead.
    
    Increment product counter when a new product is created.

    Args:
        project_id: ID of the project
    
    Deprecated:
        This function causes race conditions under high concurrency.
        Use CachedStatisticsService.invalidate_on_product_change(project_id) instead.
    """
    import warnings
    warnings.warn(
        "increment_project_product_counters is deprecated. "
        "Use CachedStatisticsService.invalidate_on_product_change() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    project.total_products = (project.total_products or 0) + 1
    db.session.flush()

def decrement_project_product_counters(project_id: Optional[int]):
    """
    DEPRECATED: This function is deprecated due to race conditions.
    Use CachedStatisticsService.invalidate_on_product_change() instead.
    
    Decrement product counter when a product is deleted.

    Args:
        project_id: ID of the project
    
    Deprecated:
        This function causes race conditions under high concurrency.
        Use CachedStatisticsService.invalidate_on_product_change(project_id) instead.
    """
    import warnings
    warnings.warn(
        "decrement_project_product_counters is deprecated. "
        "Use CachedStatisticsService.invalidate_on_product_change() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    project.total_products = max(0, (project.total_products or 0) - 1)
    db.session.flush()

def increment_project_server_counters(project_id: Optional[int]):
    """
    DEPRECATED: This function is deprecated due to race conditions.
    Use CachedStatisticsService.invalidate_on_server_change() instead.
    
    Increment server counter when a new server is created.

    Args:
        project_id: ID of the project
    
    Deprecated:
        This function causes race conditions under high concurrency.
        Use CachedStatisticsService.invalidate_on_server_change(project_id) instead.
    """
    import warnings
    warnings.warn(
        "increment_project_server_counters is deprecated. "
        "Use CachedStatisticsService.invalidate_on_server_change() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    project.total_servers = (project.total_servers or 0) + 1
    db.session.flush()

def decrement_project_server_counters(project_id: Optional[int]):
    """
    DEPRECATED: This function is deprecated due to race conditions.
    Use CachedStatisticsService.invalidate_on_server_change() instead.
    
    Decrement server counter when a server is deleted.

    Args:
        project_id: ID of the project
    
    Deprecated:
        This function causes race conditions under high concurrency.
        Use CachedStatisticsService.invalidate_on_server_change(project_id) instead.
    """
    import warnings
    warnings.warn(
        "decrement_project_server_counters is deprecated. "
        "Use CachedStatisticsService.invalidate_on_server_change() instead.",
        DeprecationWarning,
        stacklevel=2
    )
    if not project_id:
        return

    project = Project.query.get(project_id)
    if not project:
        return

    project.total_servers = max(0, (project.total_servers or 0) - 1)
    db.session.flush()

def recalculate_all_project_counters():
    """
    Recalculate statistics counters for all projects.
    This is useful for initializing counters or fixing inconsistencies.
    """
    from datetime import datetime

    projects = Project.query.all()

    for project in projects:
        update_project_counters(project.id)

    db.session.flush()
