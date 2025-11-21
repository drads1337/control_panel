"""
Celery tasks for key operations
Handles bulk key creation asynchronously to prevent blocking HTTP requests
"""

import json
import logging
from datetime import datetime, timedelta

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
from ..core.extensions import db
from ..models.core import User
from ..models.products import Product
from ..models.keys import Key
from ..models.agents import Agent
from ..services.activity import activity_service
from ..services.keys.key_service_facade import key_service
from ..services.tasks import task_service
from ..utils.rbac_utils import RBACManager

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
    name="backend.tasks.key_tasks.bulk_create_keys",
    max_retries=2,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def bulk_create_keys_task(
    self,
    user_id: int,
    count: int,
    product_id: int,
    duration_hours: float,
    max_devices: int,
    task_id: str = None,
    project_id: int = None,
    remote_addr: str = None,
):
    """
    Bulk create keys asynchronously

    Args:
        user_id: ID of the user creating keys
        count: Number of keys to create
        product_id: ID of the product
        duration_hours: Duration in hours
        max_devices: Maximum devices per key
        task_id: Optional task ID for status tracking
        project_id: Project ID for isolation
        remote_addr: Remote address for activity logging
    """

    if not hasattr(self, "_db_session") or self._db_session is None:
        if Session is None:
            error_msg = "Database session not available. Celery may not be properly configured."
            logger.error(error_msg)
            if task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}
        self._db_session = Session()
    session = self._db_session

    try:
        if task_id:
            task_service.update_task_status(task_id, "in_progress", progress=5)

        user = session.query(User).get(user_id)
        if not user:
            error_msg = f"User {user_id} not found"
            logger.error(error_msg)
            if task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}

        if not project_id:
            project_id = user.project_id

        product = session.query(Product).filter_by(id=product_id, project_id=project_id).first()
        if not product:
            error_msg = f"Product {product_id} not found or access denied"
            logger.error(error_msg)
            if task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}

        is_access_code = product.login_type == "classic_login"
        generation_type = "access_code" if is_access_code else "license_key"

        if task_id:
            task_service.update_task_status(task_id, "in_progress", progress=10)

        created_keys = []
        batch_id = f'batch_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}'
        errors = []

        expires_at = None
        if duration_hours:
            expires_at = datetime.utcnow() + timedelta(hours=duration_hours)

        total = count
        for i in range(count):
            try:

                if task_id and (i + 1) % max(1, total // 10) == 0:
                    progress = 10 + int((i + 1) / total * 80)
                    task_service.update_task_status(task_id, "in_progress", progress=progress)

                key_string = key_service.generate_key_string(
                    length=32, product=product, duration_hours=duration_hours, project_id=project_id
                )

                key_metadata = {
                    "type": "production",
                    "generation_type": generation_type,
                    "created_by": user.id,
                    "created_by_role": (
                        RBACManager.get_user_role_names(user)[0]
                        if RBACManager.get_user_role_names(user)
                        else "client"
                    ),
                    "batch_id": batch_id,
                }

                key = Key(
                    key=key_string,
                    user_id=user.id,
                    product_id=product_id,
                    expires_at=expires_at,
                    max_devices=max_devices,
                    duration_hours=duration_hours,
                    status=1,
                    project_id=project_id,
                    key_metadata=json.dumps(key_metadata),
                )

                session.add(key)
                session.flush()

                from ...utils.key_counters import increment_user_key_counters
                increment_user_key_counters(user.id, is_active=True)

                if project_id:
                    from ...utils.project_counters import increment_project_key_counters
                    increment_project_key_counters(project_id, is_active=True)

                created_keys.append(key)

            except Exception as key_error:
                errors.append(f"Key {i+1}: {str(key_error)}")
                logger.error(f"🔑 Failed to create key {i+1}: {str(key_error)}")

        if created_keys:
            session.commit()
            logger.info(f"🔑 Bulk created {len(created_keys)} keys")

        if errors and not created_keys:
            error_msg = f"All keys failed to create: {errors}"
            if task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}

        created_count = len(created_keys)

        try:
            from ..routes.files import clear_storage_cache

            clear_storage_cache(project_id)
        except (ImportError, Exception):
            pass

        item_type = "access codes" if is_access_code else "license keys"
        activity_service.log_activity(
            user,
            "bulk_create_keys",
            details=f"Created {created_count} production {item_type} for product: {product.name}",
            ip=remote_addr,
        )

        result = {
            "status": "completed",
            "message": f"Successfully created {created_count} {item_type}",
            "summary": {
                "count": created_count,
                "product_name": product.name,
                "duration_hours": duration_hours,
                "max_devices": max_devices,
            },
            "errors": errors if errors else None,
        }

        if task_id:
            task_service.update_task_status(
                task_id, "completed", progress=100, result=result
            )

        return result

    except Exception as e:
        logger.error(f"Unexpected error in bulk_create_keys_task: {e}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        error_msg = f"Failed to create bulk keys: {str(e)}"
        if task_id:
            task_service.update_task_status(task_id, "failed", error=error_msg)
        return {"status": "error", "error": error_msg}

@task_decorator(
    bind=True,
    base=DatabaseTask,
    name="backend.tasks.key_tasks.bulk_create_loader_keys",
    max_retries=2,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def bulk_create_loader_keys_task(
    self,
    user_id: int,
    count: int,
    agent_id: int,
    product_ids: list,
    duration_hours: float,
    max_devices: int,
    task_id: str = None,
    project_id: int = None,
    remote_addr: str = None,
):
    """
    Bulk create agent keys asynchronously

    Args:
        user_id: ID of the user creating keys
        count: Number of keys to create
        agent_id: ID of the agent
        product_ids: List of product IDs
        duration_hours: Duration in hours
        max_devices: Maximum devices per key
        task_id: Optional task ID for status tracking
        project_id: Project ID for isolation
        remote_addr: Remote address for activity logging
    """

    if not hasattr(self, "_db_session") or self._db_session is None:
        if Session is None:
            error_msg = "Database session not available. Celery may not be properly configured."
            logger.error(error_msg)
            if task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}
        self._db_session = Session()
    session = self._db_session

    try:
        if task_id:
            task_service.update_task_status(task_id, "in_progress", progress=5)

        user = session.query(User).get(user_id)
        if not user:
            error_msg = f"User {user_id} not found"
            logger.error(error_msg)
            if task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}

        if not project_id:
            project_id = user.project_id

        agent = session.query(Agent).filter_by(id=agent_id, project_id=project_id).first()
        if not agent:
            error_msg = f"Agent {agent_id} not found or access denied"
            logger.error(error_msg)
            if task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}

        products = (
            session.query(Product)
            .filter(Product.id.in_(product_ids), Product.project_id == project_id)
            .all()
        )
        if len(products) != len(product_ids):
            error_msg = "Some products not found or access denied"
            logger.error(error_msg)
            if task_id:
                task_service.update_task_status(task_id, "failed", error=error_msg)
            return {"status": "error", "error": error_msg}

        if task_id:
            task_service.update_task_status(task_id, "in_progress", progress=10)

        created_keys = []
        total_operations = count * len(products)

        for i in range(count):
            try:

                if task_id and (i + 1) % max(1, count // 10) == 0:
                    progress = 10 + int((i + 1) / count * 80)
                    task_service.update_task_status(task_id, "in_progress", progress=progress)

                key_string = key_service.generate_key_string(
                    length=32, agent=agent, duration_hours=duration_hours, project_id=project_id
                )

                for product in products:
                    key = Key(
                        key=key_string,
                        user_id=None,
                        product_id=product.id,
                        status=1,
                        max_devices=max_devices,
                        duration_hours=duration_hours,
                        expires_at=None,
                        project_id=project_id,
                        created_at=datetime.utcnow(),
                    )

                    key_metadata = {
                        "type": "loader_bulk",
                        "created_by": user.id,
                        "created_by_role": (
                            RBACManager.get_user_role_names(user)[0]
                            if RBACManager.get_user_role_names(user)
                            else "client"
                        ),
                        "agent_id": agent_id,
                        "product_ids": product_ids,
                        "batch_id": f'loader_batch_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}_{i}',
                    }
                    key.key_metadata = json.dumps(key_metadata)

                    session.add(key)
                    created_keys.append(key_string)

            except Exception as key_error:
                logger.error(f"🔑 Failed to create agent key {i+1}: {str(key_error)}")

        if created_keys:
            session.commit()
            logger.info(f"🔑 Bulk created {len(set(created_keys))} agent keys")

        activity_service.log_activity(
            user,
            "bulk_create_loader_keys",
            details=f"Created {count} agent keys for {len(products)} products via agent: {agent.name}",
            ip=remote_addr,
        )

        result = {
            "status": "completed",
            "message": f"Successfully created {count} agent keys for {len(products)} products",
            "keys": list(set(created_keys)),
            "summary": {
                "count": count,
                "products_count": len(products),
                "agent_name": agent.name,
                "duration_hours": duration_hours,
                "max_devices": max_devices,
            },
        }

        if task_id:
            task_service.update_task_status(
                task_id, "completed", progress=100, result=result
            )

        return result

    except Exception as e:
        logger.error(f"Unexpected error in bulk_create_loader_keys_task: {e}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        error_msg = f"Failed to create agent keys: {str(e)}"
        if task_id:
            task_service.update_task_status(task_id, "failed", error=error_msg)
        return {"status": "error", "error": error_msg}
