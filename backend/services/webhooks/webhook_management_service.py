"""
Webhook Management Service
Handles CRUD operations for webhooks
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from ...core.extensions import db
from ...models.webhooks import Webhook, WebhookLog
from ...utils.data_masking import mask_key
from ...utils.service_helpers import get_service

class WebhookManagementService:
    """Service for managing webhook CRUD operations"""

    def __init__(self, webhook_crypto_service=None):
        self._webhook_crypto_service = webhook_crypto_service
        self.logger = logging.getLogger(__name__)

    def create_webhook(
        self,
        project_id: int,
        name: str,
        webhook_type: str = "custom",
        url: Optional[str] = None,
        events: List[str] = None,
        secret: Optional[str] = None,
        is_active: bool = True,
        headers: Optional[Dict] = None,
        telegram_bot_token: Optional[str] = None,
        telegram_chat_id: Optional[str] = None,
        discord_webhook_url: Optional[str] = None,
        discord_bot_token: Optional[str] = None,
        discord_channel_id: Optional[str] = None,
    ) -> Dict:
        """Create a new webhook"""
        try:
            webhook_crypto_service = get_service('webhook_crypto_service')
            
            if not secret:
                secret = webhook_crypto_service.generate_secret()

            webhook = Webhook(
                project_id=project_id,
                name=name,
                webhook_type=webhook_type,
                url=url,
                events=json.dumps(events or []),
                secret=secret,
                is_active=is_active,
                headers=json.dumps(headers or {}),
                telegram_bot_token=telegram_bot_token,
                telegram_chat_id=telegram_chat_id,
                discord_webhook_url=discord_webhook_url,
                discord_bot_token=discord_bot_token,
                discord_channel_id=discord_channel_id,
                created_at=datetime.utcnow(),
            )

            db.session.add(webhook)
            db.session.commit()

            logging.info(
                f"WEBHOOK_CREATED webhook_id={webhook.id} project_id={project_id} name={name}"
            )

            return {
                "id": webhook.id,
                "name": webhook.name,
                "url": webhook.url,
                "events": events or [],
                "secret": webhook.secret,
                "is_active": webhook.is_active,
                "created_at": webhook.created_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"WEBHOOK_CREATION_ERROR project_id={project_id} error={e}")
            raise ValueError(f"Failed to create webhook: {str(e)}")

    def update_webhook(self, webhook_id: int, project_id: Optional[int] = None, **kwargs) -> Dict:
        """Update an existing webhook"""
        try:
            # Get webhook
            if project_id:
                webhook = Webhook.query.filter_by(id=webhook_id, project_id=project_id).first()
            else:
                # Fallback for backward compatibility
                webhook = Webhook.query.filter_by(id=webhook_id).first()
            
            if not webhook:
                raise ValueError("Webhook not found")

            if "name" in kwargs:
                webhook.name = kwargs["name"]

            if "url" in kwargs:
                webhook.url = kwargs["url"]

            if "events" in kwargs:
                webhook.events = json.dumps(kwargs["events"])

            if "secret" in kwargs:
                webhook.secret = kwargs["secret"]

            if "is_active" in kwargs:
                webhook.is_active = kwargs["is_active"]

            if "headers" in kwargs:
                webhook.headers = json.dumps(kwargs["headers"])

            webhook.updated_at = datetime.utcnow()

            db.session.commit()

            logging.info(f"WEBHOOK_UPDATED webhook_id={webhook_id}")

            return {
                "id": webhook.id,
                "name": webhook.name,
                "url": webhook.url,
                "events": json.loads(webhook.events),
                "secret": webhook.secret,
                "is_active": webhook.is_active,
                "updated_at": webhook.updated_at.isoformat(),
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"WEBHOOK_UPDATE_ERROR webhook_id={webhook_id} error={e}")
            raise ValueError(f"Failed to update webhook: {str(e)}")

    def delete_webhook(self, webhook_id: int, project_id: Optional[int] = None) -> bool:
        """Delete a webhook"""
        try:
            # Get webhook
            if project_id:
                webhook = Webhook.query.filter_by(id=webhook_id, project_id=project_id).first()
            else:
                # Fallback for backward compatibility
                webhook = Webhook.query.filter_by(id=webhook_id).first()
            
            if not webhook:
                return False

            WebhookLog.query.filter_by(webhook_id=webhook_id).delete()

            db.session.delete(webhook)
            db.session.commit()

            logging.info(f"WEBHOOK_DELETED webhook_id={webhook_id}")
            return True

        except Exception as e:
            db.session.rollback()
            logging.error(f"WEBHOOK_DELETION_ERROR webhook_id={webhook_id} error={e}")
            return False

    def get_webhooks(self, project_id: Optional[int] = None) -> List[Dict]:
        """
        Get webhooks for a project
        
        SECURITY: Sensitive data (tokens, secrets) are masked in GET responses
        to prevent XSS attacks from exposing credentials. Full values are only
        returned when explicitly needed (e.g., during webhook execution).
        """
        try:
            # Get webhooks
            if project_id:
                webhooks = Webhook.query.filter_by(project_id=project_id).order_by(Webhook.created_at.desc()).all()
            else:
                # Fallback for backward compatibility
                webhooks = Webhook.query.order_by(Webhook.created_at.desc()).all()

            return [
                {
                    "id": webhook.id,
                    "project_id": webhook.project_id,
                    "name": webhook.name,
                    "webhook_type": webhook.webhook_type,
                    "url": webhook.url,
                    "events": json.loads(webhook.events),
                    # SECURITY: Mask secret to prevent XSS exposure
                    "secret": mask_key(webhook.secret) if webhook.secret else None,
                    "is_active": webhook.is_active,
                    "headers": json.loads(webhook.headers or "{}"),
                    # SECURITY: Mask tokens to prevent XSS exposure
                    "telegram_bot_token": mask_key(webhook.telegram_bot_token) if webhook.telegram_bot_token else None,
                    "telegram_chat_id": webhook.telegram_chat_id,
                    "discord_webhook_url": webhook.discord_webhook_url,
                    # SECURITY: Mask bot token to prevent XSS exposure
                    "discord_bot_token": mask_key(webhook.discord_bot_token) if webhook.discord_bot_token else None,
                    "discord_channel_id": webhook.discord_channel_id,
                    "created_at": webhook.created_at.isoformat(),
                    "updated_at": webhook.updated_at.isoformat() if webhook.updated_at else None,
                    "last_triggered": (
                        webhook.last_triggered.isoformat() if webhook.last_triggered else None
                    ),
                    "success_count": webhook.success_count,
                    "failure_count": webhook.failure_count,
                }
                for webhook in webhooks
            ]

        except Exception as e:
            logging.error(f"WEBHOOK_GET_ERROR project_id={project_id} error={e}")
            return []

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
            logging.error(f"WEBHOOK_LOGS_ERROR webhook_id={webhook_id} error={e}")
            return []

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
            logging.error(f"WEBHOOK_STATISTICS_ERROR project_id={project_id} error={e}")
            return {}

    def update_webhook_stats(self, webhook_id: int, success: bool, project_id: Optional[int] = None):
        """Update webhook statistics"""
        try:
            # Get webhook
            if project_id:
                webhook = Webhook.query.filter_by(id=webhook_id, project_id=project_id).first()
            else:
                # Fallback for backward compatibility
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
            logging.error(f"WEBHOOK_STATS_UPDATE_ERROR webhook_id={webhook_id} error={e}")

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
            logging.error(f"WEBHOOK_LOG_ERROR webhook_id={webhook_id} error={e}")

