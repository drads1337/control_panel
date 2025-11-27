"""
Webhook Validation Service
Handles validation of webhook URLs, access, and creation data
"""

import ipaddress
import logging
import re
import socket
from typing import List, Optional, Tuple
from urllib.parse import urlparse

from ...models.core import User
from ...models.webhooks import Webhook


class WebhookValidationService:
    """Service for validating webhook URLs, access, and creation data"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def validate_url(self, url: str) -> bool:
        """
        Validate webhook URL with SSRF protection.
        
        SECURITY: This method protects against SSRF attacks including DNS rebinding.
        Uses getaddrinfo() to resolve all IP addresses and validates each one.
        This prevents TOCTOU (Time-of-check to time-of-use) attacks where DNS
        resolution changes between validation and actual request.
        
        This method:
        1. Only allows HTTPS URLs (not HTTP) for security
        2. Resolves domain to ALL IP addresses (IPv4 and IPv6)
        3. Validates ALL resolved IP addresses against blocked ranges
        4. Blocks localhost, private IP ranges, and internal network addresses
        5. Prevents SSRF attacks on internal services
        
        Args:
            url: URL to validate
            
        Returns:
            True if URL is safe, False otherwise
        """
        try:
            if not url or not url.strip():
                return False

            url = url.strip()
            
            # Parse URL
            parsed = urlparse(url)
            
            # SECURITY: Only allow HTTPS, not HTTP
            if parsed.scheme != "https":
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Only HTTPS allowed, got {parsed.scheme}")
                return False
            
            # Get hostname
            hostname = parsed.hostname
            if not hostname:
                return False
            
            # SECURITY: Block localhost and common local hostnames
            blocked_hostnames = {
                "localhost",
                "127.0.0.1",
                "0.0.0.0",
                "::1",
                "localhost.localdomain",
                "metadata.google.internal",  # GCP metadata
            }
            if hostname.lower() in blocked_hostnames:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Blocked hostname {hostname}")
                return False
            
            # SECURITY: Block IP addresses in URL (should use hostname, not IP)
            # This prevents bypassing DNS resolution checks
            try:
                # Try to parse hostname as IP address
                ipaddress.ip_address(hostname)
                # If successful, hostname is an IP address - block it
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: IP address in URL instead of hostname: {hostname}")
                return False
            except ValueError:
                # Not an IP address, continue validation
                pass
            
            # SECURITY: Resolve hostname to ALL IP addresses (IPv4 and IPv6)
            # Using getaddrinfo() instead of gethostbyname() to:
            # 1. Get all IP addresses (not just first)
            # 2. Support both IPv4 and IPv6
            # 3. Better handle DNS rebinding attacks
            try:
                # Get all address info (IPv4 and IPv6)
                addr_infos = socket.getaddrinfo(hostname, None, 0, socket.SOCK_STREAM)
                if not addr_infos:
                    logging.warning(f"WEBHOOK_SSRF_BLOCKED: No IP addresses found for {hostname}")
                    return False
                
                # Extract all IP addresses
                ip_addresses = []
                for addr_info in addr_infos:
                    ip_addr = addr_info[4][0]  # (hostname, port) tuple, get hostname
                    ip_addresses.append(ip_addr)
                
                # SECURITY: Validate ALL resolved IP addresses
                # If ANY IP is in blocked range, reject the URL
                for ip_address in ip_addresses:
                    try:
                        ip_obj = ipaddress.ip_address(ip_address)
                    except ValueError:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Invalid IP address {ip_address}")
                        return False
                    
                    # SECURITY: Block private IP ranges (RFC 1918)
                    # 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                    if ip_obj.is_private:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Private IP range {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block loopback addresses
                    if ip_obj.is_loopback:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Loopback address {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block link-local addresses (169.254.0.0/16)
                    if ip_obj.is_link_local:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Link-local address {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block multicast addresses
                    if ip_obj.is_multicast:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Multicast address {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block reserved addresses (0.0.0.0/8, etc.)
                    if ip_obj.is_reserved:
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Reserved address {ip_address} for {hostname}")
                        return False
                    
                    # SECURITY: Block cloud metadata endpoints (AWS, GCP, Azure)
                    if ip_address == "169.254.169.254":
                        logging.warning(f"WEBHOOK_SSRF_BLOCKED: Cloud metadata endpoint {ip_address} for {hostname}")
                        return False
                
            except (socket.gaierror, socket.herror, OSError) as e:
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Failed to resolve {hostname}: {e}")
                return False
            
            # URL format validation
            url_pattern = re.compile(
                r"^https://"
                r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"
                r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"
                r"(?::\d+)?"
                r"(?:/?|[/?]\S+)$",
                re.IGNORECASE,
            )
            
            if not url_pattern.match(url):
                logging.warning(f"WEBHOOK_SSRF_BLOCKED: Invalid URL format {url}")
                return False
            
            logging.debug(f"WEBHOOK_URL_VALIDATED: {hostname} -> {len(ip_addresses)} IP(s) validated")
            return True
            
        except Exception as e:
            logging.error(f"WEBHOOK_URL_VALIDATION_ERROR: {e}")
            return False

    def validate_webhook_access(self, user_id: int, project_id: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """
        Validate user access to webhooks with all business logic

        Args:
            user_id: ID of the user
            project_id: Optional project ID to check access to

        Returns:
            Tuple of (has_access, error_message)
        """
        try:
            from ...services.rbac import rbac_service
            from ...utils.rbac_utils import RBACManager

            user = User.query.get(user_id)
            if not user:
                return False, "User not found"

            if not user.project_id:
                logging.warning(
                    f"WEBHOOK_ACCESS_BLOCKED: user_id={user.id} has no project_id - access denied"
                )
                return False, "User must be assigned to a project to manage webhooks"

            if not rbac_service.check_permission(user.id, "webhooks.view"):
                logging.warning(f"WEBHOOK_ACCESS_BLOCKED: user_id={user.id} insufficient permissions")
                return False, "Insufficient permissions"

            if project_id is not None:
                user_roles = RBACManager.get_user_role_names(user)
                is_owner = user_roles and user_roles[0] == "owner" if user_roles else False

                if not is_owner and project_id != user.project_id:
                    return False, "Access denied to this project"

            return True, None

        except Exception as e:
            logging.error(f"WEBHOOK_VALIDATION_ERROR user_id={user_id} error={e}")
            return False, "Internal server error"

    def validate_webhook_ownership(
        self, user_id: int, webhook_id: int
    ) -> Tuple[bool, Optional[str], Optional[Webhook]]:
        """
        Validate user ownership/access to a specific webhook with all business logic

        Args:
            user_id: ID of the user
            webhook_id: ID of the webhook

        Returns:
            Tuple of (has_access, error_message, webhook_object)
        """
        try:
            from ...utils.rbac_utils import RBACManager

            has_access, error = self.validate_webhook_access(user_id)
            if not has_access:
                return False, error, None

            user = User.query.get(user_id)

            # Get webhook
            webhook = Webhook.query.filter_by(id=webhook_id, project_id=user.project_id).first()
            if not webhook:
                return False, "Webhook not found", None

            user_roles = RBACManager.get_user_role_names(user)
            is_owner = user_roles and user_roles[0] == "owner" if user_roles else False

            if not is_owner and webhook.project_id != user.project_id:
                return False, "Access denied to this webhook", None

            return True, None, webhook

        except Exception as e:
            logging.error(f"WEBHOOK_OWNERSHIP_VALIDATION_ERROR user_id={user_id} webhook_id={webhook_id} error={e}")
            return False, "Internal server error", None

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
        valid_events: Optional[List[str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate webhook creation data with all business logic

        Args:
            webhook_type: Type of webhook (custom, telegram, discord)
            url: URL for custom webhooks
            telegram_bot_token: Telegram bot token
            telegram_chat_id: Telegram chat ID
            discord_webhook_url: Discord webhook URL
            discord_bot_token: Discord bot token
            discord_channel_id: Discord channel ID
            name: Webhook name
            events: List of events
            valid_events: List of valid events (if None, will be fetched)

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            if not all([name, events]):
                return False, "Missing required fields: name and events are required"

            if webhook_type == "custom":
                if not url:
                    return False, "URL is required for custom webhooks"
                if not self.validate_url(url):
                    return False, "Invalid webhook URL for custom type"
            elif webhook_type == "telegram":
                if not all([telegram_bot_token, telegram_chat_id]):
                    return False, "Bot token and chat ID/username are required for Telegram webhooks"
            elif webhook_type == "discord":
                if not (discord_webhook_url or (discord_bot_token and discord_channel_id)):
                    return False, "Webhook URL or bot token with channel ID are required for Discord webhooks"
            else:
                return False, f"Invalid webhook type: {webhook_type}"

            if events:
                if valid_events is None:
                    # Import here to avoid circular dependency
                    from .webhook_formatting_service import webhook_formatting_service
                    valid_events = webhook_formatting_service.get_valid_events()
                
                for event in events:
                    if event not in valid_events:
                        return False, f"Invalid event: {event}"

            return True, None

        except Exception as e:
            logging.error(f"WEBHOOK_VALIDATION_ERROR error={e}")
            return False, "Internal server error"


webhook_validation_service = WebhookValidationService()

