"""
Celery configuration and app initialization
Provides distributed task queue system with Redis broker
"""

import os

try:
    from celery import Celery
    from celery.schedules import crontab

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

    # Create a dummy Celery class for fallback
    class Celery:
        def __init__(self, *args, **kwargs):
            pass

        def conf(self):
            return type("obj", (object,), {"update": lambda self, x: None})()


from ..config.config import Config


def make_celery(app=None):
    """
    Create and configure Celery app instance
    """
    if not CELERY_AVAILABLE:
        import logging

        logging.warning("Celery is not installed. Task queue will use fallback mode.")
        return None

    # Build Redis URL for Celery broker and result backend
    redis_url = f"redis://"
    if Config.REDIS_PASSWORD:
        redis_url = f"redis://:{Config.REDIS_PASSWORD}@"
    redis_url += f"{Config.REDIS_HOST}:{Config.REDIS_PORT}/{Config.REDIS_DB}"

    celery_app = Celery(
        "panel_tasks",
        broker=redis_url,
        backend=redis_url,
        # Tasks are imported lazily when needed
        # include=['backend.tasks.server_tasks'] is not needed here - tasks auto-discover
    )

    # Celery configuration
    celery_app.conf.update(
        # Task settings
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        # Task execution settings
        task_acks_late=True,  # Acknowledge tasks after completion
        task_reject_on_worker_lost=True,  # Reject tasks if worker dies
        task_time_limit=300,  # Hard time limit (5 minutes)
        task_soft_time_limit=240,  # Soft time limit (4 minutes)
        # Worker settings
        worker_prefetch_multiplier=4,  # Prefetch 4 tasks per worker
        worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks (memory leak prevention)
        worker_disable_rate_limits=False,
        # Result backend settings
        result_expires=3600,  # Results expire after 1 hour
        result_backend_transport_options={
            "visibility_timeout": 3600,
        },
        # Queue settings
        task_default_queue="default",
        task_default_exchange="tasks",
        task_default_exchange_type="direct",
        task_default_routing_key="default",
        # Retry settings
        task_autoretry_for=(Exception,),
        task_retry_backoff=True,
        task_retry_backoff_max=600,  # Max 10 minutes
        task_retry_jitter=True,
        task_max_retries=3,
        # Monitoring
        worker_send_task_events=True,
        task_send_sent_event=True,
        # Task routes for different priorities
        task_routes={
            "backend.tasks.server_tasks.*": {"queue": "server_tasks"},
            "backend.tasks.server_tasks.server_status_check": {
                "queue": "server_tasks",
                "priority": 5,
            },
            "backend.tasks.server_tasks.server_start": {"queue": "server_tasks", "priority": 3},
            "backend.tasks.server_tasks.server_stop": {"queue": "server_tasks", "priority": 3},
            "backend.tasks.server_tasks.server_restart": {"queue": "server_tasks", "priority": 2},
            "backend.tasks.key_tasks.*": {"queue": "key_tasks"},
            "backend.tasks.key_tasks.bulk_create_keys": {
                "queue": "key_tasks",
                "priority": 4,
            },
            "backend.tasks.key_tasks.bulk_create_loader_keys": {
                "queue": "key_tasks",
                "priority": 4,
            },
        },
        # Beat schedule for periodic tasks (if needed)
        beat_schedule={
            # Example: periodic server health checks
            # 'periodic-server-health-check': {
            #     'task': 'backend.tasks.server_tasks.periodic_server_health_check',
            #     'schedule': crontab(minute='*/5'),  # Every 5 minutes
            # },
        },
    )

    # Update configuration from Flask app if provided
    if app is not None:

        class ContextTask(celery_app.Task):
            """Make celery tasks work with Flask app context"""

            def __call__(self, *args, **kwargs):
                with app.app_context():
                    return self.run(*args, **kwargs)

        celery_app.Task = ContextTask

    return celery_app


# Create Celery app instance (will be initialized with Flask app later)
# This will be None if Celery is not available
celery_app = make_celery() if CELERY_AVAILABLE else None
