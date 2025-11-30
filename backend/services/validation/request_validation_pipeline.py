"""
Request Validation Pipeline
Unified validation pipeline for IP addresses and User-Agent strings (DRY principle)

This module consolidates all IP and User-Agent validation logic that was previously
scattered across SecurityChecker, AuthService, and middleware.
"""

import logging
from dataclasses import dataclass
from typing import Optional, Tuple

from flask import request

from ...utils.service_helpers import get_service
from ...utils.service_exceptions import ServiceError
from ...utils.ip_utils import get_real_ip

logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    """Result of request validation"""
    is_valid: bool
    reason: Optional[str] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None

class RequestValidationPipeline:
    """
    Unified validation pipeline for IP and User-Agent validation
    
    This class follows the DRY principle by centralizing all validation logic
    that was previously duplicated across SecurityChecker, AuthService, and middleware.
    """

    def __init__(self, security_service=None):
        """Initialize validation pipeline with configuration"""
        self._security_service = security_service
        # User-Agent validation patterns
        self.bad_ua_keywords = ["wget", "python", "requests", "postman", "insomnia"]
        self.bad_headers = []
        
        # IP validation settings
        self.require_ip_validation = True
        self.require_user_agent_validation = True

    def validate_request(
        self,
        ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        project_id: Optional[int] = None,
        headers: Optional[dict] = None,
    ) -> ValidationResult:
        """
        Validate request IP and User-Agent in a unified pipeline
        
        Args:
            ip: IP address to validate (if None, extracted from request)
            user_agent: User-Agent string to validate (if None, extracted from request)
            project_id: Optional project ID for IP blocking checks
            headers: Optional request headers dict
            
        Returns:
            ValidationResult with validation status and details
        """
        # Extract IP and User-Agent if not provided
        if ip is None:
            ip = get_real_ip()
        
        if user_agent is None:
            user_agent = request.headers.get("User-Agent", "") if request else ""
        
        if headers is None:
            headers = dict(request.headers) if request else {}

        # Validate User-Agent
        if self.require_user_agent_validation:
            ua_valid, ua_reason = self._validate_user_agent(user_agent, headers)
            if not ua_valid:
                logger.warning(
                    f"Request validation failed: User-Agent rejected. "
                    f"ip={ip} user_agent={user_agent} reason={ua_reason}"
                )
                return ValidationResult(
                    is_valid=False,
                    reason=ua_reason,
                    ip=ip,
                    user_agent=user_agent,
                )

        # Validate IP address
        if self.require_ip_validation and project_id:
            ip_valid, ip_reason = self._validate_ip_address(ip, project_id)
            if not ip_valid:
                logger.warning(
                    f"Request validation failed: IP address rejected. "
                    f"ip={ip} project_id={project_id} reason={ip_reason}"
                )
                return ValidationResult(
                    is_valid=False,
                    reason=ip_reason,
                    ip=ip,
                    user_agent=user_agent,
                )

        return ValidationResult(
            is_valid=True,
            ip=ip,
            user_agent=user_agent,
        )

    def _validate_user_agent(
        self, user_agent: str, headers: dict
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate User-Agent string for suspicious patterns
        
        Args:
            user_agent: User-Agent string to validate
            headers: Request headers dictionary
            
        Returns:
            Tuple of (is_valid, reason_if_invalid)
        """
        if not user_agent:
            return False, "MISSING_USER_AGENT"

        ua_lower = user_agent.lower()

        # Check for suspicious keywords
        for keyword in self.bad_ua_keywords:
            if keyword in ua_lower:
                return False, f"BAD_UA_{keyword.upper()}"

        # Check for suspicious headers
        for bad_header in self.bad_headers:
            if bad_header.lower() in (k.lower() for k in headers.keys()):
                return False, f"BAD_HEADER_{bad_header.upper()}"

        return True, None

    def _validate_ip_address(
        self, ip: str, project_id: int
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate IP address (check if blocked)
        
        Args:
            ip: IP address to validate
            project_id: Project ID for blocking checks
            
        Returns:
            Tuple of (is_valid, reason_if_invalid)
        """
        if not ip:
            return False, "MISSING_IP"

        # Check if IP is blocked
        try:
            if not self._security_service:
                raise ServiceError(
                    "Security Service dependency not injected",
                    status_code=500
                )
            security_service = self._security_service
            if not self._security_service:
                raise ServiceError(
                    "Security Service dependency not injected",
                    status_code=500
                )
            security_service = self._security_service
            if not self._security_service:
                raise ServiceError(
                    "Security Service dependency not injected",
                    status_code=500
                )
            security_service = self._security_service
            security_service = get_service('security_service')
            if security_service.is_ip_blocked(ip, project_id):
                return False, "IP_BLOCKED"
        except (ConnectionError, TimeoutError) as e:
            # Infrastructure errors - log but don't block requests
            logger.warning(f"IP block check unavailable (connection issue): {e}")
            # Don't fail validation on service errors - log and continue
            # This prevents service errors from blocking legitimate requests
        except Exception as e:
            # Other errors - log with context
            logger.error(f"Error checking IP block status: {e}", exc_info=True)
            # Don't fail validation on service errors - log and continue
            # This prevents service errors from blocking legitimate requests

        return True, None

    def validate_ip_only(
        self, ip: Optional[str] = None, project_id: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate only IP address (convenience method)
        
        Args:
            ip: IP address to validate
            project_id: Project ID for blocking checks
            
        Returns:
            Tuple of (is_valid, reason_if_invalid)
        """
        if ip is None:
            ip = get_real_ip()
        
        if not project_id:
            return True, None  # Skip validation if no project_id
        
        return self._validate_ip_address(ip, project_id)

    def validate_user_agent_only(
        self, user_agent: Optional[str] = None, headers: Optional[dict] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate only User-Agent (convenience method)
        
        Args:
            user_agent: User-Agent string to validate
            headers: Request headers dictionary
            
        Returns:
            Tuple of (is_valid, reason_if_invalid)
        """
        if user_agent is None:
            user_agent = request.headers.get("User-Agent", "") if request else ""
        
        if headers is None:
            headers = dict(request.headers) if request else {}
        
        return self._validate_user_agent(user_agent, headers)

# Singleton instance for easy access
request_validation_pipeline = RequestValidationPipeline()

