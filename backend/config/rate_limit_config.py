"""
Rate Limit Configuration
Centralized configuration for rate limits across different environments.
This makes the difference between dev and prod environments explicit and controllable.

Rate limits are designed to:
1. Prevent abuse and brute-force attacks
2. Protect server resources from excessive load
3. Ensure fair usage among all users
4. Maintain acceptable response times under load
"""

from typing import Dict


class RateLimitConfig:
    """
    Rate limit configuration for different environments.

    Limit Category Logic:
    - global:    Fallback limit for unspecified endpoints.
    - auth:      Strict limits to prevent brute-force (login/register).
    - connect:   Moderate limits for connectivity checks.
    - keys:      Moderate limits for key CRUD operations.
    - projects:  Higher limits for project management (complex operations).
    - users:     Moderate limits for user management.
    - products:  Moderate limits for product management.
    - files:     Moderate limits for resource-intensive uploads/downloads.
    - settings:  Lower limits for infrequent configuration changes.
    - logs:      Higher limits for viewing paginated log history.
    - dashboard: Highest limits for frequent polling/stats updates.
    - csrf:      Moderate limits for token generation.
    """

    DEV_LIMITS: Dict[str, str] = {
        "global": "100 per minute",
        "auth": "10 per minute",
        "connect": "100 per minute",
        "keys": "20 per minute",
        "projects": "90 per minute",
        "users": "60 per minute",
        "products": "45 per minute",
        "files": "45 per minute",
        "settings": "30 per minute",
        "logs": "90 per minute",
        "dashboard": "150 per minute",
        "csrf": "60 per minute",
    }

    PROD_LIMITS: Dict[str, str] = {
        "global": "60 per minute",
        "auth": "5 per minute",
        "connect": "60 per minute",
        "keys": "10 per minute",
        "projects": "60 per minute",
        "users": "30 per minute",
        "products": "30 per minute",
        "files": "30 per minute",
        "settings": "20 per minute",
        "logs": "60 per minute",
        "dashboard": "200 per minute",
        "csrf": "60 per minute",
    }

    @classmethod
    def get_limits(cls, environment: str) -> Dict[str, str]:
        """
        Get rate limits for the specified environment.

        Args:
            environment: Environment name ('development' or 'production')
        Returns:
            Dictionary of rate limit strings
        """
        if environment == "development":
            return cls.DEV_LIMITS.copy()
        return cls.PROD_LIMITS.copy()

    @classmethod
    def get_limit(cls, category: str, environment: str) -> str:
        """
        Get rate limit for a specific category and environment.

        Args:
            category: Rate limit category (e.g., 'auth', 'keys')
            environment: Environment name
        Returns:
            Rate limit string (e.g., "10 per minute") or global fallback
        """
        limits = cls.get_limits(environment)
        return limits.get(category, limits["global"])

    @classmethod
    def get_comparison(cls) -> Dict[str, Dict[str, str]]:
        """
        Get a comparison of dev vs prod limits for documentation/debugging.

        Returns:
            Dictionary: {category: {'dev': limit, 'prod': limit}}
        """
        dev_limits = cls.DEV_LIMITS
        prod_limits = cls.PROD_LIMITS

        comparison = {}
        all_categories = set(dev_limits.keys()) | set(prod_limits.keys())

        for category in all_categories:
            comparison[category] = {
                "dev": dev_limits.get(category, "N/A"),
                "prod": prod_limits.get(category, "N/A"),
            }

        return comparison