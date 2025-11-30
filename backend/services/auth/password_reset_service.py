"""
Password Reset Service
Handles password reset token generation, validation, and password reset
"""
import logging
import secrets
import json
from datetime import datetime
from typing import Optional, Tuple

from ...core.extensions import db, redis_ext
from ...models.core import User
from ...config.config import Config
from ...utils.validators import AuthValidator
from ...utils.service_helpers import get_service

logger = logging.getLogger(__name__)

class PasswordResetService:
    """Service for handling password reset operations"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.token_ttl = 300  # 5 minutes
        
    def generate_reset_token(self, user: User) -> str:
        """
        Generate a secure password reset token
        
        Args:
            user: User object
            
        Returns:
            Reset token string
        """
        # Generate secure token
        token = secrets.token_urlsafe(32)
        
        # Store token in Redis with TTL
        redis_client = redis_ext.client
        
        token_key = f"password_reset:{token}"
        token_data = {
            "user_id": user.id,
            "email": user.email,
            "created_at": datetime.utcnow().isoformat()
        }
        
        redis_client.setex(
            token_key,
            self.token_ttl,
            json.dumps(token_data)
        )
        
        self.logger.info(f"Generated password reset token for user {user.id}")
        return token
    
    def validate_reset_token(self, token: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Validate password reset token
        
        Args:
            token: Reset token
            
        Returns:
            Tuple of (User object or None, error message or None)
        """
        if not token:
            return None, "Token is required"
        
        try:
            redis_client = redis_ext.client
            
            token_key = f"password_reset:{token}"
            token_data_str = redis_client.get(token_key)
            
            if not token_data_str:
                return None, "Invalid or expired token"
            
            token_data = json.loads(token_data_str)
            user_id = token_data.get("user_id")
            
            user = User.query.get(user_id)
            if not user:
                return None, "User not found"
            
            # Verify email matches
            if user.email != token_data.get("email"):
                return None, "Token email mismatch"
            
            return user, None
            
        except Exception as e:
            self.logger.error(f"Error validating reset token: {str(e)}")
            return None, "Error validating token"
    
    def reset_password(self, token: str, new_password: str) -> Tuple[bool, Optional[str]]:
        """
        Reset user password using token
        
        Args:
            token: Reset token
            new_password: New password
            
        Returns:
            Tuple of (success, error message)
        """
        user, error = self.validate_reset_token(token)
        if not user:
            return False, error or "Invalid token"
        
        try:
            # Validate password
            is_valid, password_error = AuthValidator.validate_password(new_password, min_length=8)
            if not is_valid:
                return False, password_error
            
            # Hash and update password
            from werkzeug.security import generate_password_hash
            user.password = generate_password_hash(new_password)
            db.session.commit()
            
            # Delete token after successful reset
            redis_client = redis_ext.client
            token_key = f"password_reset:{token}"
            redis_client.delete(token_key)
            
            self.logger.info(f"Password reset successful for user {user.id}")
            return True, None
            
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error resetting password: {str(e)}")
            return False, "Failed to reset password"
    
    def request_password_reset(self, email: str) -> Tuple[bool, Optional[str]]:
        """
        Request password reset - generates token and sends email
        
        Args:
            email: User email address
            
        Returns:
            Tuple of (success, error message)
            Always returns success to prevent email enumeration
        """
        try:
            # Find user by email
            user = User.query.filter_by(email=email.lower()).first()
            
            # Always return success to prevent email enumeration
            if not user:
                self.logger.warning(f"Password reset requested for non-existent email: {email}")
                return True, None
            
            if not user.email:
                return True, None
            
            # Generate token
            token = self.generate_reset_token(user)
            
            # Send email asynchronously via Celery
            try:
                from ...tasks.email_tasks import send_password_reset_email
                send_password_reset_email.delay(
                    to_email=user.email,
                    reset_token=token,
                    user_id=user.id
                )
            except Exception as e:
                self.logger.error(f"Failed to queue email task: {str(e)}")
                # Fallback to synchronous sending
                
                frontend_url = Config.FRONTEND_URL
                reset_url = f"{frontend_url}/reset-password?token={token}"
                
                email_service = get_service('email_service')
                email_service.send_email(
                    to_email=user.email,
                    subject="Password Reset Request",
                    html_body=f"""
                    <html>
                    <body>
                        <h2>Password Reset Request</h2>
                        <p>Click <a href="{reset_url}">here</a> to reset your password.</p>
                        <p>Or copy this link: {reset_url}</p>
                        <p>This link expires in 5 minutes.</p>
                    </body>
                    </html>
                    """
                )
            
            return True, None
            
        except Exception as e:
            self.logger.error(f"Error requesting password reset: {str(e)}")
            return True, None  # Always return success for security

