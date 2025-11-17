# Security

## Overview

Security audit identified areas for improvement in IDOR protection and data validation.

## Key Issues

- **IDOR vulnerabilities**: 257 endpoints potentially vulnerable to insecure direct object reference
- **Missing validation**: Some endpoints don't use `@validate_request` decorator
- **Inconsistent isolation**: Not all endpoints use `@require_project_isolation`

## Protection Mechanisms

### Decorators

- `@require_project_isolation` - Strict project isolation
- `@enforce_project_scope` - Flexible isolation (owners can access multiple projects)
- `@require_permission()` - RBAC permission check
- `@require_role()` - Role-based access control

### Validation

- Pydantic schemas for input validation
- `@validate_request` decorator for automatic validation
- Middleware for request validation

## Recommendations

1. Add `@require_project_isolation` to all endpoints accessing project-scoped data
2. Use `@validate_request` for all POST/PUT/PATCH endpoints
3. Filter all queries by `project_id` using `g.project_id`
4. Add integration tests for project isolation

## Status

- ✅ Protection decorators implemented
- ✅ Validation middleware available
- ⚠️ Not all endpoints use protection decorators
- ⚠️ Missing validation on some endpoints

