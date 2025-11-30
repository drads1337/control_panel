"""
Task management service for handling async operations
Now uses Celery for distributed task processing
"""

import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import redis
from flask import current_app

from ...config.config import Config
from ...core.extensions import db

try:
    from ...tasks.server_tasks import server_restart, server_start, server_status_check, server_stop

    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    logging.warning("Celery tasks not available. Task processing may be limited.")

class TaskService:
    """Service for managing async tasks with status tracking"""

    def __init__(self):
        self.redis_client = self._init_redis_client()
        self.task_timeout = 300

    def _init_redis_client(self):
        """Initialize Redis client for task management"""
        try:
            client = redis.Redis(
                host=Config.REDIS_HOST,
                port=Config.REDIS_PORT,
                db=Config.REDIS_DB,
                password=Config.REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
                max_connections=20,
            )
            client.ping()
            return client
        except Exception as e:
            logging.error(f"Redis client initialization failed in task_service: {e}")
            raise RuntimeError("Redis is required for task management")

    def create_task(
        self, task_type: str, task_data: Dict[str, Any], user_id: int = None, project_id: int = None
    ) -> str:
        """
        Create a new task and return task ID
        Now uses Celery for task execution
        """
        task_id = str(uuid.uuid4())

        task_info = {
            "id": task_id,
            "type": task_type,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "project_id": project_id,
            "data": task_data,
            "progress": 0,
            "result": None,
            "error": None,
        }

        task_key = f"task:{task_id}"
        self.redis_client.setex(task_key, self.task_timeout, json.dumps(task_info))

        # Task types that are executed by task_service (server tasks)
        server_task_types = {
            "server_start": server_start,
            "server_stop": server_stop,
            "server_restart": server_restart,
            "server_status_check": server_status_check,
        }

        # Task types that are tracked but executed elsewhere (key tasks)
        # These tasks are executed directly by routes via apply_async()
        tracked_task_types = {
            "bulk_create_keys",
            "bulk_create_loader_keys",
        }

        # Check if this is a server task that needs to be executed
        if task_type in server_task_types:
            if not CELERY_AVAILABLE:
                error_msg = f"Celery is not available. Cannot create task {task_id} of type {task_type}. Celery workers must be running."
                logging.error(error_msg)
                # Update task status to failed
                self.update_task_status(task_id, "failed", error=error_msg)
                raise RuntimeError(error_msg)

            server_id = task_data.get("server_id")
            celery_task = server_task_types[task_type]

            try:
                celery_task.apply_async(
                    args=[server_id], kwargs={"task_id": task_id, "project_id": project_id}
                )
                logging.info(f"Task queued with Celery: {task_id} type={task_type}")
            except Exception as e:
                error_msg = f"Failed to queue task with Celery: {str(e)}"
                logging.error(f"{error_msg} - task_id={task_id}, type={task_type}")
                # Update task status to failed
                self.update_task_status(task_id, "failed", error=error_msg)
                raise RuntimeError(error_msg) from e
        elif task_type in tracked_task_types:
            # For tracked tasks (like key tasks), we just create the record
            # The actual task execution is handled by the route via apply_async()
            # Celery availability is checked by the route, not here
            logging.info(f"Task record created (execution handled elsewhere): {task_id} type={task_type}")
        else:
            error_msg = f"Unknown task type {task_type}. Cannot create task {task_id}. Supported types: {list(server_task_types.keys()) + list(tracked_task_types)}"
            logging.error(error_msg)
            # Update task status to failed
            self.update_task_status(task_id, "failed", error=error_msg)
            raise ValueError(error_msg)

        logging.info(f"Task created: {task_id} type={task_type}")
        return task_id

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get task status by ID
        """
        try:
            task_key = f"task:{task_id}"
            task_data = self.redis_client.get(task_key)

            if not task_data:
                return None

            return json.loads(task_data)
        except Exception as e:
            logging.error(f"Failed to get task status {task_id}: {e}")
            return None

    def update_task_status(
        self, task_id: str, status: str, progress: int = None, result: Any = None, error: str = None
    ) -> bool:
        """
        Update task status
        """
        try:
            task_key = f"task:{task_id}"
            task_data = self.redis_client.get(task_key)

            if not task_data:
                return False

            task_info = json.loads(task_data)
            task_info["status"] = status
            task_info["updated_at"] = datetime.utcnow().isoformat()

            if progress is not None:
                task_info["progress"] = progress

            if result is not None:
                task_info["result"] = result

            if error is not None:
                task_info["error"] = error

            self.redis_client.setex(task_key, self.task_timeout, json.dumps(task_info))

            self._publish_task_update(task_id, task_info)

            logging.info(f"Task {task_id} status updated to {status}")
            return True

        except Exception as e:
            logging.error(f"Failed to update task status {task_id}: {e}")
            return False

    def _publish_task_update(self, task_id: str, task_info: Dict[str, Any]):
        """
        Publish task update to Redis for real-time notifications
        """
        try:
            update_data = {
                "task_id": task_id,
                "status": task_info["status"],
                "progress": task_info.get("progress", 0),
                "result": task_info.get("result"),
                "error": task_info.get("error"),
                "timestamp": datetime.utcnow().isoformat(),
            }

            self.redis_client.publish("task_updates", json.dumps(update_data))

            if task_info.get("user_id"):
                user_channel = f"user_tasks:{task_info['user_id']}"
                self.redis_client.publish(user_channel, json.dumps(update_data))

            if task_info.get("project_id"):
                project_channel = f"project_tasks:{task_info['project_id']}"
                self.redis_client.publish(project_channel, json.dumps(update_data))

        except Exception as e:
            logging.error(f"Failed to publish task update {task_id}: {e}")

    def get_user_tasks(self, user_id: int, limit: int = 50) -> list:
        """
        Get recent tasks for a user
        """
        try:

            user_tasks_key = f"user_tasks:{user_id}"
            task_ids = self.redis_client.lrange(user_tasks_key, 0, limit - 1)

            tasks = []
            for task_id in task_ids:
                task_info = self.get_task_status(task_id)
                if task_info:
                    tasks.append(task_info)

            return tasks

        except Exception as e:
            logging.error(f"Failed to get user tasks {user_id}: {e}")
            return []

    def cleanup_old_tasks(self, days: int = 7):
        """
        Clean up old completed tasks
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)

            task_keys = self.redis_client.keys("task:*")

            cleaned_count = 0
            for task_key in task_keys:
                task_data = self.redis_client.get(task_key)
                if task_data:
                    task_info = json.loads(task_data)

                    created_at = datetime.fromisoformat(task_info["created_at"])
                    if created_at < cutoff_date and task_info["status"] in ["completed", "failed"]:

                        self.redis_client.delete(task_key)
                        cleaned_count += 1

            logging.info(f"Cleaned up {cleaned_count} old tasks")
            return cleaned_count

        except Exception as e:
            logging.error(f"Failed to cleanup old tasks: {e}")
            return 0

