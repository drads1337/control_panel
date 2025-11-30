"""
Celery tasks for email sending
Handles email notifications asynchronously
"""

import logging

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

logger = logging.getLogger(__name__)

if CELERY_AVAILABLE:
    try:
        from ..core.celery_app import celery_app
    except ImportError:
        celery_app = None
        logger.warning("Celery app not available")
else:
    celery_app = None


def _send_password_reset_email_impl(
    to_email: str,
    reset_token: str,
    user_id: int
):
    """
    Send password reset email asynchronously
    
    Args:
        to_email: User email address
        reset_token: Password reset token
        user_id: User ID
    """
    try:
        frontend_url = Config.FRONTEND_URL
        reset_url = f"{frontend_url}/reset-password?token={reset_token}"
        
        subject = "Password Reset Request"
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Password Reset Request</h2>
                <p>Hello,</p>
                <p>You requested to reset your password. Click the button below to reset it:</p>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" 
                       style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </p>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #666;">{reset_url}</p>
                <p>This link will expire in 5 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">
                    This is an automated message, please do not reply.
                </p>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        Password Reset Request
        
        You requested to reset your password. Visit this link to reset it:
        {reset_url}
        
        This link will expire in 5 minutes.
        
        If you didn't request this, please ignore this email.
        """
        
        email_service = _get_service('email_service')
        success = email_service.send_email(
            to_email=to_email,
            subject=subject,
            html_body=html_body,
            text_body=text_body
        )
        
        if not success:
            raise Exception("Failed to send email")
            
        return {"status": "sent", "email": to_email}
        
    except Exception as e:
        logger.error(f"Error sending password reset email: {str(e)}")
        raise

# Register as Celery task if available, otherwise create a mock task object
if celery_app:
    @celery_app.task(bind=True, name="backend.tasks.email_tasks.send_password_reset_email")
    def send_password_reset_email(self, to_email: str, reset_token: str, user_id: int):
        return _send_password_reset_email_impl(to_email, reset_token, user_id)
else:
    # Fallback: create a mock task object that can be called with .delay() or directly
    class MockTask:
        def delay(self, *args, **kwargs):
            return _send_password_reset_email_impl(*args, **kwargs)
        
        def __call__(self, *args, **kwargs):
            return _send_password_reset_email_impl(*args, **kwargs)
    
    send_password_reset_email = MockTask()

