"""
Core models - Backward compatibility module

This module provides backward compatibility imports for models that have been
split into separate files:
- User models -> models/user.py
- Project models -> models/project.py
- System models -> models/system.py

For new code, import directly from the specific modules:
    from ..models.user import User, UserActivity
    from ..models.project import Project, ProjectSettings
    from ..models.system import SystemSettings, APIKey
"""


from .user import (
    DeveloperProductPermission,
    User,
    UserActionLog,
    UserActivity,
    UserProductPermission,
)

from .project import (
    Project,
    ProjectAppearanceSettings,
    ProjectBackupSettings,
    ProjectChatSettings,
    ProjectEncryptionKeys,
    ProjectEncryptionSettings,
    ProjectInviteCode,
    ProjectInviteSettings,
    ProjectOfflineAuthSettings,
    ProjectSecuritySettings,
    ProjectSettings,
    ProjectSystemSettings,
)

from .system import (
    APIKey,
    SystemBackup,
    SystemSettings,
)


__all__ = [

    "User",
    "UserActivity",
    "UserActionLog",
    "UserProductPermission",
    "DeveloperProductPermission",

    "Project",
    "ProjectEncryptionKeys",
    "ProjectSecuritySettings",
    "ProjectSystemSettings",
    "ProjectEncryptionSettings",
    "ProjectBackupSettings",
    "ProjectChatSettings",
    "ProjectOfflineAuthSettings",
    "ProjectAppearanceSettings",
    "ProjectInviteSettings",
    "ProjectSettings",
    "ProjectInviteCode",

    "SystemSettings",
    "APIKey",
    "SystemBackup",
]
