"""
Swagger/OpenAPI Documentation Configuration
Provides interactive API documentation using Swagger UI
"""

from flasgger import Swagger

def create_swagger_config() -> dict:
    """
    Create Swagger configuration dictionary
    
    Returns:
        Swagger configuration dict
    """
    return {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/api/spec.json",
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/api/docs",
        "title": "Panel API Documentation",
        "version": "1.0.0",
        "description": """
        Enterprise-level License Key Management System API
        
        ## Authentication
        Most endpoints require JWT authentication. Include the access token in:
        - Cookie: `access_token_cookie` (preferred for web clients)
        - Header: `Authorization: Bearer <token>` (for API clients)
        
        ## Security
        - mTLS required for agent endpoints (`/api/connect`, `/api/dynamic-config`)
        - Rate limiting applied to all endpoints
        - Project isolation enforced at ORM level
        - Fail-close behavior for critical endpoints (blocks requests if Redis is unavailable)
        
        ## Terminology
        - **Products**: Software products (formerly "Clients")
        - **Agents**: Loader applications (formerly "Loaders")
        - **Users**: End users who receive license keys
        
        ## Rate Limits
        - Default: 100 requests per minute per IP
        - Authentication endpoints: 10 requests per minute
        - Connect endpoints: 30 requests per minute per IP
        
        ## Health Checks
        - `/api/health/live` - Liveness probe (Kubernetes)
        - `/api/health/ready` - Readiness probe (Kubernetes)
        - `/api/health` - Comprehensive health check
        
        ## Response Format
        All API responses follow a standardized format:
        - Success: `{"status": "success", "data": {...}, "message": "..."}`
        - Error: `{"status": "error", "error": "ERROR_CODE", "message": "...", "details": {...}}`
        - Paginated: `{"status": "success", "data": {"items": [...], "pagination": {...}}}`
        
        See `DEVELOPER_GUIDE.md` for more details on using the API Response Helper.
        """,
        "termsOfService": "",
        "contact": {
            "name": "API Support",
            "email": "support@example.com"
        },
        "license": {
            "name": "Proprietary"
        },
        "schemes": ["http", "https"],
        "tags": [
            {
                "name": "Authentication",
                "description": "User authentication and authorization endpoints"
            },
            {
                "name": "Users",
                "description": "User management endpoints"
            },
            {
                "name": "Products",
                "description": "Product management endpoints (formerly Clients)"
            },
            {
                "name": "Agents",
                "description": "Agent management endpoints (formerly Loaders)"
            },
            {
                "name": "Keys",
                "description": "License key management endpoints"
            },
            {
                "name": "Projects",
                "description": "Project management endpoints"
            },
            {
                "name": "Admin",
                "description": "Administrative endpoints"
            },
            {
                "name": "Health",
                "description": "Health check endpoints for monitoring and Kubernetes probes"
            },
            {
                "name": "System",
                "description": "System-level endpoints (monitoring, metrics, etc.)"
            }
        ],
        "securityDefinitions": {
            "JWT": {
                "type": "apiKey",
                "name": "Authorization",
                "in": "header",
                "description": "JWT token authentication. Format: 'Bearer <token>'"
            },
            "CookieAuth": {
                "type": "apiKey",
                "name": "access_token_cookie",
                "in": "cookie",
                "description": "Cookie-based JWT authentication (preferred for web clients)"
            }
        }
    }

def init_swagger(app) -> Swagger:
    """
    Initialize Swagger documentation for the Flask app
    
    Args:
        app: Flask application instance
        
    Returns:
        Swagger instance
    """
    config = create_swagger_config()
    swagger = Swagger(app, config=config)
    return swagger

