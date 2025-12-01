# PostgreSQL RLS Load Testing Guide

## Overview

This guide explains how to perform load testing of PostgreSQL Row Level Security (RLS) policies to ensure they don't significantly impact performance under load.

## Why Test RLS Performance?

RLS policies add overhead to every database query:
- Policy evaluation for each row
- Additional WHERE clauses
- Potential impact on query plans

Under high load, RLS can become a bottleneck if not properly optimized.

## Test Scenarios

### 1. Concurrent User Access

Test multiple users accessing data simultaneously:

```python
# Simulate 100 concurrent users from different projects
# Each user queries their own project data
# Measure: Query latency, throughput
```

### 2. Cross-Project Isolation

Verify RLS prevents cross-project data access:

```python
# User from project A tries to access project B data
# Expected: RLS blocks access, returns empty results
# Measure: Policy evaluation overhead
```

### 3. Complex Queries with RLS

Test complex queries (JOINs, aggregations) with RLS:

```python
# Complex queries with multiple tables
# RLS policies on each table
# Measure: Query execution time, plan efficiency
```

## Load Testing Tools

### Option 1: Locust (Recommended)

Use existing Locust configuration:

```bash
cd backend/tests
locust -f locustfile.py --host=http://localhost:5000
```

Create custom RLS test scenario:

```python
# locustfile_rls.py
from locust import HttpUser, task, between

class RLSLoadTestUser(HttpUser):
    wait_time = between(1, 3)
    
    @task(3)
    def get_keys(self):
        """Test key listing with RLS"""
        self.client.get("/api/keys", headers={"Authorization": f"Bearer {self.token}"})
    
    @task(2)
    def get_projects(self):
        """Test project listing with RLS"""
        self.client.get("/api/projects", headers={"Authorization": f"Bearer {self.token}"})
    
    @task(1)
    def create_key(self):
        """Test key creation with RLS"""
        self.client.post("/api/keys", json={...}, headers={"Authorization": f"Bearer {self.token}"})
```

### Option 2: Apache Bench (AB)

Simple HTTP load testing:

```bash
# 1000 requests, 10 concurrent
ab -n 1000 -c 10 -H "Authorization: Bearer <token>" http://localhost:5000/api/keys
```

### Option 3: Custom Python Script

```python
import concurrent.futures
import requests
import time

def test_rls_query(token, project_id):
    """Test single RLS query"""
    start = time.time()
    response = requests.get(
        f"http://localhost:5000/api/keys",
        headers={"Authorization": f"Bearer {token}"}
    )
    latency = time.time() - start
    return {
        'status': response.status_code,
        'latency': latency,
        'project_id': project_id
    }

# Run 100 concurrent requests
with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
    futures = [executor.submit(test_rls_query, token, project_id) for _ in range(100)]
    results = [f.result() for f in concurrent.futures.as_completed(futures)]

# Analyze results
avg_latency = sum(r['latency'] for r in results) / len(results)
print(f"Average latency: {avg_latency:.3f}s")
```

## Performance Metrics

### Key Metrics to Monitor

1. **Query Latency**
   - P50, P95, P99 latencies
   - Compare with/without RLS

2. **Throughput**
   - Queries per second
   - Requests per second

3. **Database Load**
   - CPU usage
   - Connection pool utilization
   - Query execution time

4. **RLS Overhead**
   - Time spent in policy evaluation
   - Additional rows scanned

### Monitoring Queries

```sql
-- Check RLS policy execution time
EXPLAIN ANALYZE
SELECT * FROM keys WHERE project_id = current_setting('app.current_project_id')::int;

-- Monitor active queries
SELECT pid, query, state, query_start
FROM pg_stat_activity
WHERE state = 'active';

-- Check RLS policy hits
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public';
```

## Benchmarking RLS Impact

### Baseline (Without RLS)

1. Temporarily disable RLS:
```sql
ALTER TABLE keys DISABLE ROW LEVEL SECURITY;
```

2. Run load test
3. Measure performance

### With RLS

1. Enable RLS:
```sql
ALTER TABLE keys ENABLE ROW LEVEL SECURITY;
```

2. Run same load test
3. Compare results

### Expected Overhead

- **Simple queries**: 5-15% overhead
- **Complex queries (JOINs)**: 10-30% overhead
- **High concurrency**: May see higher overhead due to context switching

## Optimization Strategies

### 1. Index Optimization

Ensure indexes support RLS policies:

```sql
-- Index on project_id (used in RLS policy)
CREATE INDEX idx_keys_project_id ON keys(project_id);

-- Composite index if needed
CREATE INDEX idx_keys_project_user ON keys(project_id, user_id);
```

### 2. Policy Optimization

Use efficient policy functions:

```sql
-- Good: Uses indexed column
CREATE POLICY keys_project_policy ON keys
    USING (project_id = current_setting('app.current_project_id')::int);

-- Bad: Function call on every row
CREATE POLICY keys_project_policy ON keys
    USING (get_user_project_id() = project_id);
```

### 3. Connection Pooling

Use connection pooling to reduce overhead:

```python
# PgBouncer or SQLAlchemy pool
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_size': 20,
    'max_overflow': 10,
    'pool_pre_ping': True
}
```

### 4. Query Optimization

Optimize queries to work with RLS:

```python
# Good: Filter by project_id (matches RLS policy)
keys = Key.query.filter_by(project_id=project_id).all()

# Bad: Loads all, then filters (RLS still applies but less efficient)
keys = [k for k in Key.query.all() if k.project_id == project_id]
```

## Test Plan

### Phase 1: Single User

1. Single user, single project
2. Measure: Query latency, throughput
3. Baseline: 100 queries, measure average

### Phase 2: Multiple Users, Single Project

1. 10 users, same project
2. Measure: Concurrent access performance
3. Check: No cross-user data leakage

### Phase 3: Multiple Projects

1. 10 users, 5 projects (2 users per project)
2. Measure: Isolation performance
3. Verify: Cross-project access blocked

### Phase 4: High Load

1. 100+ concurrent users
2. Multiple projects
3. Measure: System performance under load
4. Identify: Bottlenecks, connection limits

## Interpreting Results

### Good Performance

- P95 latency < 200ms for simple queries
- P95 latency < 500ms for complex queries
- Throughput > 100 req/s per instance
- RLS overhead < 20%

### Warning Signs

- P95 latency > 1s
- Throughput < 50 req/s
- RLS overhead > 30%
- High database CPU usage
- Connection pool exhaustion

### Action Items

If performance is poor:

1. **Review RLS policies**: Optimize policy functions
2. **Add indexes**: Ensure indexes support RLS
3. **Optimize queries**: Reduce unnecessary data loading
4. **Scale horizontally**: Add more application instances
5. **Database tuning**: Optimize PostgreSQL configuration

## Continuous Monitoring

Set up monitoring for:

1. **Query Performance**
   - Slow query log
   - Query execution time
   - RLS policy evaluation time

2. **System Metrics**
   - Database CPU/memory
   - Connection pool usage
   - Request latency

3. **Alerts**
   - P95 latency > threshold
   - Error rate > threshold
   - Database connection issues

## Example Test Results

```
RLS Load Test Results
=====================

Test Configuration:
- Users: 100
- Duration: 5 minutes
- Requests: 10,000

Results:
- Average latency: 45ms
- P95 latency: 120ms
- P99 latency: 250ms
- Throughput: 33 req/s
- RLS overhead: ~12%

Comparison (without RLS):
- Average latency: 40ms
- P95 latency: 100ms
- RLS overhead: ~12.5%

Conclusion: RLS adds acceptable overhead (~12%)
```

## Related Documentation

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [RLS Integration Tests](../tests/integration/test_postgresql_rls_integration.py)
- [Performance Tuning Guide](./PERFORMANCE.md)

