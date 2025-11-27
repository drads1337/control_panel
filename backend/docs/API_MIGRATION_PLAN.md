# API Migration Plan: Legacy Endpoints

## Overview

This document outlines the migration plan from legacy API endpoints to new, consistent terminology endpoints.

## Legacy Endpoints Status

### `/api/clients` → `/api/products` / `/api/users`

**Status**: ✅ **COMPLETED** - Fully migrated

**Migration Completed**:
- ✅ `frontend/src/shared/api/config.ts`: Removed `PRODUCTS_CLASSIC_USERS`
- ✅ `frontend/src/hooks/use-edit-user-dialog.ts`: Updated to `/api/users/${userId}/products`
- ✅ `frontend/src/shared/api/enhanced-client.ts`: Updated to check `/api/users/`
- ✅ `frontend/src/app/management/license-keys/LicenseKeyCreationGrid.tsx`: Updated to `/api/users/${user.id}/products`

**New Endpoints Created**:
- ✅ `GET /api/users/<user_id>/products` - Get products for a user
- ✅ `POST /api/users/<user_id>/products/<product_id>/toggle` - Toggle product access
- ✅ `GET /api/products/<product_id>/classic-users` - Get users with product access

**Backend Cleanup Completed**:
- ✅ Removed `backend/routes/clients.py`
- ✅ Removed `clients_bp` registration from `backend/core/blueprints.py`
- ✅ Removed import: `from ..routes.clients import clients_bp`

**Status**: ✅ **FULLY MIGRATED** - All endpoints replaced and tested

---

## Completed Migrations

### ✅ Deprecated Counter Functions

**Status**: ✅ **COMPLETED** - All deprecated functions removed

**Removed Functions**:
- `increment_user_key_counters()` / `decrement_user_key_counters()`
- `increment_project_key_counters()` / `decrement_project_key_counters()`
- `increment_project_user_counters()` / `decrement_project_user_counters()`
- `increment_project_product_counters()` / `decrement_project_product_counters()`
- `increment_project_server_counters()` / `decrement_project_server_counters()`

**Replacement**: All code now uses `CachedStatisticsService.invalidate_on_*_change()`

**Files Modified**:
- `backend/utils/key_counters.py` - Removed increment/decrement functions
- `backend/utils/project_counters.py` - Removed increment/decrement functions
- `backend/utils/migration_helper.py` - Updated to reflect removal

---

## Migration Checklist

### For `/api/clients` Removal:

- [ ] **Phase 1: Frontend Migration**
  - [ ] Update `frontend/src/shared/api/config.ts`
  - [ ] Update `frontend/src/hooks/use-edit-user-dialog.ts`
  - [ ] Update `frontend/src/shared/api/enhanced-client.ts`
  - [ ] Update `frontend/src/app/management/license-keys/LicenseKeyCreationGrid.tsx`
  - [ ] Test all user management features
  - [ ] Test product assignment features
  - [ ] Deploy frontend with new endpoints

- [ ] **Phase 2: Monitoring**
  - [ ] Monitor error logs for 404s on `/api/clients` (1-2 weeks)
  - [ ] Check analytics for any external API usage
  - [ ] Verify no breaking changes

- [ ] **Phase 3: Backend Cleanup**
  - [ ] Remove `backend/routes/clients.py`
  - [ ] Remove `clients_bp` from `backend/core/blueprints.py`
  - [ ] Update documentation
  - [ ] Run tests to ensure no regressions

---

## Notes

- **Backward Compatibility**: Legacy endpoints are kept active until frontend migration is complete
- **Testing**: Always test in staging environment before production deployment
- **Rollback Plan**: Keep legacy code in git history for easy rollback if needed
- **Timeline**: No hard deadline, but aim to complete within 3-6 months

---

## Related Documentation

- `backend/docs/TECHNICAL_DEBT.md` - Overall technical debt tracking
- `backend/services/statistics/cached_statistics_service.py` - Replacement for deprecated counters

