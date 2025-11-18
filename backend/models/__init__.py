"""
Models package - organized by domain

This package contains all database models organized by domain:
- core.py: Core models (User, Project, ProjectSettings, etc.)
- games.py: Game-related models
- keys.py: Key and device models
- loaders.py: Loader models
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
    from ..models.games import Game
    from ..models.security import LoginAttempt, BlockedIP

This approach:
- Provides full IDE autocomplete support
- Makes dependencies explicit and easier to track
- Has better performance (no dynamic import overhead)
- Works with static type checkers (mypy, pyright)

BACKWARD COMPATIBILITY: Importing from this package is still supported:
    from ..models import User, Project, Game

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
# Explicit imports for all models - provides better IDE support and makes dependencies clear
# Models are organized by domain to keep related models together

# Core models
from .core import (
    APIKey,
    DeveloperGamePermission,
    Project,
    ProjectEncryptionKeys,
    ProjectInviteCode,
    ProjectSettings,
    SystemBackup,
    SystemSettings,
    User,
    UserActionLog,
    UserActivity,
    UserGamePermission,
)

# Game models
from .games import (
    Announcement,
    ChangelogEntry,
    FileDownloadLog,
    FileMeta,
    Game,
    GameChatSettings,
    GameConfiguration,
    GameExtraFile,
    GameFileConfig,
    GameFileDownload,
    GameInviteCode,
    GameKeyPrice,
    GameSecurityLog,
    GameStatus,
    Message,
)

# Key models
from .keys import (
    ConnectToken,
    DeviceInfo,
    Key,
    KeyAnalytics,
    ReferralCode,
    TokenTransaction,
)

# Loader models
from .loaders import (
    Loader,
    LoaderChangelog,
    LoaderConfiguration,
    LoaderDownloadLog,
    LoaderGameAssignment,
    LoaderNotification,
)

# RBAC models
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

# Security models
from .security import (
    BlockedFingerprint,
    BlockedHWID,
    BlockedIP,
    LoginAttempt,
    SecurityAnalytics,
    SecurityEvent,
    SecurityRule,
    TwoFactorAuth,
    TwoFactorBackupCode,
    TwoFactorSession,
)

# Project-User models
from .project_user import (
    ProjectAdmin,
    ProjectUserRole,
)

# Other models
from .notifications import Notification
from .webhooks import Webhook, WebhookLog
from .servers import Billing, ProjectAPIKey, Server
from .chat import (
    ChatGroup,
    ChatGroupGame,
    ChatMessage,
    DiscordWebhook,
    TelegramBot,
)
from .remote_control import (
    RemoteCategory,
    RemoteFeature,
    RemoteFeatureLog,
)

# Auto-generate __all__ from imports to avoid duplication
# This keeps the list in sync with imports automatically
import sys
_current_module = sys.modules[__name__]
__all__ = sorted([
    name for name in dir(_current_module)
    if not name.startswith('_') and name not in ('sys', '_current_module')
    and hasattr(getattr(_current_module, name, None), '__module__')
])
del sys, _current_module
