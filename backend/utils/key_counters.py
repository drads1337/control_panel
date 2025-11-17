"""
Utility functions for maintaining denormalized key counters in User model.
These functions update the total_keys and active_keys fields when keys are created,
deleted, or their status changes.
"""

from typing import Optional
from sqlalchemy import func, case
from ..core.extensions import db
from ..models import Key, User


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
    
    # Build query for counting keys
    query = Key.query.filter(Key.user_id == user_id)
    if project_id:
        query = query.filter(Key.project_id == project_id)
    
    # Count total keys
    total_keys = query.count()
    
    # Count active keys (status == 1)
    active_keys = query.filter(Key.status == 1).count()
    
    # Update user counters
    user.total_keys = total_keys
    user.active_keys = active_keys
    
    # Don't commit here - let the caller handle the transaction
    db.session.flush()


def increment_user_key_counters(user_id: Optional[int], is_active: bool = True):
    """
    Increment key counters when a new key is created.
    
    Args:
        user_id: ID of the user who owns the key
        is_active: Whether the new key is active (status == 1)
    """
    if not user_id:
        return
    
    user = User.query.get(user_id)
    if not user:
        return
    
    user.total_keys = (user.total_keys or 0) + 1
    if is_active:
        user.active_keys = (user.active_keys or 0) + 1
    
    # Don't commit here - let the caller handle the transaction
    db.session.flush()


def decrement_user_key_counters(user_id: Optional[int], was_active: bool = True):
    """
    Decrement key counters when a key is deleted.
    
    Args:
        user_id: ID of the user who owned the key
        was_active: Whether the deleted key was active (status == 1)
    """
    if not user_id:
        return
    
    user = User.query.get(user_id)
    if not user:
        return
    
    user.total_keys = max(0, (user.total_keys or 0) - 1)
    if was_active:
        user.active_keys = max(0, (user.active_keys or 0) - 1)
    
    # Don't commit here - let the caller handle the transaction
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
    
    # Only update if the active status actually changed
    if was_active != is_active:
        if was_active and not is_active:
            # Key became inactive
            user.active_keys = max(0, (user.active_keys or 0) - 1)
        elif not was_active and is_active:
            # Key became active
            user.active_keys = (user.active_keys or 0) + 1
    
    # Don't commit here - let the caller handle the transaction
    db.session.flush()


def recalculate_all_user_key_counters(project_id: Optional[int] = None):
    """
    Recalculate key counters for all users.
    This is useful for initializing counters or fixing inconsistencies.
    
    Args:
        project_id: Optional project_id filter for keys
    """
    
    # Build base query
    query = db.session.query(
        Key.user_id,
        func.count(Key.id).label('total_keys'),
        func.sum(case((Key.status == 1, 1), else_=0)).label('active_keys')
    )
    
    if project_id:
        query = query.filter(Key.project_id == project_id)
    
    # Group by user_id
    key_counts = query.group_by(Key.user_id).all()
    
    # Update all users
    for user_id, total_keys, active_keys in key_counts:
        user = User.query.get(user_id)
        if user:
            user.total_keys = total_keys or 0
            user.active_keys = active_keys or 0
    
    # Set counters to 0 for users with no keys
    users_query = User.query
    if project_id:
        users_query = users_query.filter(User.project_id == project_id)
    
    users_with_keys = {user_id for user_id, _, _ in key_counts}
    users_without_keys = users_query.filter(~User.id.in_(users_with_keys) if users_with_keys else True).all()
    
    for user in users_without_keys:
        user.total_keys = 0
        user.active_keys = 0
    
    # Don't commit here - let the caller handle the transaction
    db.session.flush()

