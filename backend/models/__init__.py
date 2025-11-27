"""
Models package - organized by domain

This package contains all database models organized by domain:
- core.py: Core models (User, Project, ProjectSettings, etc.)
- products.py: Product-related models (formerly Product-related, universal terminology)
- keys.py: Key and device models
- agents.py: Agent-related models (formerly Agent-related, universal terminology)
- security.py: Security models (2FA, login attempts, etc.)
- rbac.py: RBAC models (Role, Permission, etc.)
- chat.py: Chat models
- webhooks.py: Webhook models
- servers.py: Server models
- notifications.py: Notification models
- remote_control.py: Remote control models
- project_user.py: Project-User relationship models
- utils.py: Utility functions

IMPORT GUIDELINES:
==================

RECOMMENDED: Import models directly from their modules for better IDE support and performance:
    from ..models.core import User, Project
    from ..models.products import Product  # Universal name (Product is alias for backward compatibility)
    from ..models.agents import Agent  # Universal name (Agent is alias for backward compatibility)
    from ..models.security import LoginAttempt, BlockedIP

This approach:
- Provides full IDE autocomplete support
- Makes dependencies explicit and easier to track
- Has better performance (no dynamic import overhead)
- Works with static type checkers (mypy, pyright)

BACKWARD COMPATIBILITY: Importing from this package is still supported:
    from ..models import User, Project, Product

Note: All models are now imported explicitly at package load time. This is safe because:
1. There are no circular dependencies between model modules
2. Circular relationships in SQLAlchemy are handled using string references (e.g., "Project", "User")
3. The slight startup cost is negligible compared to the benefits of explicit imports

WHY NOT LAZY LOADING?
=====================

The previous lazy loading mechanism using __getattr__ was removed because:
1. No real circular dependencies exist between model modules (verified)
2. SQLAlchemy relationships use string references, avoiding import-time cycles
3. Lazy loading hurts IDE support (no autocomplete, type checking)
4. Makes dependencies non-obvious and harder to maintain
5. Minimal startup time benefit (models load quickly anyway)

If you encounter import issues, check:
- Are you importing models at module level when they're only needed in functions?
- Consider moving imports inside functions for truly optional dependencies
- Ensure SQLAlchemy relationships use string references, not direct model classes
"""

from .core import (
    APIKey,
    DeveloperProductPermission,
    Project,
    ProjectEncryptionKeys,
    ProjectInviteCode,
    ProjectSettings,
    SystemBackup,
    SystemSettings,
    User,
    UserActionLog,
    UserActivity,
    UserProductPermission,
)

from .products import (
    Announcement,
    ChangelogEntry,
    FeatureConfigSchema,
    FileDownloadLog,
    FileMeta,
    Message,
    Product,
    ProductChatSettings,
    ProductExtraFile,
    ProductFileConfig,
    ProductFileDownload,
    ProductInviteCode,
    ProductKeyPrice,
    ProductSecurityLog,
    ProductStatus,
    RemoteConfig,
)

from .keys import (
    ConnectToken,
    DeviceInfo,
    Key,
    KeyAnalytics,
    ReferralCode,
    TokenTransaction,
)

from .agents import (
    Agent,
    AgentChangelog,
    AgentConfiguration,
    AgentDownloadLog,
    AgentNotification,
    AgentProductAssignment,
)

from .rbac import (
    AttributeRule,
    Permission,
    ResourceAttribute,
    Role,
    RolePermission,
    UserAttribute,
    UserPermission,
    UserRole,
)

from .security import (
    BlockedDeviceFingerprint,  # New universal name
    BlockedFingerprint,
    BlockedHWID,  # Backward compatibility alias
    BlockedIP,
    LoginAttempt,
    SecurityAnalytics,
    SecurityEvent,
    SecurityRule,
    TwoFactorAuth,
    TwoFactorBackupCode,
    TwoFactorSession,
)

from .project_user import (
    ProjectAdmin,
    ProjectUserRole,
)

from .notifications import Notification
from .webhooks import Webhook, WebhookLog, WebhookPendingTask
from .servers import Billing, ProjectAPIKey, Server
from .chat import (
    ChatGroup,
    ChatGroupProduct,
    ChatMessage,
    DiscordWebhook,
    TelegramBot,
)
from .remote_control import (
    RemoteCategory,
    RemoteFeature,
    RemoteFeatureLog,
)

# Explicit __all__ for better IDE support and static type checking
# This replaces the dynamic __all__ generation that breaks autocomplete
__all__ = [
    # Core models
    "APIKey",
    "DeveloperProductPermission",
    "Project",
    "ProjectEncryptionKeys",
    "ProjectInviteCode",
    "ProjectSettings",
    "SystemBackup",
    "SystemSettings",
    "User",
    "UserActionLog",
    "UserActivity",
    "UserProductPermission",
    # Product models
    "Announcement",
    "ChangelogEntry",
    "FeatureConfigSchema",
    "FileDownloadLog",
    "FileMeta",
    "Message",
    "Product",
    "ProductChatSettings",
    "ProductExtraFile",
    "ProductFileConfig",
    "ProductFileDownload",
    "ProductInviteCode",
    "ProductKeyPrice",
    "ProductSecurityLog",
    "ProductStatus",
    "RemoteConfig",
    # Key models
    "ConnectToken",
    "DeviceInfo",
    "Key",
    "KeyAnalytics",
    "ReferralCode",
    "TokenTransaction",
    # Agent models
    "Agent",
    "AgentChangelog",
    "AgentConfiguration",
    "AgentDownloadLog",
    "AgentNotification",
    "AgentProductAssignment",
    # RBAC models
    "AttributeRule",
    "Permission",
    "ResourceAttribute",
    "Role",
    "RolePermission",
    "UserAttribute",
    "UserPermission",
    "UserRole",
    # Security models
    "BlockedDeviceFingerprint",
    "BlockedFingerprint",
    "BlockedHWID",
    "BlockedIP",
    "LoginAttempt",
    "SecurityAnalytics",
    "SecurityEvent",
    "SecurityRule",
    "TwoFactorAuth",
    "TwoFactorBackupCode",
    "TwoFactorSession",
    # Project-User models
    "ProjectAdmin",
    "ProjectUserRole",
    # Other models
    "Notification",
    "Webhook",
    "WebhookLog",
    "WebhookPendingTask",
    "Billing",
    "ProjectAPIKey",
    "Server",
    "ChatGroup",
    "ChatGroupProduct",
    "ChatMessage",
    "DiscordWebhook",
    "TelegramBot",
    "RemoteCategory",
    "RemoteFeature",
    "RemoteFeatureLog",
]
