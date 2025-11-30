"""
Example of refactored Celery task using celery_db_session context manager.

This demonstrates how to refactor tasks to use the new context manager
for safer database session management.

BEFORE (risky):
    class DatabaseTask(Task):
        def before_start(self, task_id, args, kwargs):
            self._db_session = Session()  # May leak if worker crashes
        
        def after_return(self, *args, **kwargs):
            self._db_session.close()  # May not execute

AFTER (safe):
    @task_decorator(bind=True, name="...")
    def my_task(self, server_id, task_id=None, project_id=None):
        with celery_db_session() as session:
            # Session is guaranteed to close
            server = session.query(Server).get(server_id)
            session.commit()
"""

import logging

try:
    from celery import Task
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    class Task:
        pass

try:
    import paramiko
except ImportError:
    paramiko = None

from ...utils.celery_db_session import celery_db_session
from ...models.servers import Server
from ...utils.project_settings_migration import ProjectSettingsHelper

logger = logging.getLogger(__name__)

if CELERY_AVAILABLE:
    try:
        from ...core.celery_app import celery_app
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
    name="backend.tasks.server_tasks_refactored_example.server_status_check",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def server_status_check(self, server_id, task_id=None, project_id=None):
    """
    Check server status via SSH connection (REFACTORED VERSION).
    
    This version uses celery_db_session context manager to ensure
    database sessions are properly closed even if the worker crashes.
    
    Args:
        server_id: ID of the server to check
        task_id: Optional task ID for status tracking
        project_id: Project ID for isolation
    """
    task_service = None
    if task_id:
        try:
            # Example: Get service through app context (DI pattern)
            from flask import current_app
            if not hasattr(current_app, 'service_container'):
                raise RuntimeError(
                    "Service container not initialized. Cannot get 'task_service'. "
                    "Make sure init_services() was called during app initialization."
                )
            task_service = current_app.service_container.get('task_service')
            task_service.update_task_status(task_id, "in_progress", progress=10)
        except Exception as e:
            logger.warning(f"Failed to update task status: {e}")

    # Use context manager for database session
    # Session is guaranteed to close even if worker crashes
    with celery_db_session() as session:
        try:
            # Query server
            if project_id:
                server = session.query(Server).filter_by(
                    id=server_id, project_id=project_id
                ).first()
            else:
                server = session.query(Server).get(server_id)

            if not server:
                error_msg = f"Server {server_id} not found"
                logger.warning(error_msg)
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            # Get encryption settings
            helper = ProjectSettingsHelper(server.project_id)
            encryption_settings = helper.get_encryption_settings()
            
            if not encryption_settings.project_master_key:
                error_msg = f"No encryption key found for project {server.project_id}"
                logger.error(error_msg)
                server.status = "error"
                session.commit()  # Commit within context manager
                
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            if task_service and task_id:
                task_service.update_task_status(task_id, "in_progress", progress=30)

            # Decrypt password
            try:
                decrypted_password = server.get_password(encryption_settings.project_master_key)
            except Exception as e:
                error_msg = f"Failed to decrypt password: {str(e)}"
                logger.error(error_msg)
                server.status = "error"
                session.commit()
                
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            # Check server via SSH
            if not paramiko:
                error_msg = "paramiko library not available"
                logger.error(error_msg)
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            try:
                ssh.connect(
                    hostname=server.ip_address,
                    port=server.port,
                    username=server.username,
                    password=decrypted_password,
                    timeout=5,
                )

                server.status = "online"
                session.commit()  # Commit within context manager
                ssh.close()

                if task_service and task_id:
                    task_service.update_task_status(task_id, "in_progress", progress=80)
                    task_service.update_task_status(
                        task_id,
                        "completed",
                        progress=100,
                        result={"status": "online", "message": "Server is online"},
                    )

                return {"status": "online", "message": "Server is online"}

            except Exception as e:
                server.status = "offline"
                session.commit()  # Commit within context manager
                logger.error(f"Error checking server {server.name}: {str(e)}")

                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=str(e))

                return {"status": "offline", "error": str(e)}
            finally:
                try:
                    ssh.close()
                except:
                    pass

        except Exception as e:
            # Any exception will cause rollback and session close
            logger.error(f"Unexpected error in server_status_check: {e}", exc_info=True)
            if task_service and task_id:
                task_service.update_task_status(task_id, "failed", error=str(e))
            raise  # Re-raise to trigger Celery retry if configured

    # Session is automatically closed here by context manager
    # Even if worker crashes, the connection pool will handle cleanup

