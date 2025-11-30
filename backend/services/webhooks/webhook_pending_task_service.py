"""
Webhook Pending Task Service
Handles processing of pending webhook tasks when Celery is unavailable
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict

from ...core.extensions import db
from ...models.webhooks import WebhookPendingTask


try:
    from ...tasks.webhook_tasks import process_webhook as celery_process_webhook
    CELERY_AVAILABLE = True
except ImportError:
    CELERY_AVAILABLE = False
    celery_process_webhook = None

class WebhookPendingTaskService:
    """Service for managing pending webhook tasks"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def store_pending_webhook_task(
        self, webhook_id: int, project_id: int, event: str, webhook_data: Dict, error_reason: str
    ) -> None:
        """
        Store webhook task in database for later processing when Celery is unavailable.
        
        SECURITY: This prevents blocking API workers when Celery/Redis fails.
        Tasks stored here should be processed by a separate cron job/worker.
        
        Args:
            webhook_id: ID of the webhook
            project_id: ID of the project
            event: Event name
            webhook_data: Complete webhook data dictionary (will be serialized to JSON)
            error_reason: Reason why task couldn't be queued (for logging)
        """
        try:

            webhook_data_json = json.dumps(webhook_data)
            


            next_retry = datetime.utcnow() + timedelta(seconds=60)
            
            pending_task = WebhookPendingTask(
                webhook_id=webhook_id,
                project_id=project_id,
                event=event,
                webhook_data=webhook_data_json,
                status="pending",
                retry_count=0,
                error_message=f"Failed to queue in Celery: {error_reason}",
                created_at=datetime.utcnow(),
                next_retry_at=next_retry
            )
            
            db.session.add(pending_task)
            db.session.commit()
            
            self.logger.info(
                f"WEBHOOK_PENDING_TASK_STORED webhook_id={webhook_id} event={event} "
                f"task_id={pending_task.id} error={error_reason}"
            )
        except Exception as e:
            db.session.rollback()
            self.logger.error(
                f"WEBHOOK_PENDING_TASK_STORE_ERROR webhook_id={webhook_id} event={event} "
                f"error={e}. Task will be lost."
            )

    def process_pending_webhook_tasks(self, batch_size: int = 50) -> Dict[str, int]:
        """
        Process pending webhook tasks from database.
        
        This method should be called periodically by a scheduled task/cron job
        to process webhook tasks that failed to be queued in Celery.
        
        Args:
            batch_size: Maximum number of tasks to process in one batch
            
        Returns:
            Dictionary with statistics:
                - processed: Number of tasks processed
                - queued: Number of tasks successfully queued in Celery
                - failed: Number of tasks that failed permanently
                - retry_later: Number of tasks scheduled for retry later
        """
        stats = {
            "processed": 0,
            "queued": 0,
            "failed": 0,
            "retry_later": 0,
        }
        
        try:
            now = datetime.utcnow()
            


            pending_tasks = (
                WebhookPendingTask.query
                .filter(
                    WebhookPendingTask.status.in_(["pending", "processing"]),
                    WebhookPendingTask.next_retry_at <= now,
                )
                .order_by(WebhookPendingTask.next_retry_at.asc())
                .limit(batch_size)
                .all()
            )
            
            if not pending_tasks:
                self.logger.debug("No pending webhook tasks to process")
                return stats
            
            self.logger.info(f"Processing {len(pending_tasks)} pending webhook tasks")
            

            retry_delays = [60, 300, 900, 1800, 3600, 21600, 86400]
            max_retries = len(retry_delays)
            
            for task in pending_tasks:
                try:
                    stats["processed"] += 1
                    

                    task.status = "processing"
                    db.session.commit()
                    

                    webhook_data = json.loads(task.webhook_data)
                    

                    if CELERY_AVAILABLE and celery_process_webhook:
                        try:
                            celery_process_webhook.delay(webhook_data)

                            task.status = "completed"
                            task.processed_at = datetime.utcnow()
                            db.session.commit()
                            stats["queued"] += 1
                            self.logger.info(
                                f"WEBHOOK_PENDING_TASK_QUEUED task_id={task.id} "
                                f"webhook_id={task.webhook_id} event={task.event}"
                            )
                            continue
                        except Exception as e:

                            self.logger.warning(
                                f"WEBHOOK_PENDING_TASK_CELERY_FAILED task_id={task.id} error={e}"
                            )
                            error_reason = str(e)
                    else:
                        error_reason = "Celery not available"
                    

                    if task.retry_count >= max_retries:

                        task.status = "failed"
                        task.processed_at = datetime.utcnow()
                        task.error_message = f"Max retries exceeded: {error_reason}"
                        db.session.commit()
                        stats["failed"] += 1
                        self.logger.error(
                            f"WEBHOOK_PENDING_TASK_FAILED task_id={task.id} "
                            f"webhook_id={task.webhook_id} retry_count={task.retry_count}"
                        )
                    else:

                        delay_seconds = retry_delays[min(task.retry_count, len(retry_delays) - 1)]
                        task.status = "pending"
                        task.retry_count += 1
                        task.next_retry_at = datetime.utcnow() + timedelta(seconds=delay_seconds)
                        task.error_message = f"Retry {task.retry_count}/{max_retries}: {error_reason}"
                        db.session.commit()
                        stats["retry_later"] += 1
                        self.logger.info(
                            f"WEBHOOK_PENDING_TASK_RETRY_SCHEDULED task_id={task.id} "
                            f"retry_count={task.retry_count} next_retry_at={task.next_retry_at}"
                        )
                        
                except Exception as e:
                    db.session.rollback()
                    self.logger.error(
                        f"WEBHOOK_PENDING_TASK_PROCESS_ERROR task_id={task.id} error={e}",
                        exc_info=True
                    )

                    try:
                        task.status = "pending"
                        task.retry_count += 1
                        task.next_retry_at = datetime.utcnow() + timedelta(seconds=300)
                        task.error_message = f"Processing error: {str(e)}"
                        db.session.commit()
                        stats["retry_later"] += 1
                    except Exception as commit_error:
                        self.logger.error(
                            f"WEBHOOK_PENDING_TASK_COMMIT_ERROR task_id={task.id} error={commit_error}"
                        )
            
            self.logger.info(
                f"WEBHOOK_PENDING_TASKS_PROCESSED processed={stats['processed']} "
                f"queued={stats['queued']} failed={stats['failed']} retry_later={stats['retry_later']}"
            )
            
            return stats
            
        except Exception as e:
            self.logger.error(f"WEBHOOK_PENDING_TASKS_ERROR: {e}", exc_info=True)
            return stats

    def cleanup_old_pending_tasks(self, days_old: int = 7) -> int:
        """
        Clean up old completed/failed webhook pending tasks.
        
        Args:
            days_old: Delete tasks older than this many days (default: 7)
            
        Returns:
            Number of tasks deleted
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days_old)
            
            deleted_count = (
                WebhookPendingTask.query
                .filter(
                    WebhookPendingTask.status.in_(["completed", "failed"]),
                    WebhookPendingTask.processed_at < cutoff_date,
                )
                .delete()
            )
            
            db.session.commit()
            
            if deleted_count > 0:
                self.logger.info(f"CLEANED_UP_OLD_PENDING_TASKS deleted={deleted_count} older_than={days_old}days")
            
            return deleted_count
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"CLEANUP_OLD_PENDING_TASKS_ERROR: {e}")
            return 0

