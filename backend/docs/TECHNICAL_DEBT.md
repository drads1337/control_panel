# Technical Debt Documentation

This document tracks known technical debt items and migration plans.

## Legacy API Routes (Migration Status)

### Current State
The project is in a transition period from old terminology to new terminology:

- **Old**: `clients` → **New**: `products`
- **Old**: `loaders` → **New**: `agents`

### Active Endpoints

#### New Terminology (Primary)
- `/api/products` - Product management (replaces `/api/clients`)
- `/api/agents` - Agent management (replaces `/api/loaders`)

#### Legacy Endpoints (Deprecated)
- `/api/clients` - Legacy client management endpoint
  - **Status**: DEPRECATED
  - **Migration Target**: Use `/api/products` instead
  - **Removal Date**: TBD (after frontend migration complete)

### Migration Plan

1. **Phase 1** (Current): Both old and new endpoints are active
   - Frontend should migrate to new endpoints
   - Backend maintains backward compatibility

2. **Phase 2** (Future): Remove legacy endpoints
   - After frontend migration is complete
   - After monitoring shows no usage of legacy endpoints
   - Target: 12 months from initial migration

### Code Locations

- **New Routes**: `backend/routes/products.py`, `backend/routes/agents.py`
- **Legacy Routes**: `backend/routes/clients.py`
- **Registration**: `backend/core/blueprints.py` (lines 61, 73-74)

## Race Condition Fixes

### Issue
The deprecated counter functions (`increment_user_key_counters`, `increment_project_key_counters`, etc.) caused race conditions under high concurrency.

### Solution
Replaced with `CachedStatisticsService` which uses cache invalidation instead of counter increments.

### Migration Status
✅ **Completed**: All active code has been migrated to use `CachedStatisticsService.invalidate_on_key_change()`

### Remaining Deprecated Functions
The following functions are deprecated but kept for backward compatibility:
- `backend/utils/key_counters.py`: `increment_user_key_counters()`, `decrement_user_key_counters()`
- `backend/utils/project_counters.py`: `increment_project_key_counters()`, `decrement_project_key_counters()`, etc.

**Note**: These functions emit deprecation warnings and should not be used in new code.

## Cache Stampede Protection

### Issue
When Redis cache misses occurred, multiple processes would simultaneously query the database, causing potential DDoS on the database.

### Solution
Added Redis distributed locks to `DynamicConfigService.generate_dynamic_config()`:
- First process acquires lock and generates config
- Other processes wait and check cache periodically
- Prevents simultaneous database queries

### Implementation
- Location: `backend/services/dynamic_config/dynamic_config_service.py`
- Lock timeout: 10 seconds
- Wait timeout: 5 seconds
- Max retries: 20

## Recommendations for Future

1. **Remove Legacy Routes**: After frontend migration, remove `/api/clients` endpoint
2. **Remove Deprecated Functions**: After ensuring no external dependencies, remove deprecated counter functions
3. **API Documentation**: Add Swagger/OpenAPI documentation for all endpoints
4. **Service Refactoring**: Consider splitting large services (AuthService, ProjectService) into smaller, focused services

