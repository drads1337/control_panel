"""
Rate Limit Configuration
Centralized configuration for rate limits across different environments.
This makes the difference between dev and prod environments explicit and controllable.

Rate limits are designed to:
1. Prevent abuse and brute-force attacks
2. Protect server resources from excessive load
3. Ensure fair usage among all users
4. Maintain acceptable response times under load

The limits are designed to be closer between dev and prod to avoid
hiding performance issues that would only appear in production.

Dev limits are typically 1.5-2x higher than prod to allow for
development convenience while still catching most performance issues.
"""

from typing import Dict

class RateLimitConfig:
    """
    Rate limit configuration for different environments.

    Each limit category has specific reasoning:

    - auth: Strict limits to prevent brute-force attacks on login/registration.
            Lower in production to reduce attack surface.

    - connect: Moderate limits for connection endpoints. Higher limits allow
               for legitimate connection testing and retries.

    - keys: Moderate limits for key operations (CRUD). Prevents abuse while
            allowing normal usage patterns.

    - projects: Higher limits for project management operations, as these
                are typically less frequent but may require multiple API calls
                for a single user action.

    - users: Moderate limits for user management. Prevents abuse of user
             creation/modification endpoints.

    - products: Moderate limits for product management operations.

    - files: Moderate limits for file operations. Prevents abuse of file
             upload/download endpoints which can be resource-intensive.

    - settings: Lower limits for settings management, as these operations
                should be infrequent and are not time-sensitive.

    - logs: Higher limits for log viewing, as logs may require multiple
            paginated requests to view complete history.

    - dashboard: Highest limits for dashboard stats, as dashboards typically
                 poll for updates and may make multiple requests per page load.

    - csrf: Moderate limits for CSRF token endpoints. Should be sufficient
            for normal SPA usage patterns.
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
            Dictionary of rate limit strings for each endpoint category
        """
        if environment == "development":
            return cls.DEV_LIMITS.copy()
        else:
            return cls.PROD_LIMITS.copy()

    @classmethod
    def get_limit(cls, category: str, environment: str) -> str:
        """
        Get rate limit for a specific category and environment.

        Args:
            category: Rate limit category (e.g., 'auth', 'keys', 'projects')
            environment: Environment name ('development' or 'production')

        Returns:
            Rate limit string (e.g., "10 per minute")
        """
        limits = cls.get_limits(environment)
        return limits.get(category, limits["global"])

    @classmethod
    def get_comparison(cls) -> Dict[str, Dict[str, str]]:
        """
        Get a comparison of dev vs prod limits for documentation/debugging.

        Returns:
            Dictionary with category as key and dict with 'dev' and 'prod' limits
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
