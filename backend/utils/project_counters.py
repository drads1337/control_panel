"""
Utility functions for maintaining denormalized statistics counters in Project model.
These functions recalculate counters by querying related tables directly.

NOTE: For cache invalidation when data changes, use CachedStatisticsService methods:
- CachedStatisticsService.invalidate_on_user_change(project_id)
- CachedStatisticsService.invalidate_on_key_change(user_id, project_id)
- CachedStatisticsService.invalidate_on_product_change(project_id)
- CachedStatisticsService.invalidate_on_server_change(project_id)

This prevents race conditions and ensures data consistency.

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
from .service_helpers import get_service

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

def increment_project_product_counters(project_id: Optional[int]):
    """
    Increment product counter for a project.
    
    NOTE: This function now uses cache invalidation instead of direct counter updates
    # Get service through app context (DI pattern) - requires app context
    from flask import current_app
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. Cannot get 'cached_statistics_service'. "
            "Make sure init_services() was called during app initialization."
        )
    cached_statistics_service = current_app.service_container.get('cached_statistics_service')
    to prevent race conditions. The counter will be recalculated on the next read.
    
    Args:
        project_id: ID of the project to update counters for
    """
    if not project_id:
        return
    
    # Use cache invalidation instead of direct counter updates
    # The counter will be recalculated automatically when needed
    # Get service inside function (DI pattern - avoid module-level service access)
    try:
        # Get service through app context (DI pattern) - requires app context
        from flask import current_app
        if hasattr(current_app, 'service_container'):
            cached_statistics_service = current_app.service_container.get('cached_statistics_service')
            cached_statistics_service.invalidate_on_product_change(project_id)
    except (RuntimeError, AttributeError, Exception):
        # Service might not be available in all contexts (e.g., migrations)
        pass
    
    # Also increment the counter directly for immediate consistency
    project = Project.query.get(project_id)
    if project:
        project.total_products = (project.total_products or 0) + 1
        db.session.flush()
