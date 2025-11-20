"""
Celery configuration and app initialization
Provides distributed task queue system with Redis broker
"""

import os

try:
    from celery import Celery
    from celery.schedules import crontab
    from datetime import timedelta

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

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

    # Use persistent Redis instance for Celery (sessions and queues must not lose data)
    redis_password_part = f":{Config.REDIS_PERSISTENT_PASSWORD}@" if Config.REDIS_PERSISTENT_PASSWORD else ""
    redis_url = (
        f"redis://{redis_password_part}{Config.REDIS_PERSISTENT_HOST}:"
        f"{Config.REDIS_PERSISTENT_PORT}/{Config.REDIS_PERSISTENT_DB}"
    )

    celery_app = Celery(
        "panel_tasks",
        broker=redis_url,
        backend=redis_url,

    )

    celery_app.conf.update(

        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,

        task_acks_late=True,
        task_reject_on_worker_lost=True,
        task_time_limit=300,
        task_soft_time_limit=240,

        worker_prefetch_multiplier=4,
        worker_max_tasks_per_child=1000,
        worker_disable_rate_limits=False,

        result_expires=3600,
        result_backend_transport_options={
            "visibility_timeout": 3600,
        },

        task_default_queue="default",
        task_default_exchange="tasks",
        task_default_exchange_type="direct",
        task_default_routing_key="default",

        task_autoretry_for=(Exception,),
        task_retry_backoff=True,
        task_retry_backoff_max=600,
        task_retry_jitter=True,
        task_max_retries=3,

        worker_send_task_events=True,
        task_send_sent_event=True,

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

        beat_schedule={
            # Flush analytics buffer periodically to reduce database write pressure
            # This implements write-behind caching pattern for high-load scenarios
            # Interval is configurable via ANALYTICS_BUFFER_FLUSH_INTERVAL (default: 30 seconds)
            "flush-analytics-buffer": {
                "task": "backend.tasks.analytics_tasks.flush_analytics_buffer",
                "schedule": timedelta(
                    seconds=int(os.environ.get("ANALYTICS_BUFFER_FLUSH_INTERVAL", 30))
                ),
                "options": {"queue": "default", "priority": 6},
            },
        },
    )

    if app is not None:

        class ContextTask(celery_app.Task):
            """Make celery tasks work with Flask app context"""

            def __call__(self, *args, **kwargs):
                with app.app_context():
                    return self.run(*args, **kwargs)

        celery_app.Task = ContextTask

    return celery_app

celery_app = make_celery() if CELERY_AVAILABLE else None
