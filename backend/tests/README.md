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

## Load Testing with Locust

Load tests are available for critical endpoints that handle high traffic:
- `/api/connect` - Main authentication endpoint
- `/api/heartbeat` - Heartbeat endpoint for session maintenance

### Prerequisites

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure the application is running (for load testing against a running instance):
```bash
# Start your application server
python backend/scripts/run.py
```

3. Disable mTLS for load testing (mTLS is automatically disabled in locustfile.py):
```bash
export MTLS_ENABLED=false
```

### Running Load Tests

#### Option 1: Web UI (Interactive)

Start Locust with web interface:
```bash
cd backend/tests
locust -f locustfile.py --host=http://localhost:5000
```

Then open your browser to `http://localhost:8089` and configure:
- Number of users (total concurrent users)
- Spawn rate (users per second)
- Host URL (if different from command line)

#### Option 2: Headless Mode (Command Line)

Run load tests without web UI:

```bash
# Test /api/connect endpoint
locust -f locustfile.py --host=http://localhost:5000 --headless \
  -u 100 -r 10 -t 5m ConnectUser

# Test /api/heartbeat endpoint
locust -f locustfile.py --host=http://localhost:5000 --headless \
  -u 200 -r 20 -t 5m HeartbeatUser

# Test both endpoints combined
locust -f locustfile.py --host=http://localhost:5000 --headless \
  -u 150 -r 15 -t 5m CombinedUser
```

Parameters:
- `-u, --users`: Total number of concurrent users
- `-r, --spawn-rate`: Users spawned per second
- `-t, --run-time`: Test duration (e.g., `5m`, `10m`, `1h`)

#### Option 3: Custom Configuration

```bash
# High load test (500 users, 50 per second, 10 minutes)
locust -f locustfile.py --host=http://localhost:5000 --headless \
  -u 500 -r 50 -t 10m CombinedUser

# Gradual ramp-up (100 users over 2 minutes, then maintain for 5 minutes)
locust -f locustfile.py --host=http://localhost:5000 --headless \
  -u 100 -r 1 -t 7m CombinedUser
```

### User Classes

The load test includes three user classes:

1. **ConnectUser** (weight: 3)
   - Tests `/api/connect` endpoint
   - Simulates users connecting to the system
   - Wait time: 1-3 seconds between requests

2. **HeartbeatUser** (weight: 5)
   - Tests `/api/heartbeat` endpoint
   - Simulates clients sending periodic heartbeats
   - Wait time: 0.5-2 seconds between requests (more frequent)

3. **CombinedUser**
   - Tests both endpoints
   - Simulates real client behavior (connect + heartbeats)
   - Ratio: 1 connect request per 10 heartbeat requests

### Test Data

The load tests use mock data that matches the expected format:
- Test keys (32 hex characters)
- Test project IDs
- Encrypted blobs (base64 encoded JSON)

**Note**: For production-like testing, you may want to:
1. Create actual test keys in the database
2. Use real encryption instead of base64
3. Configure proper test data in `TestDataManager._setup_test_data()`

### Expected Results

Under normal load, you should see:
- **Connect endpoint**: 200 OK for valid requests, 400/403 for invalid data
- **Heartbeat endpoint**: 200 OK for valid sessions, 403 for invalid/expired sessions
- **Rate limiting**: 429 responses under very high load (expected behavior)

### Monitoring

Monitor your application during load tests:
- Application logs
- Database connection pool
- Redis connection status
- System resources (CPU, memory, network)

### Troubleshooting

#### Connection refused
- Ensure the application server is running
- Check the host URL is correct
- Verify firewall/network settings

#### High error rate
- Check application logs for errors
- Verify database and Redis connections
- Monitor system resources (may need more capacity)

#### Rate limiting (429 errors)
- This is expected under high load
- Adjust rate limit configuration if needed
- Consider increasing rate limits for load testing

## Troubleshooting

### PostgreSQL connection issues

If tests fail to connect to PostgreSQL:
1. Check if container is running: `docker ps`
2. Check container logs: `docker-compose -f docker-compose.test.yml logs postgres-test`
3. Verify port 5433 is not in use: `lsof -i :5433`

### Deprecation warnings

Deprecation warnings from deprecated counter functions are ignored in `pytest.ini`. These are expected during migration to `CachedStatisticsService`.

