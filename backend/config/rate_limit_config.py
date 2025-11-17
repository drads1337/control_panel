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
             
    - games: Moderate limits for game management operations.
    
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

    # Development environment limits (more lenient for development)
    DEV_LIMITS: Dict[str, str] = {
        # Global default: Applied to all endpoints without specific limits
        # Reason: Provides baseline protection while allowing development flexibility
        "global": "100 per minute",
        
        # Authentication endpoints: Strict limits to prevent brute-force attacks
        # Reason: Login/registration endpoints are prime targets for attacks.
        #         10/min allows ~1 attempt every 6 seconds, sufficient for normal use
        #         but slows down automated attacks significantly.
        "auth": "10 per minute",
        
        # Connect endpoints: Higher limits for connection operations
        # Reason: Connection endpoints may require retries and testing during development.
        #         Legitimate users may need to establish multiple connections.
        "connect": "100 per minute",
        
        # Key operations: Moderate limits for CRUD operations
        # Reason: Key management operations should be infrequent but may require
        #         multiple API calls for a single user action (e.g., list + create).
        "keys": "20 per minute",
        
        # Project management: Higher limits for project operations
        # Reason: Project management may involve multiple API calls (list, create, update).
        #         Users typically work with projects less frequently than other resources.
        "projects": "90 per minute",
        
        # User management: Moderate limits
        # Reason: User management operations should be infrequent. Prevents abuse
        #         of user creation/modification endpoints.
        "users": "60 per minute",
        
        # Game management: Moderate limits
        # Reason: Game operations are typically infrequent but may require
        #         multiple API calls for configuration.
        "games": "45 per minute",
        
        # File operations: Moderate limits
        # Reason: File operations can be resource-intensive. Limits prevent
        #         abuse while allowing legitimate file management workflows.
        "files": "45 per minute",
        
        # Settings management: Lower limits
        # Reason: Settings changes should be infrequent and are not time-sensitive.
        #         Lower limits prevent accidental or malicious configuration changes.
        "settings": "30 per minute",
        
        # Log viewing: Higher limits
        # Reason: Log viewing often requires paginated requests to view complete history.
        #         Users may need to make multiple requests to navigate through logs.
        "logs": "90 per minute",
        
        # Dashboard stats: Highest limits
        # Reason: Dashboards typically poll for updates and may make multiple requests
        #         per page load. Higher limits ensure smooth user experience.
        "dashboard": "150 per minute",
        
        # CSRF token endpoints: Moderate limits
        # Reason: CSRF tokens are requested per-page in SPAs. Should be sufficient
        #         for normal usage patterns without being too restrictive.
        "csrf": "60 per minute",
    }

    # Production environment limits (stricter for security and performance)
    PROD_LIMITS: Dict[str, str] = {
        # Global default: Lower than dev to provide better protection
        # Reason: Production environments need stricter baseline protection
        #         to prevent abuse and ensure resource availability.
        "global": "60 per minute",
        
        # Authentication endpoints: Very strict limits (security critical)
        # Reason: Login/registration endpoints are prime targets for brute-force attacks.
        #         5/min allows ~1 attempt every 12 seconds, significantly slowing down
        #         automated attacks while still allowing legitimate retries.
        #         This is the most security-critical endpoint category.
        "auth": "5 per minute",
        
        # Connect endpoints: Moderate limits
        # Reason: Connection endpoints need to support legitimate connection patterns
        #         while preventing abuse. Lower than dev to reduce attack surface.
        "connect": "60 per minute",
        
        # Key operations: Stricter limits
        # Reason: Key operations are security-sensitive. Stricter limits prevent
        #         abuse and reduce the impact of potential key enumeration attacks.
        "keys": "10 per minute",
        
        # Project management: Moderate limits
        # Reason: Project operations are typically infrequent. Moderate limits
        #         prevent abuse while allowing normal project management workflows.
        "projects": "60 per minute",
        
        # User management: Stricter limits
        # Reason: User management operations are security-sensitive and should be
        #         infrequent. Stricter limits prevent abuse of user creation/modification.
        "users": "30 per minute",
        
        # Game management: Moderate limits
        # Reason: Game operations are typically infrequent. Moderate limits
        #         prevent abuse while allowing normal game management workflows.
        "games": "30 per minute",
        
        # File operations: Moderate limits
        # Reason: File operations are resource-intensive. Moderate limits prevent
        #         abuse while allowing legitimate file management workflows.
        "files": "30 per minute",
        
        # Settings management: Lower limits
        # Reason: Settings changes should be infrequent and are not time-sensitive.
        #         Lower limits prevent accidental or malicious configuration changes.
        "settings": "20 per minute",
        
        # Log viewing: Moderate limits
        # Reason: Log viewing often requires paginated requests. Moderate limits
        #         allow normal usage while preventing excessive log queries.
        "logs": "60 per minute",
        
        # Dashboard stats: Highest limits (even higher than dev)
        # Reason: Production dashboards may have more frequent polling requirements.
        #         Higher limits ensure smooth user experience for monitoring and
        #         analytics dashboards that update frequently.
        "dashboard": "200 per minute",
        
        # CSRF token endpoints: Moderate limits
        # Reason: CSRF tokens are requested per-page in SPAs. Moderate limits
        #         ensure normal usage patterns without being too restrictive.
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

