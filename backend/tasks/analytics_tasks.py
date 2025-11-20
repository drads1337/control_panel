"""
Celery tasks for analytics operations
Handles periodic flushing of analytics buffer to database
"""

import logging

try:
    from celery import Task

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False

    class Task:
        pass

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..config.config import Config
from ..services.analytics import analytics_buffer_service

logger = logging.getLogger(__name__)

if CELERY_AVAILABLE:
    try:
        from ..core.celery_app import celery_app
    except ImportError:
        celery_app = None
        logger.warning("Celery app not available")
else:
    celery_app = None

if CELERY_AVAILABLE and celery_app:
    db_engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    Session = sessionmaker(bind=db_engine)
else:
    db_engine = None
    Session = None


class DatabaseTask(Task):
    """
    Base task class that provides database session management
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._db_session = None

    def before_start(self, task_id, args, kwargs):
        """Called before task execution"""
        if Session:
            self._db_session = Session()

    def after_return(self, *args, **kwargs):
        """Called after task execution"""
        if self._db_session:
            try:
                self._db_session.commit()
            except:
                self._db_session.rollback()
            finally:
                self._db_session.close()
                self._db_session = None

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails"""
        if self._db_session:
            try:
                self._db_session.rollback()
            finally:
                self._db_session.close()
                self._db_session = None


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
    base=DatabaseTask,
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
        
        logger.info(
            f"Analytics buffer flush completed: "
            f"{flush_results['user_activities_flushed']} activities, "
            f"{flush_results['key_analytics_flushed']} analytics records"
        )
        
        # Get buffer stats after flush
        stats_after = analytics_buffer_service.get_buffer_stats()
        logger.debug(f"Buffer stats after flush: {stats_after}")
        
        return {
            "success": True,
            "flushed": flush_results,
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
    base=DatabaseTask,
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
        stats = analytics_buffer_service.get_buffer_stats()
        logger.debug(f"Analytics buffer stats: {stats}")
        return {"success": True, "stats": stats}
    except Exception as e:
        logger.error(f"Failed to get analytics buffer stats: {e}")
        return {"success": False, "error": str(e)}

