"""
Webhook Logging Service
Handles logging and statistics for webhooks
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from ...core.extensions import db
from ...models.webhooks import Webhook, WebhookLog

class WebhookLoggingService:
    """Service for logging and statistics related to webhooks"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def log_webhook_result(
        self,
        webhook_id: int,
        event: str,
        success: bool,
        error_message: Optional[str],
        payload: Dict,
    ):
        """Log webhook result"""
        try:
            log_entry = WebhookLog(
                webhook_id=webhook_id,
                event=event,
                success=success,
                error_message=error_message,
                payload=json.dumps(payload),
                created_at=datetime.utcnow(),
            )

            db.session.add(log_entry)
            db.session.commit()

        except Exception as e:
            self.logger.error(f"WEBHOOK_LOG_ERROR webhook_id={webhook_id} error={e}")

    def log_webhook_result_with_context(
        self,
        webhook_id: int,
        event: str,
        success: bool,
        error_message: Optional[str],
        payload: Dict,
    ):
        """Log webhook result with Flask app context"""
        try:
            from flask import current_app

            app = current_app._get_current_object()

            with app.app_context():
                log_entry = WebhookLog(
                    webhook_id=webhook_id,
                    event=event,
                    success=success,
                    error_message=error_message,
                    payload=json.dumps(payload),
                    created_at=datetime.utcnow(),
                )

                db.session.add(log_entry)
                db.session.commit()

        except Exception as e:
            self.logger.error(f"WEBHOOK_LOG_ERROR: {e}")

    def get_webhook_logs(self, webhook_id: int, limit: int = 100) -> List[Dict]:
        """Get webhook logs"""
        try:
            logs = (
                WebhookLog.query.filter_by(webhook_id=webhook_id)
                .order_by(WebhookLog.created_at.desc())
                .limit(limit)
                .all()
            )

            return [
                {
                    "id": log.id,
                    "webhook_id": log.webhook_id,
                    "event": log.event,
                    "success": log.success,
                    "error_message": log.error_message,
                    "payload": json.loads(log.payload),
                    "created_at": log.created_at.isoformat(),
                }
                for log in logs
            ]

        except Exception as e:
            self.logger.error(f"WEBHOOK_LOGS_ERROR webhook_id={webhook_id} error={e}")
            return []

    def update_webhook_stats(self, webhook_id: int, success: bool, project_id: Optional[int] = None):
        """Update webhook statistics"""
        try:

            if project_id:
                webhook = Webhook.query.filter_by(id=webhook_id, project_id=project_id).first()
            else:

                webhook = Webhook.query.filter_by(id=webhook_id).first()
            
            if not webhook:
                return

            if success:
                webhook.success_count += 1
            else:
                webhook.failure_count += 1

            webhook.last_triggered = datetime.utcnow()
            db.session.commit()

        except Exception as e:
            self.logger.error(f"WEBHOOK_STATS_UPDATE_ERROR webhook_id={webhook_id} error={e}")

    def update_webhook_stats_with_context(self, webhook_id: int, success: bool):
        """Update webhook statistics with Flask app context"""
        try:
            from flask import current_app

            app = current_app._get_current_object()

            with app.app_context():
                webhook = Webhook.query.filter_by(id=webhook_id).first()
                if not webhook:
                    return

                if success:
                    webhook.success_count += 1
                else:
                    webhook.failure_count += 1

                webhook.last_triggered = datetime.utcnow()
                db.session.commit()

        except Exception as e:
            self.logger.error(f"WEBHOOK_STATS_UPDATE_ERROR: {e}")

    def get_webhook_statistics(self, project_id: Optional[int] = None) -> Dict:
        """Get webhook statistics"""
        try:
            query = Webhook.query
            if project_id:
                query = query.filter(Webhook.project_id == project_id)

            webhooks = query.all()

            total_webhooks = len(webhooks)
            active_webhooks = len([w for w in webhooks if w.is_active])
            total_success = sum(w.success_count for w in webhooks)
            total_failures = sum(w.failure_count for w in webhooks)

            recent_logs = WebhookLog.query.filter(
                WebhookLog.created_at >= datetime.utcnow() - timedelta(hours=24)
            )
            if project_id:
                recent_logs = recent_logs.join(Webhook).filter(Webhook.project_id == project_id)

            recent_success = recent_logs.filter(WebhookLog.success == True).count()
            recent_failures = recent_logs.filter(WebhookLog.success == False).count()

            return {
                "total_webhooks": total_webhooks,
                "active_webhooks": active_webhooks,
                "total_success": total_success,
                "total_failures": total_failures,
                "success_rate": round(
                    total_success / max(1, total_success + total_failures) * 100, 2
                ),
                "recent_success": recent_success,
                "recent_failures": recent_failures,
                "recent_success_rate": round(
                    recent_success / max(1, recent_success + recent_failures) * 100, 2
                ),
            }

        except Exception as e:
            self.logger.error(f"WEBHOOK_STATISTICS_ERROR project_id={project_id} error={e}")
            return {}

