# Breaking Changes

## ✅ COMPLETED: `/api/clients` Endpoint Migration

**Date**: Current Release  
**Status**: ✅ **MIGRATED** - Frontend and backend fully migrated

### What Changed

The legacy `/api/clients` endpoint has been **completely removed** from the backend and **fully migrated** to new endpoints.

### Affected Endpoints

All endpoints under `/api/clients/*` are no longer available:
- `GET /api/clients` - Get clients list
- `POST /api/clients/bulk-delete` - Bulk delete clients
- `GET /api/clients/<product_id>/classic-users` - Get users for product
- `GET /api/clients/<user_id>/products` - Get user products
- `POST /api/clients/<user_id>/products/<product_id>/toggle` - Toggle product access

### Migration Completed

✅ **Frontend has been migrated** to use new endpoints. All legacy `/api/clients` usage has been replaced.

#### Migration Mapping

| Old Endpoint | New Endpoint | Status |
|-------------|--------------|--------|
| `GET /api/clients` | `GET /api/users/clients` | ✅ Migrated |
| `GET /api/clients/<user_id>/products` | `GET /api/users/<user_id>/products` | ✅ Migrated |
| `POST /api/clients/<user_id>/products/<product_id>/toggle` | `POST /api/users/<user_id>/products/<product_id>/toggle` | ✅ Migrated |
| `GET /api/clients/<product_id>/classic-users` | `GET /api/products/<product_id>/classic-users` | ✅ Migrated |

#### Files Updated

All frontend files have been migrated:

1. ✅ **`frontend/src/shared/api/config.ts`** - Removed `PRODUCTS_CLASSIC_USERS`
2. ✅ **`frontend/src/hooks/use-edit-user-dialog.ts`** - Updated to `/api/users/<user_id>/products`
3. ✅ **`frontend/src/shared/api/enhanced-client.ts`** - Updated to check `/api/users/`
4. ✅ **`frontend/src/app/management/license-keys/LicenseKeyCreationGrid.tsx`** - Updated to `/api/users/<user_id>/products`

#### Backend Endpoints Created

New endpoints have been created to replace legacy functionality:

1. ✅ **`GET /api/users/<user_id>/products`** - Get products for a user
2. ✅ **`POST /api/users/<user_id>/products/<product_id>/toggle`** - Toggle product access
3. ✅ **`GET /api/products/<product_id>/classic-users`** - Get users with product access

### Testing Checklist

✅ Migration completed. Please verify:
- [ ] User management page loads correctly
- [ ] Product assignment to users works
- [ ] User products list displays correctly
- [ ] Product access toggling works
- [ ] No 404 errors in browser console
- [ ] No API errors in network tab

---

## Other Breaking Changes

### Deprecated Counter Functions Removed

All deprecated increment/decrement counter functions have been removed:
- `increment_user_key_counters()` / `decrement_user_key_counters()`
- `increment_project_key_counters()` / `decrement_project_key_counters()`
- `increment_project_user_counters()` / `decrement_project_user_counters()`
- `increment_project_product_counters()` / `decrement_project_product_counters()`
- `increment_project_server_counters()` / `decrement_project_server_counters()`

**Replacement**: Use `CachedStatisticsService.invalidate_on_*_change()` instead.

**Impact**: Low - these functions were already deprecated and not used in active code.

---

## Migration Timeline

- **Phase 1** (Current): Backend endpoints removed
- **Phase 2** (Required): Frontend migration to new endpoints
- **Phase 3** (Future): Remove any remaining legacy code references

---

## Support

If you encounter issues during migration:
1. Check `backend/docs/API_MIGRATION_PLAN.md` for detailed migration guide
2. Review `backend/docs/TECHNICAL_DEBT.md` for overall technical debt status
3. Check git history for removed endpoint implementations if needed

