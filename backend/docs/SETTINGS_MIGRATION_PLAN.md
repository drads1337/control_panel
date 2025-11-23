# Settings Migration Plan

## Overview

This document outlines the plan to complete the migration from the monolithic `ProjectSettings` model to specialized settings models.

## Current State

The codebase currently uses a hybrid approach:
- **Legacy**: `ProjectSettings` model contains all settings in one table
- **New**: Specialized models (`ProjectSecuritySettings`, `ProjectSystemSettings`, etc.)
- **Helper**: `ProjectSettingsHelper` provides fallback from new models to legacy

## Target State

- All settings should be read from specialized models only
- `ProjectSettings` model should be deprecated/removed
- No fallback logic should exist

## Specialized Models

1. `ProjectSecuritySettings` - Security-related settings
2. `ProjectSystemSettings` - System configuration
3. `ProjectEncryptionSettings` - Encryption configuration
4. `ProjectBackupSettings` - Backup configuration
5. `ProjectChatSettings` - Chat configuration
6. `ProjectOfflineAuthSettings` - Offline authentication
7. `ProjectAppearanceSettings` - Appearance/UI settings
8. `ProjectInviteSettings` - Invite code settings

## Migration Steps

### Phase 1: Data Migration (One-time)

Create a migration script to copy all data from `ProjectSettings` to specialized models:

```python
# scripts/migrate_settings_data.py
def migrate_all_projects():
    """Migrate all projects' settings from ProjectSettings to specialized models"""
    projects = Project.query.all()
    for project in projects:
        migrate_project_settings(project.id)
```

### Phase 2: Update Repository Layer

**Current (`settings_repository.py`):**
```python
def get_or_create_project_settings(self, project_id: int) -> ProjectSettings:
    return ProjectSettings.query.filter_by(project_id=project_id).first() or \
           self.create_project_settings(project_id)
```

**Target:**
```python
def get_security_settings(self, project_id: int) -> ProjectSecuritySettings:
    settings = ProjectSecuritySettings.query.filter_by(project_id=project_id).first()
    if not settings:
        settings = self.create_security_settings(project_id)
    return settings

# Repeat for each specialized model
```

### Phase 3: Update Service Layer

**Current (`settings_manager.py`):**
```python
def get_settings(self, user_id: int, project_id: Optional[int] = None):
    settings = self.repository.get_or_create_project_settings(project_id)
    # Build response from ProjectSettings fields
```

**Target:**
```python
def get_settings(self, user_id: int, project_id: Optional[int] = None):
    security_settings = self.repository.get_security_settings(project_id)
    system_settings = self.repository.get_system_settings(project_id)
    # ... get all specialized settings
    # Build response from specialized models
```

### Phase 4: Remove Fallback Logic

**Remove from `ProjectSettingsHelper`:**
- `_get_legacy_settings()` method
- All fallback logic in `get_*_settings()` methods
- Migration logic (data should already be migrated)

### Phase 5: Update All Direct Usage

Find and update all places that directly query `ProjectSettings`:

**Files to update:**
- `routes/settings.py` - Remove `get_or_create_project_settings()`
- `routes/chat.py` - Update to use `ProjectChatSettings`
- `services/connect/connect_service.py` - Update to use specialized settings
- `services/servers/server_service.py` - Update to use specialized settings
- `services/security/security_service.py` - Update to use `ProjectSecuritySettings`
- `utils/secure_crypto.py` - Update to use `ProjectEncryptionSettings`

**Pattern:**
```python
# Before
settings = ProjectSettings.query.filter_by(project_id=project_id).first()

# After
from ...services.settings import settings_repository
security_settings = settings_repository.get_security_settings(project_id)
```

### Phase 6: Deprecate ProjectSettings Model

1. Mark model as deprecated in docstring
2. Add migration to remove table (after all code is updated)
3. Remove model from `models/__init__.py` exports

## Implementation Order

1. ✅ **Data Migration Script** - Ensure all projects have specialized settings
2. ✅ **Update Repository** - Add methods for each specialized model
3. ✅ **Update SettingsManager** - Use specialized models
4. ✅ **Update Routes** - Remove ProjectSettings usage
5. ✅ **Update Services** - Replace direct ProjectSettings queries
6. ✅ **Remove Helper Fallback** - Clean up ProjectSettingsHelper
7. ✅ **Remove Model** - Final cleanup

## Testing Strategy

1. **Data Integrity**: Verify all settings are migrated correctly
2. **Backward Compatibility**: Ensure existing functionality works
3. **Performance**: Verify no N+1 queries introduced
4. **Edge Cases**: Test projects with missing specialized settings

## Rollback Plan

If issues arise:
1. Keep `ProjectSettings` model available
2. Re-enable fallback logic in `ProjectSettingsHelper`
3. Gradually roll back changes

## Notes

- `project_master_key` should be stored in `ProjectEncryptionSettings`
- Settings that don't fit existing models should be reviewed for new model creation
- Consider caching at the repository level for frequently accessed settings

