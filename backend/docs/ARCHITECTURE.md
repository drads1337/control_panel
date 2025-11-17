# Architecture

## Scalability

### Database

- **Read replicas**: PostgreSQL read replicas for read operations
- **PgBouncer**: Connection pooling for better performance
- **Full-text search**: PostgreSQL tsvector with GIN indexes

### Caching

- **Redis**: Tag-based cache invalidation
- **TTL**: Different TTLs for different data types (1-10 minutes)
- **Smart invalidation**: Instant cache updates via tags

### Async Operations

- **Celery**: Background task processing
- **Queues**: Separate queues for different task types
- **Workers**: Configurable workers per queue

### Horizontal Scaling

- **Stateless**: All state in DB/Redis
- **Gunicorn**: Multiple workers per instance
- **Load balancing**: Multiple instances behind load balancer

## Key Components

- `db_replica.py` - Read replica management
- `cache_service.py` - Redis caching with tags
- `celery_app.py` - Celery configuration
- `gunicorn.conf.py` - Production server config