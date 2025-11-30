"""
Celery tasks for analytics operations
Handles periodic flushing of analytics buffer to database

REFACTORED: Removed DatabaseTask as these tasks don't use DB directly.
They use services which handle their own DB connections.
Uses dependency injection - services are obtained once at the start of each task function.
"""

import logging
from ...utils.service_helpers import get_service

def _get_service(service_name):
    """Get service through app context (DI pattern) - requires app context"""
    from flask import current_app
    if not hasattr(current_app, 'service_container'):
        raise RuntimeError(
            f"Service container not initialized. Cannot get '{service_name}'. "
            "Make sure init_services() was called during app initialization."
        )
    return current_app.service_container.get(service_name)

try:
    from celery import Task

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

    class Task:
        pass

from ..config.config import Config
from ..services.analytics.analytics_buffer_service import AnalyticsBufferService
from ..services.connect.device_update_buffer import device_update_buffer

logger = logging.getLogger(__name__)

if CELERY_AVAILABLE:
    try:
        from ..core.celery_app import celery_app
    except ImportError:
        celery_app = None
        logger.warning("Celery app not available")
else:
    celery_app = None


def task_decorator(*args, **kwargs):
    """Conditional task decorator - only applies if Celery is available"""
    if CELERY_AVAILABLE and celery_app:
        return celery_app.task(*args, **kwargs)
    else:

        def decorator(func):
            return func

        return decorator


@task_decorator(
    bind=True,
    name="backend.tasks.analytics_tasks.flush_analytics_buffer",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def flush_analytics_buffer_task(self, activity_batch_size: int = None):
    """
    Periodic task to flush buffered analytics to the database.
    
    This task runs periodically to flush analytics writes from Redis buffer
    to PostgreSQL. This implements the write-behind caching pattern to reduce
    database write pressure under high load.
    
    Args:
        activity_batch_size: Number of user activities to flush per batch
                          (defaults to Config.ANALYTICS_BUFFER_BATCH_SIZE)
    """
    try:
        # Get service instance once at the start (DI pattern)
        # Try ServiceContainer first, fallback to direct instantiation
        try:
            analytics_buffer_service = _get_service('analytics_buffer_service')
        except (RuntimeError, ValueError):
            # Fallback for Celery tasks that may run outside Flask context
            analytics_buffer_service = AnalyticsBufferService()
        
        if not analytics_buffer_service.enabled:
            logger.debug("Analytics buffer is disabled, skipping flush")
            return {"success": True, "skipped": True, "reason": "buffer_disabled"}
        
        if activity_batch_size is None:
            activity_batch_size = Config.ANALYTICS_BUFFER_BATCH_SIZE
        
        logger.info("Starting analytics buffer flush task")
        
        # Get buffer stats before flush
        stats_before = analytics_buffer_service.get_buffer_stats()
        logger.debug(f"Buffer stats before flush: {stats_before}")
        
        # Flush all buffered analytics
        flush_results = analytics_buffer_service.flush_all(
            activity_batch_size=activity_batch_size
        )
        
        # Flush buffered device updates (last_seen)
        device_updates_flushed = device_update_buffer.flush_updates()
        
        logger.info(
            f"Analytics buffer flush completed: "
            f"{flush_results['user_activities_flushed']} activities, "
            f"{flush_results['key_analytics_flushed']} analytics records, "
            f"{device_updates_flushed} device updates"
        )
        
        # Get buffer stats after flush
        stats_after = analytics_buffer_service.get_buffer_stats()
        logger.debug(f"Buffer stats after flush: {stats_after}")
        
        return {
            "success": True,
            "flushed": flush_results,
            "device_updates_flushed": device_updates_flushed,
            "stats_before": stats_before,
            "stats_after": stats_after,
        }
        
    except Exception as e:
        logger.error(f"Failed to flush analytics buffer: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise


@task_decorator(
    bind=True,
    name="backend.tasks.analytics_tasks.get_analytics_buffer_stats",
    max_retries=2,
    default_retry_delay=30,
)
def get_analytics_buffer_stats_task(self):
    """
    Task to get current analytics buffer statistics.
    
    Useful for monitoring buffer health and size.
    """
    try:
        # Get service instance - try ServiceContainer first, fallback to direct instantiation
        try:
            analytics_buffer_service = _get_service('analytics_buffer_service')
        except (RuntimeError, ValueError):
            # Fallback for Celery tasks that may run outside Flask context
            analytics_buffer_service = AnalyticsBufferService()
        
        stats = analytics_buffer_service.get_buffer_stats()
        logger.debug(f"Analytics buffer stats: {stats}")
        return {"success": True, "stats": stats}
    except Exception as e:
        logger.error(f"Failed to get analytics buffer stats: {e}")
        return {"success": False, "error": str(e)}

