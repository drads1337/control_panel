"""
Utility functions for maintaining denormalized statistics counters in Project model.
These functions update the counters when users, keys, games, or servers are created,
deleted, or their status changes. This avoids expensive JOIN queries with subqueries.
"""

from typing import Optional
from datetime import datetime
from sqlalchemy import func, case, and_, or_
from ..core.extensions import db
from ..models.core import Project, User
from ..models.keys import Key
from ..models.games import Game
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
    
    # Count total users
    total_users = User.query.filter(User.project_id == project_id).count()
    
    # Count active users (not expired)
    active_users = User.query.filter(
        and_(
            User.project_id == project_id,
            or_(User.expires_at.is_(None), User.expires_at > datetime.utcnow())
        )
    ).count()
    
    # Count total keys
    total_keys = Key.query.filter(Key.project_id == project_id).count()
    
    # Count active keys (status == 1)
    active_keys = Key.query.filter(
        and_(Key.project_id == project_id, Key.status == 1)
    ).count()
    
    # Count total games
    total_games = Game.query.filter(Game.project_id == project_id).count()
    
    # Count total servers
    total_servers = Server.query.filter(Server.project_id == project_id).count()
    
    # Update project counters
    project.total_users = total_users
    project.active_users = active_users
    project.total_keys = total_keys
    project.active_keys = active_keys
    project.total_games = total_games
    project.total_servers = total_servers
    
    # Don't commit here - let the caller handle the transaction
    db.session.flush()


def increment_project_user_counters(project_id: Optional[int], is_active: bool = True):
    """
    Increment user counters when a new user is created or assigned to a project.
    
    Args:
        project_id: ID of the project
        is_active: Whether the new user is active (not expired)
    """
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
    Decrement user counters when a user is deleted or removed from a project.
    
    Args:
        project_id: ID of the project
        was_active: Whether the deleted user was active
    """
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
    
    # Only update if the active status actually changed
    if old_is_active != new_is_active:
        if old_is_active and not new_is_active:
            # User became inactive
            project.active_users = max(0, (project.active_users or 0) - 1)
        elif not old_is_active and new_is_active:
            # User became active
            project.active_users = (project.active_users or 0) + 1
    
    db.session.flush()


def increment_project_key_counters(project_id: Optional[int], is_active: bool = True):
    """
    Increment key counters when a new key is created.
    
    Args:
        project_id: ID of the project
        is_active: Whether the new key is active (status == 1)
    """
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
    Decrement key counters when a key is deleted.
    
    Args:
        project_id: ID of the project
        was_active: Whether the deleted key was active (status == 1)
    """
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
    
    # Only update if the active status actually changed
    if was_active != is_active:
        if was_active and not is_active:
            # Key became inactive
            project.active_keys = max(0, (project.active_keys or 0) - 1)
        elif not was_active and is_active:
            # Key became active
            project.active_keys = (project.active_keys or 0) + 1
    
    db.session.flush()


def increment_project_game_counters(project_id: Optional[int]):
    """
    Increment game counter when a new game is created.
    
    Args:
        project_id: ID of the project
    """
    if not project_id:
        return
    
    project = Project.query.get(project_id)
    if not project:
        return
    
    project.total_games = (project.total_games or 0) + 1
    db.session.flush()


def decrement_project_game_counters(project_id: Optional[int]):
    """
    Decrement game counter when a game is deleted.
    
    Args:
        project_id: ID of the project
    """
    if not project_id:
        return
    
    project = Project.query.get(project_id)
    if not project:
        return
    
    project.total_games = max(0, (project.total_games or 0) - 1)
    db.session.flush()


def increment_project_server_counters(project_id: Optional[int]):
    """
    Increment server counter when a new server is created.
    
    Args:
        project_id: ID of the project
    """
    if not project_id:
        return
    
    project = Project.query.get(project_id)
    if not project:
        return
    
    project.total_servers = (project.total_servers or 0) + 1
    db.session.flush()


def decrement_project_server_counters(project_id: Optional[int]):
    """
    Decrement server counter when a server is deleted.
    
    Args:
        project_id: ID of the project
    """
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
    
    # Get all projects
    projects = Project.query.all()
    
    for project in projects:
        update_project_counters(project.id)
    
    # Don't commit here - let the caller handle the transaction
    db.session.flush()

