# Testing Guide

## Overview

The test suite uses **PostgreSQL** instead of SQLite to properly test PostgreSQL-specific features like:
- JSONB columns
- Full-text search (tsvector)
- Array types
- PostgreSQL-specific functions
- Index behavior

## Quick Start

### Option 1: PostgreSQL (Recommended for CI/Production Testing)

1. Start PostgreSQL test container:
```bash
cd backend/tests
docker-compose -f docker-compose.test.yml up -d
```

2. Run tests:
```bash
pytest
```

3. Stop container:
```bash
docker-compose -f docker-compose.test.yml down
```

### Option 2: SQLite (Faster for Local Development)

For faster local development (not recommended for CI), you can use SQLite:

```bash
USE_SQLITE=1 pytest
```

**Note**: SQLite tests won't validate PostgreSQL-specific features.

## Test Structure

- `tests/unit/` - Fast unit tests (mocked dependencies)
- `tests/integration/` - Integration tests (require database)

## Test Markers

- `@pytest.mark.unit` - Unit tests (fast, isolated)
- `@pytest.mark.integration` - Integration tests (slower, require database)
- `@pytest.mark.slow` - Slow running tests
- `@pytest.mark.auth` - Authentication related tests
- `@pytest.mark.connect` - Connect endpoint tests
- `@pytest.mark.security` - Security related tests

## Running Specific Tests

```bash
# Run only unit tests
pytest -m unit

# Run only integration tests
pytest -m integration

# Run specific test file
pytest tests/unit/test_repositories.py

# Run specific test
pytest tests/unit/test_repositories.py::test_user_repository
```

## Configuration

Test configuration is in `pytest.ini`:
- Coverage threshold: 60%
- Verbose output enabled
- Coverage reports: terminal, HTML, XML

## Database Cleanup

Tests automatically clean up the database after each run:
- PostgreSQL: Drops and recreates schema
- SQLite: Drops all tables

## Environment Variables

- `DATABASE_URL` - Database connection string (defaults to test PostgreSQL)
- `USE_SQLITE=1` - Use SQLite instead of PostgreSQL
- `REDIS_HOST`, `REDIS_PORT` - Redis configuration (mocked in tests)

## Troubleshooting

### PostgreSQL connection issues

If tests fail to connect to PostgreSQL:
1. Check if container is running: `docker ps`
2. Check container logs: `docker-compose -f docker-compose.test.yml logs postgres-test`
3. Verify port 5433 is not in use: `lsof -i :5433`

### Deprecation warnings

Deprecation warnings from deprecated counter functions are ignored in `pytest.ini`. These are expected during migration to `CachedStatisticsService`.

