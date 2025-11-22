# API Migration Plan: Legacy vs Universal Terminology

## Current State

The codebase currently maintains two sets of API endpoints for backward compatibility:

### Universal Terminology (New)
- `/api/products` - Product management endpoints
- `/api/agents` - Agent management endpoints

### Legacy/Backward Compatibility (Deprecated)
- `/api/clients` - Classic user/product terminology (deprecated)
- Old terminology: "clients" instead of "products", "loaders" instead of "agents"

## Migration Strategy

### Phase 1: Documentation and Deprecation Warnings (Current)
- ✅ Legacy endpoints are marked with comments
- ✅ New endpoints use universal terminology
- ⚠️ Both sets are currently active

### Phase 2: Add Deprecation Headers (Recommended Next Step)
Add `Deprecation` and `Sunset` headers to legacy endpoints:
```python
@blueprint.route('/api/clients', methods=['GET'])
@add_deprecation_header
def get_clients():
    # Add headers:
    # Deprecation: true
    # Sunset: <date 6 months from now>
    pass
```

### Phase 3: Client Migration (6 months)
- Update all frontend code to use new endpoints
- Remove usage of `/api/clients` in favor of `/api/products`
- Update API client libraries and documentation

### Phase 4: Remove Legacy Endpoints (12 months)
- Remove deprecated blueprint registrations
- Remove legacy route handlers
- Update tests to only use new endpoints

## Files to Update

### Backend
- `backend/core/blueprints.py` - Remove duplicate blueprint registrations (lines 71-73)
- `backend/routes/clients.py` - Mark as deprecated, add migration guide
- `backend/routes/products.py` - Ensure all functionality is covered

### Frontend
- `frontend/src/shared/api/config.ts` - Remove `PRODUCTS_CLASSIC_USERS` endpoint
- `frontend/src/entities/agent/api/agent.ts` - Remove `getAgentsLegacy()` function
- Search for all usages of `/api/clients` and migrate to `/api/products`

## Timeline

- **Month 0-3**: Add deprecation headers, update documentation
- **Month 3-6**: Migrate frontend code, update API clients
- **Month 6-9**: Monitor usage, provide support for migration
- **Month 9-12**: Remove legacy endpoints

## Breaking Changes

After Phase 4, the following will be removed:
- `/api/clients` endpoints
- Legacy terminology in API responses
- Backward compatibility functions

## Notes

- This migration ensures consistent terminology across the codebase
- "Products" and "Agents" are more accurate than "Clients" and "Loaders"
- The migration should be gradual to avoid breaking existing integrations

