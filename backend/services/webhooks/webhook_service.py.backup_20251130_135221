"""
Webhook Service
Main coordinator service for webhook operations
Delegates to specialized services for specific functionality
"""

import logging
from typing import Dict, List, Optional, Tuple

from ...models.webhooks import Webhook
from ...utils.service_helpers import get_service
from ...utils.service_exceptions import ServiceError

class WebhookService:
    """Main service for managing webhook notifications - coordinates specialized services"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    # ==================== CRUD Operations ====================
    # Delegated to WebhookManagementService

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
        # Validate before creating
        validation_service = get_service('webhook_validation_service')
        is_valid, error = validation_service.validate_webhook_creation_data(
            webhook_type=webhook_type,
            url=url,
            telegram_bot_token=telegram_bot_token,
            telegram_chat_id=telegram_chat_id,
            discord_webhook_url=discord_webhook_url,
            discord_bot_token=discord_bot_token,
            discord_channel_id=discord_channel_id,
            name=name,
            events=events,
        )
        
        if not is_valid:
            raise ValueError(error)

        # Delegate to management service
        management_service = get_service('webhook_management_service')
        return management_service.create_webhook(
                project_id=project_id,
                name=name,
                webhook_type=webhook_type,
                url=url,
            events=events,
                secret=secret,
                is_active=is_active,
            headers=headers,
                telegram_bot_token=telegram_bot_token,
                telegram_chat_id=telegram_chat_id,
                discord_webhook_url=discord_webhook_url,
                discord_bot_token=discord_bot_token,
                discord_channel_id=discord_channel_id,
        )

    def update_webhook(self, webhook_id: int, project_id: Optional[int] = None, **kwargs) -> Dict:
        """Update an existing webhook"""
        # Validate URL if provided
        if "url" in kwargs:
            validation_service = get_service('webhook_validation_service')
            if not validation_service.validate_url(kwargs["url"]):
                raise ValueError("Invalid webhook URL")

        # Validate events if provided
        if "events" in kwargs:
            formatting_service = get_service('webhook_formatting_service')
            valid_events = formatting_service.get_valid_events()
            for event in kwargs["events"]:
                if event not in valid_events:
                    raise ValueError(f"Invalid event: {event}")

        # Delegate to management service
        management_service = get_service('webhook_management_service')
        return management_service.update_webhook(webhook_id, project_id, **kwargs)

    def delete_webhook(self, webhook_id: int, project_id: Optional[int] = None) -> bool:
        """Delete a webhook"""
        management_service = get_service('webhook_management_service')
        return management_service.delete_webhook(webhook_id, project_id)

    def get_webhooks(self, project_id: Optional[int] = None) -> List[Dict]:
        """Get webhooks for a project"""
        management_service = get_service('webhook_management_service')
        return management_service.get_webhooks(project_id)

    # ==================== Execution ====================
    # Delegated to WebhookExecutionService

    def trigger_webhook(self, event: str, data: Dict, project_id: Optional[int] = None) -> bool:
        """Trigger webhooks for a specific event"""
        execution_service = get_service('webhook_execution_service')
        return execution_service.trigger_webhook(event, data, project_id)

    # ==================== Logging and Statistics ====================
    # Delegated to WebhookLoggingService

    def get_webhook_logs(self, webhook_id: int, limit: int = 100) -> List[Dict]:
        """Get webhook logs"""
        logging_service = get_service('webhook_logging_service')
        return logging_service.get_webhook_logs(webhook_id, limit)

    def get_webhook_statistics(self, project_id: Optional[int] = None) -> Dict:
        """Get webhook statistics"""
        logging_service = get_service('webhook_logging_service')
        return logging_service.get_webhook_statistics(project_id)

    def _log_webhook_result(
        self,
        webhook_id: int,
        event: str,
        success: bool,
        error_message: Optional[str],
        payload: Dict,
    ):
        """Log webhook result (internal method for backward compatibility)"""
        logging_service = get_service('webhook_logging_service')
        logging_service.log_webhook_result(webhook_id, event, success, error_message, payload)

    def _log_webhook_result_with_context(
        self,
        webhook_id: int,
        event: str,
        success: bool,
        error_message: Optional[str],
        payload: Dict,
    ):
        """Log webhook result with Flask app context (internal method for backward compatibility)"""
        logging_service = get_service('webhook_logging_service')
        logging_service.log_webhook_result_with_context(webhook_id, event, success, error_message, payload)

    def _update_webhook_stats(self, webhook_id: int, success: bool, project_id: Optional[int] = None):
        """Update webhook statistics (internal method for backward compatibility)"""
        logging_service = get_service('webhook_logging_service')
        logging_service.update_webhook_stats(webhook_id, success, project_id)

    def _update_webhook_stats_with_context(self, webhook_id: int, success: bool):
        """Update webhook statistics with Flask app context (internal method for backward compatibility)"""
        logging_service = get_service('webhook_logging_service')
        logging_service.update_webhook_stats_with_context(webhook_id, success)

    # ==================== Testing ====================
    # Delegated to WebhookTestingService

    def test_webhook(self, webhook_id: int) -> Dict:
        """Test a webhook with a test payload"""
        testing_service = get_service('webhook_testing_service')
        return testing_service.test_webhook(webhook_id)

    # ==================== Validation ====================
    # Delegated to WebhookValidationService

    def validate_webhook_access(self, user_id: int, project_id: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """Validate user access to webhooks"""
        validation_service = get_service('webhook_validation_service')
        return validation_service.validate_webhook_access(user_id, project_id)

    def validate_webhook_ownership(
        self, user_id: int, webhook_id: int
    ) -> Tuple[bool, Optional[str], Optional[Webhook]]:
        """Validate user ownership/access to a specific webhook"""
        validation_service = get_service('webhook_validation_service')
        return validation_service.validate_webhook_ownership(user_id, webhook_id)

    def validate_webhook_creation_data(
        self,
        webhook_type: str,
        url: Optional[str] = None,
        telegram_bot_token: Optional[str] = None,
        telegram_chat_id: Optional[str] = None,
        discord_webhook_url: Optional[str] = None,
        discord_bot_token: Optional[str] = None,
        discord_channel_id: Optional[str] = None,
        name: Optional[str] = None,
        events: Optional[List[str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Validate webhook creation data"""
        validation_service = get_service('webhook_validation_service')
        formatting_service = get_service('webhook_formatting_service')
        valid_events = formatting_service.get_valid_events()
        return validation_service.validate_webhook_creation_data(
            webhook_type=webhook_type,
            url=url,
            telegram_bot_token=telegram_bot_token,
            telegram_chat_id=telegram_chat_id,
            discord_webhook_url=discord_webhook_url,
            discord_bot_token=discord_bot_token,
            discord_channel_id=discord_channel_id,
            name=name,
            events=events,
            valid_events=valid_events,
        )

    # ==================== Pending Tasks ====================
    # Delegated to WebhookPendingTaskService

    def process_pending_webhook_tasks(self, batch_size: int = 50) -> Dict[str, int]:
        """Process pending webhook tasks from database"""
        pending_task_service = get_service('webhook_pending_task_service')
        return pending_task_service.process_pending_webhook_tasks(batch_size)

    def cleanup_old_pending_tasks(self, days_old: int = 7) -> int:
        """Clean up old completed/failed webhook pending tasks"""
        pending_task_service = get_service('webhook_pending_task_service')
        return pending_task_service.cleanup_old_pending_tasks(days_old)

    # ==================== Backward Compatibility Methods ====================
    # These methods are kept for backward compatibility but delegate to specialized services

    def _get_valid_events(self) -> List[str]:
        """Get list of valid webhook events (internal method for backward compatibility)"""
        formatting_service = get_service('webhook_formatting_service')
        return formatting_service.get_valid_events()

    def _validate_url(self, url: str) -> bool:
        """Validate webhook URL (internal method for backward compatibility)"""
        validation_service = get_service('webhook_validation_service')
        return validation_service.validate_url(url)

    def _generate_secret(self) -> str:
        """Generate a random webhook secret (internal method for backward compatibility)"""
        crypto_service = get_service('webhook_crypto_service')
        return crypto_service.generate_secret()

    def _generate_signature(self, payload: str, secret: str) -> str:
        """Generate HMAC signature for webhook payload (internal method for backward compatibility)"""
        crypto_service = get_service('webhook_crypto_service')
        return crypto_service.generate_signature(payload, secret)

    def _format_telegram_message(self, event: str, data: Dict, custom_template: str = None) -> str:
        """Format message for Telegram (internal method for backward compatibility)"""
        formatting_service = get_service('webhook_formatting_service')
        return formatting_service.format_telegram_message(event, data, custom_template)

    def _format_discord_embed(self, event: str, data: Dict) -> Dict:
        """Format embed for Discord (internal method for backward compatibility)"""
        formatting_service = get_service('webhook_formatting_service')
        return formatting_service.format_discord_embed(event, data)

    def _send_telegram_message(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send message to Telegram (internal method for backward compatibility)"""
        execution_service = get_service('webhook_execution_service')
        return execution_service.send_telegram_message(webhook_data)

    def _send_discord_message(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send message to Discord (internal method for backward compatibility)"""
        execution_service = get_service('webhook_execution_service')
        return execution_service.send_discord_message(webhook_data)

    def _send_custom_webhook(self, webhook_data: Dict) -> Tuple[bool, Optional[str]]:
        """Send custom webhook (internal method for backward compatibility)"""
        execution_service = get_service('webhook_execution_service')
        return execution_service.send_custom_webhook(webhook_data)

    def _store_pending_webhook_task(
        self, webhook_id: int, project_id: int, event: str, webhook_data: Dict, error_reason: str
    ) -> None:
        """Store webhook task in database (internal method for backward compatibility)"""
        pending_task_service = get_service('webhook_pending_task_service')
        pending_task_service.store_pending_webhook_task(webhook_id, project_id, event, webhook_data, error_reason)

def get_webhook_service():
    """Get webhook service instance"""
    from ...utils.service_helpers import get_service
    return get_service('webhook_service')
