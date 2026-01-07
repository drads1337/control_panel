"""
Celery tasks for server operations
Handles SSH operations asynchronously with proper error handling and retries

REFACTORED: Now uses celery_db_session context manager for safe database session management.
This prevents connection leaks even if worker crashes.
"""

import logging
import time
# Use absolute imports to be importable in production (no relative beyond top-level)
from backend.utils.service_helpers import get_service
from backend.utils.celery_db_session import celery_db_session

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

from ..models.servers import Server
from ..utils.project_settings_migration import ProjectSettingsHelper

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
    name="backend.tasks.server_tasks.server_status_check",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def server_status_check(self, server_id, task_id=None, project_id=None):
    """
    Check server status via SSH connection

    Args:
        server_id: ID of the server to check
        task_id: Optional task ID for status tracking
        project_id: Project ID for isolation
    """
    task_service = None
    if task_id:
        try:
            task_service = get_service('task_service')
            task_service.update_task_status(task_id, "in_progress", progress=10)
        except Exception as e:
            logger.warning(f"Failed to update task status: {e}")


    with celery_db_session() as session:
        try:
            if project_id:
                server = session.query(Server).filter_by(id=server_id, project_id=project_id).first()
            else:
                server = session.query(Server).get(server_id)

            if not server:
                error_msg = f"Server {server_id} not found"
                logger.warning(error_msg)
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            helper = ProjectSettingsHelper(server.project_id)
            encryption_settings = helper.get_encryption_settings()
            if not encryption_settings.project_master_key:
                error_msg = f"No encryption key found for project {server.project_id}"
                logger.error(error_msg)
                server.status = "error"
                session.commit()
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            if task_service and task_id:
                task_service.update_task_status(task_id, "in_progress", progress=30)

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
                session.commit()
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
                session.commit()
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
            logger.error(f"Unexpected error in server_status_check: {e}", exc_info=True)
            if task_service and task_id:
                task_service.update_task_status(task_id, "failed", error=str(e))
            raise

@task_decorator(
    bind=True,
    name="backend.tasks.server_tasks.server_start",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def server_start(self, server_id, task_id=None, project_id=None):
    """
    Start server via SSH

    Args:
        server_id: ID of the server to start
        task_id: Optional task ID for status tracking
        project_id: Project ID for isolation
    """
    task_service = None
    if task_id:
        try:
            task_service = get_service('task_service')
            task_service.update_task_status(task_id, "in_progress", progress=10)
        except Exception as e:
            logger.warning(f"Failed to update task status: {e}")

    with celery_db_session() as session:
        try:
            if project_id:
                server = session.query(Server).filter_by(id=server_id, project_id=project_id).first()
            else:
                server = session.query(Server).get(server_id)

            if not server:
                error_msg = f"Server {server_id} not found"
                logger.warning(error_msg)
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            helper = ProjectSettingsHelper(server.project_id)
            encryption_settings = helper.get_encryption_settings()
            if not encryption_settings.project_master_key:
                error_msg = f"No encryption key found for project {server.project_id}"
                logger.error(error_msg)
                server.status = "error"
                session.commit()
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            server.status = "starting"
            session.commit()

            if task_service and task_id:
                task_service.update_task_status(task_id, "in_progress", progress=30)

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
                    timeout=10,
                )

                time.sleep(3)

                server.status = "online"
                session.commit()
                ssh.close()

                if task_service and task_id:
                    task_service.update_task_status(
                        task_id,
                        "completed",
                        progress=100,
                        result={"status": "online", "message": "Server started successfully"},
                    )

                return {"status": "online", "message": "Server started successfully"}

            except Exception as e:
                server.status = "offline"
                session.commit()
                logger.error(f"Error starting server {server.name}: {str(e)}")

                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=str(e))

                return {"status": "offline", "error": str(e)}
            finally:
                try:
                    ssh.close()
                except:
                    pass

        except Exception as e:
            logger.error(f"Unexpected error in server_start: {e}", exc_info=True)
            if task_service and task_id:
                task_service.update_task_status(task_id, "failed", error=str(e))
            raise

@task_decorator(
    bind=True,
    name="backend.tasks.server_tasks.server_stop",
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def server_stop(self, server_id, task_id=None, project_id=None):
    """
    Stop server via SSH

    Args:
        server_id: ID of the server to stop
        task_id: Optional task ID for status tracking
        project_id: Project ID for isolation
    """
    task_service = None
    if task_id:
        try:
            task_service = get_service('task_service')
            task_service.update_task_status(task_id, "in_progress", progress=10)
        except Exception as e:
            logger.warning(f"Failed to update task status: {e}")

    with celery_db_session() as session:
        try:
            if project_id:
                server = session.query(Server).filter_by(id=server_id, project_id=project_id).first()
            else:
                server = session.query(Server).get(server_id)

            if not server:
                error_msg = f"Server {server_id} not found"
                logger.warning(error_msg)
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            helper = ProjectSettingsHelper(server.project_id)
            encryption_settings = helper.get_encryption_settings()
            if not encryption_settings.project_master_key:
                error_msg = f"No encryption key found for project {server.project_id}"
                logger.error(error_msg)
                server.status = "error"
                session.commit()
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

            server.status = "stopping"
            session.commit()

            if task_service and task_id:
                task_service.update_task_status(task_id, "in_progress", progress=30)

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
                    timeout=10,
                )

                time.sleep(3)

                server.status = "offline"
                session.commit()
                ssh.close()

                if task_service and task_id:
                    task_service.update_task_status(
                        task_id,
                        "completed",
                        progress=100,
                        result={"status": "offline", "message": "Server stopped successfully"},
                    )

                return {"status": "offline", "message": "Server stopped successfully"}

            except Exception as e:
                logger.error(f"Error stopping server {server.name}: {str(e)}")

                try:
                    ssh.connect(
                        hostname=server.ip_address,
                        port=server.port,
                        username=server.username,
                        password=decrypted_password,
                        timeout=5,
                    )
                    server.status = "online"
                    ssh.close()
                except:
                    server.status = "offline"

                session.commit()

                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=str(e))

                return {"status": "error", "error": str(e)}
            finally:
                try:
                    ssh.close()
                except:
                    pass

        except Exception as e:
            logger.error(f"Unexpected error in server_stop: {e}", exc_info=True)
            if task_service and task_id:
                task_service.update_task_status(task_id, "failed", error=str(e))
            raise

@task_decorator(
    bind=True,
    name="backend.tasks.server_tasks.server_restart",
    max_retries=2,
    default_retry_delay=120,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def server_restart(self, server_id, task_id=None, project_id=None):
    """
    Restart server via SSH (stop then start)

    Args:
        server_id: ID of the server to restart
        task_id: Optional task ID for status tracking
        project_id: Project ID for isolation
    """
    task_service = None
    if task_id:
        try:
            task_service = get_service('task_service')
            task_service.update_task_status(task_id, "in_progress", progress=10)
        except Exception as e:
            logger.warning(f"Failed to update task status: {e}")

    try:

        with celery_db_session() as session:
            if project_id:
                server = session.query(Server).filter_by(id=server_id, project_id=project_id).first()
            else:
                server = session.query(Server).get(server_id)

            if not server:
                error_msg = f"Server {server_id} not found"
                if task_service and task_id:
                    task_service.update_task_status(task_id, "failed", error=error_msg)
                return {"status": "error", "error": error_msg}

        if task_service and task_id:
            task_service.update_task_status(task_id, "in_progress", progress=20)


        stop_task = server_stop.apply(
            args=[server_id], kwargs={"task_id": None, "project_id": project_id}
        )
        stop_result = stop_task.get(timeout=60)

        if task_service and task_id:
            task_service.update_task_status(task_id, "in_progress", progress=50)

        if stop_result and stop_result.get("status") == "error":
            error_msg = f"Failed to stop server: {stop_result.get('error', 'Unknown error')}"
            if task_service and task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}

        time.sleep(2)


        start_task = server_start.apply(
            args=[server_id], kwargs={"task_id": None, "project_id": project_id}
        )
        start_result = start_task.get(timeout=60)

        if task_service and task_id:
            if start_result and start_result.get("status") == "online":
                task_service.update_task_status(
                    task_id,
                    "completed",
                    progress=100,
                    result={"status": "online", "message": "Server restarted successfully"},
                )
            else:
                task_service.update_task_status(
                    task_id,
                    "failed",
                    error=(
                        start_result.get("error", "Failed to restart server")
                        if start_result
                        else "Unknown error"
                    ),
                )

        return (
            start_result
            if start_result
            else {"status": "error", "error": "Failed to restart server"}
        )

    except Exception as e:
        logger.error(f"Unexpected error in server_restart: {e}", exc_info=True)
        if task_service and task_id:
            task_service.update_task_status(task_id, "failed", error=str(e))
        raise
