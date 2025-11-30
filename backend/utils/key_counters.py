"""
Utility functions for maintaining denormalized key counters in User model.
These functions recalculate counters by querying the Key table directly.

NOTE: For cache invalidation when keys change, use CachedStatisticsService.invalidate_on_key_change()
instead of manually updating counters. This prevents race conditions and ensures data consistency.

See: backend/services/statistics/cached_statistics_service.py
"""

from typing import Optional
from sqlalchemy import func, case
from ..core.extensions import db
from ..models import Key, User
from ...utils.service_helpers import get_service

def _get_cached_statistics_service():
    """Get cached_statistics_service through app context (DI pattern) - requires app context"""
    from flask import current_app
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            "Service container not initialized. Cannot get 'cached_statistics_service'. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get('cached_statistics_service')

def update_user_key_counters(user_id: Optional[int], project_id: Optional[int] = None):
    """
    Recalculate and update key counters for a user.

    This function recalculates the total_keys and active_keys for a user
    by querying the Key table. Use this when you need to ensure counters
    are accurate (e.g., after bulk operations or data migrations).

    Args:
        user_id: ID of the user to update counters for
        project_id: Optional project_id filter for keys
    """
    if not user_id:
        return

    user = User.query.get(user_id)
    if not user:
        return

    query = Key.query.filter(Key.user_id == user_id)
    if project_id:
        query = query.filter(Key.project_id == project_id)

    total_keys = query.count()

    active_keys = query.filter(Key.status == 1).count()

    user.total_keys = total_keys
    user.active_keys = active_keys

    db.session.flush()

def update_user_key_counters_on_status_change(
    user_id: Optional[int], 
    old_status: int, 
    new_status: int
):
    """
    Update key counters when a key's status changes.

    Args:
        user_id: ID of the user who owns the key
        old_status: Previous status of the key
        new_status: New status of the key
    """
    if not user_id:
        return

    user = User.query.get(user_id)
    if not user:
        return

    was_active = old_status == 1
    is_active = new_status == 1

    if was_active != is_active:
        if was_active and not is_active:

            user.active_keys = max(0, (user.active_keys or 0) - 1)
        elif not was_active and is_active:

            user.active_keys = (user.active_keys or 0) + 1

    db.session.flush()

def recalculate_all_user_key_counters(project_id: Optional[int] = None):
    """
    Recalculate key counters for all users.
    This is useful for initializing counters or fixing inconsistencies.

    Args:
        project_id: Optional project_id filter for keys
    """

    query = db.session.query(
        Key.user_id,
        func.count(Key.id).label('total_keys'),
        func.sum(case((Key.status == 1, 1), else_=0)).label('active_keys')
    )

    if project_id:
        query = query.filter(Key.project_id == project_id)

    key_counts = query.group_by(Key.user_id).all()

    for user_id, total_keys, active_keys in key_counts:
        user = User.query.get(user_id)
        if user:
            user.total_keys = total_keys or 0
            user.active_keys = active_keys or 0

    users_query = User.query
    if project_id:
        users_query = users_query.filter(User.project_id == project_id)

    users_with_keys = {user_id for user_id, _, _ in key_counts}
    users_without_keys = users_query.filter(~User.id.in_(users_with_keys) if users_with_keys else True).all()

    for user in users_without_keys:
        user.total_keys = 0
        user.active_keys = 0

    db.session.flush()
