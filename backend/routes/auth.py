"""
Refactored Authentication Routes
Clean, secure, and maintainable authentication endpoints using service layer
"""

import logging
from datetime import datetime

from flask import Blueprint, current_app, jsonify, make_response, request
from flask_jwt_extended import (
    create_access_token,
    get_jwt,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
    verify_jwt_in_request,
)
from flask_wtf import CSRFProtect
from flask_wtf.csrf import generate_csrf

from ..core.extensions import db
from ..middleware.auth import require_project_isolation
from ..middleware.validation import validate_request
from ..models.core import Project, ProjectInviteCode, User
from ..schemas.auth import (
    AccessCodeRegisterSchema,
    AccessCodeValidateSchema,
    ChangePasswordRequestSchema,
    ClassicLoginRegisterSchema,
    InviteCodeValidateSchema,
    LoginRequestSchema,
    RegisterRequestSchema,
    TwoFactorDisableRequestSchema,
    TwoFactorSetupRequestSchema,
    TwoFactorVerifyRequestSchema,
)
from ..utils.service_helpers import get_service
from ..schemas.user import UserProfileUpdateSchema
from ..services.users.invite_service import invite_service
from ..utils.rbac_utils import RBACManager
from ..utils.role_constants import UserRoles
from ..utils.validators import AuthValidator, InviteValidator, UserValidator
from ..utils.service_exceptions import SecurityError, ValidationError, ConflictError, ServiceError

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

csrf = CSRFProtect()

logger = logging.getLogger(__name__)

def log_suspicious(ip: str, event_type: str, details: str = ""):
    """Log suspicious activity without exposing sensitive information"""
    from ..utils.data_masking import mask_username, mask_string

    safe_details = mask_string(details) if details else ""
    logger.warning(f"Suspicious activity from {ip}: {event_type} - {safe_details}")

@auth_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "auth"})


@auth_bp.route("/login", methods=["POST"])
@csrf.exempt
@validate_request(LoginRequestSchema)
def login(validated_data=None):
    """
    Secure login endpoint with proper error handling
    All authentication data is transmitted over HTTPS which provides channel encryption
    
    ---
    tags:
      - Authentication
    summary: User login
    description: |
      Authenticate user with username/email and password.
      Returns JWT access token in cookie and response body.
      
      **Security:**
      - Rate limited: 10 requests per minute per IP
      - CSRF protection disabled for API compatibility
      - All data transmitted over HTTPS
      
      **Response:**
      - Sets HTTP-only cookie: `access_token_cookie`
      - Returns access_token in response body (for API clients)
      - Returns user information and roles
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - username
              - password
            properties:
              username:
                type: string
                description: Username or email address
                example: "admin@example.com"
                minLength: 3
                maxLength: 50
              password:
                type: string
                format: password
                description: User password
                example: "SecurePassword123!"
                minLength: 8
                maxLength: 128
    responses:
      200:
        description: Login successful
        content:
          application/json:
            schema:
              type: object
              properties:
                user_id:
                  type: string
                  description: User ID
                  example: "123"
                username:
                  type: string
                  description: Username
                  example: "admin"
                roles:
                  type: array
                  items:
                    type: string
                  description: User roles
                  example: ["admin", "user"]
                session_id:
                  type: string
                  description: Session identifier
                  example: "550e8400-e29b-41d4-a716-446655440000"
                login_success:
                  type: boolean
                  example: true
                access_token:
                  type: string
                  description: JWT access token (also set in cookie)
                  example: "eyJ0eXAiOiJKV1QiLCJhbGc..."
        headers:
          Set-Cookie:
            description: JWT access token in HTTP-only cookie
            schema:
              type: string
              example: "access_token_cookie=eyJ0eXAiOiJKV1QiLCJhbGc...; HttpOnly; Secure; SameSite=Strict"
      400:
        description: Invalid request format
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "INVALID_REQUEST"
                message:
                  type: string
                  example: "Invalid login format"
      401:
        description: Authentication failed
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "AUTHENTICATION_ERROR"
                message:
                  type: string
                  example: "Invalid credentials"
      403:
        description: Security constraint violation
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "SECURITY_ERROR"
                message:
                  type: string
                  example: "Access denied due to security constraints"
      429:
        description: Rate limit exceeded
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "Too many requests"
                message:
                  type: string
                  example: "Rate limit exceeded. Please try again later."
      500:
        description: Internal server error
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: "INTERNAL_ERROR"
                message:
                  type: string
                  example: "Authentication failed"
    security: []
    """

    ip = request.remote_addr
    user_agent = request.headers.get("User-Agent", "")

    try:

        if not validated_data:
            log_suspicious(ip, "INVALID_LOGIN_FORMAT", "Missing required fields")
            return jsonify({"error": "INVALID_REQUEST", "message": "Invalid login format"}), 400

        return _handle_simple_login(validated_data, ip, user_agent)

    except Exception as e:
        import traceback

        logger.error(f"Unexpected error in login endpoint: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        log_suspicious(ip, "LOGIN_ERROR", "Unexpected error")
        return jsonify({"error": "INTERNAL_ERROR", "message": "Authentication failed"}), 500

def _handle_simple_login(data: dict, ip: str, user_agent: str):
    """Handle simple username/password login"""
    try:
        username = data["username"]
        password = data["password"]

        auth_service = get_service('auth_service')
        # Exceptions are handled by global handler
        response_data = auth_service.process_simple_login(username, password, ip, user_agent)

        # Log suspicious activity for authentication errors (handled by exception handler)
        from ..utils.data_masking import mask_username
        masked_username = mask_username(username) if username else "unknown"
        
        access_token = response_data.pop("access_token", None)

        response = make_response(jsonify(response_data))

        if access_token:
            set_access_cookies(response, access_token)

        return response

    except SecurityError as e:
        # Handle project inactive error with user-friendly message
        if hasattr(e, 'error_code') and e.error_code == "PROJECT_INACTIVE":
            logger.warning(f"User attempted to login to inactive project: {ip}")
            return jsonify({
                "error": "PROJECT_INACTIVE",
                "error_code": "PROJECT_INACTIVE",
                "message": "Project is paused. Please contact the administrator for additional information."
            }), 403
        # Re-raise other SecurityErrors to be handled by global handler
        raise
    except Exception as e:
        import traceback

        logger.error(f"Error in simple login: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        log_suspicious(ip, "SIMPLE_LOGIN_ERROR", str(e))
        return jsonify({"error": "LOGIN_FAILED", "message": "Authentication failed"}), 500

@auth_bp.route("/csrf-token", methods=["GET"])
def get_csrf_token():
    """
    Get CSRF token for authenticated requests

    This endpoint provides CSRF tokens for SPA clients using cookie-based JWT authentication.
    The token must be included in the X-CSRFToken header for all authenticated requests
    when JWT_COOKIE_CSRF_PROTECT=True.

    SECURITY NOTE:
    - CSRF protection is enabled to prevent CSRF attacks when using cookie-based JWT
    - This is critical for security, especially if forms (application/x-www-form-urlencoded) are added
    - Flask-JWT-Extended generates CSRF tokens as UUID and stores them in the JWT token
    - This endpoint extracts the CSRF token from the JWT token in the cookie
    - This endpoint uses verify_jwt_in_request(optional=True) to avoid CSRF token requirement
      (since we're getting the CSRF token itself)
    - Returns null csrf_token when not authenticated (200 status) to allow graceful handling
    """

    try:

        verify_jwt_in_request(optional=True)

        jwt_cookie_name = current_app.config.get("JWT_ACCESS_COOKIE_NAME", "access_token_cookie")
        encoded_token = request.cookies.get(jwt_cookie_name)

        if not encoded_token:
            return jsonify({"csrf_token": None}), 200

        jwt_data = get_jwt()
        csrf_token = jwt_data.get("csrf")

        if not csrf_token:
            logger.error("CSRF token not found in JWT token")
            return (
                jsonify({"error": "CSRF_TOKEN_FAILED", "message": "CSRF token not found in JWT"}),
                500,
            )

        return jsonify({"csrf_token": csrf_token})
    except Exception as e:
        logger.error(f"Error extracting CSRF token: {str(e)}")
        return (
            jsonify({"error": "CSRF_TOKEN_FAILED", "message": "Failed to extract CSRF token"}),
            500,
        )

@auth_bp.route("/register", methods=["POST"])
@validate_request(RegisterRequestSchema)
def register(validated_data=None):
    """User registration endpoint"""
    try:

        if not validated_data:
            return jsonify({"error": "REGISTRATION_FAILED", "message": "Invalid request data"}), 400

        user_crud_service = get_service('user_crud_service')
        # Exceptions are handled by global handler
        user = user_crud_service.create_user(
            validated_data["username"], validated_data["email"], validated_data["password"]
        )

        try:
            from ..services.webhooks import get_webhook_service

            webhook_service = get_webhook_service()

            from ..utils.rbac_utils import RBACManager
            user_roles = RBACManager.get_user_role_names(user)
            primary_role = user_roles[0] if user_roles else UserRoles.CLIENT.value

            webhook_data = {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
                "role": primary_role,
                "project_id": user.project_id,
                "registered_at": (
                    user.created_at.isoformat()
                    if user.created_at
                    else datetime.utcnow().isoformat()
                ),
                "registration_type": "standard",
            }

            webhook_service.trigger_webhook("user.registered", webhook_data, user.project_id)
            logging.info(f"Triggered webhook for user registration: {user.id}")

        except Exception as e:
            logging.error(f"Failed to trigger webhook for user registration: {str(e)}")

        return (
            jsonify(
                {
                    "message": "User registered successfully",
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email,
                }
            ),
            201,
        )

    except Exception as e:
        logger.error(f"Error in registration: {str(e)}")
        return jsonify({"error": "REGISTRATION_FAILED", "message": "Registration failed"}), 500

@validate_request(RegisterRequestSchema)
@auth_bp.route("/register-with-invite", methods=["POST"])
def register_with_invite(validated_data=None):
    """User registration with invite code"""
    try:

        if not all([username, password, invite_code]):
            return jsonify({"error": "MISSING_FIELDS", "message": "All fields are required"}), 400

        username_valid, username_error = AuthValidator.validate_username(username)
        if not username_valid:
            return jsonify({"error": "INVALID_USERNAME", "message": username_error}), 400

        password_valid, password_error = AuthValidator.validate_password(password, min_length=8)
        if not password_valid:
            return jsonify({"error": "INVALID_PASSWORD", "message": password_error}), 400

        code_info, error = invite_service.validate_invite_code(invite_code)
        if not code_info:
            return jsonify({"error": "INVALID_INVITE_CODE", "message": error}), 400

        project_id = code_info["project_id"]
        if not project_id:

            if not project_name:
                return (
                    jsonify(
                        {
                            "error": "PROJECT_NAME_REQUIRED",
                            "message": "Project name is required for project creation",
                        }
                    ),
                    400,
                )

            new_project = Project(name=project_name, created_at=datetime.utcnow(), status="active")
            db.session.add(new_project)
            db.session.flush()
            project_id = new_project.id

            from ..services.rbac import RBACService

            rbac_service = RBACService()
            rbac_service.initialize_default_data(project_id)

            invite = ProjectInviteCode.query.filter_by(code=invite_code).first()
            if invite:
                invite.project_id = project_id
                db.session.commit()

        # Check if this is a referral code with RBAC roles
        code_type = code_info.get("code_type", "project_invite")
        rbac_role_ids = code_info.get("rbac_role_ids", []) if code_type == "referral" else []
        product_ids = code_info.get("product_ids", []) if code_type == "referral" else []
        token_balance = code_info.get("token_balance", 0) if code_type == "referral" else 0
        work_duration_days = code_info.get("work_duration_days") if code_type == "referral" else None
        
        # Log for debugging
        if code_type == "referral":
            logger.info(
                f"Referral code registration: code={invite_code}, "
                f"product_ids={product_ids}, rbac_role_ids={rbac_role_ids}, "
                f"token_balance={token_balance}, work_duration_days={work_duration_days}"
            )

        user_crud_service = get_service('user_crud_service')
        # Exceptions are handled by global handler
        try:
            # Handle referral codes - always assign products and roles if specified
            if code_type == "referral":
                from werkzeug.security import generate_password_hash
                from ..models.core import User
                from ..utils.service_helpers import get_user_role_service, get_user_permission_service
                from ..models.keys import ReferralCode
                from datetime import timedelta
                
                # Validate username doesn't exist
                if User.query.filter_by(username=username).first():
                    raise ConflictError("Username already exists", resource_type="user")
                
                # Create user without legacy role field (roles are managed via RBAC)
                user = User(
                    username=username,
                    email=None,
                    password=generate_password_hash(password),
                    project_id=project_id,
                    created_at=datetime.utcnow(),
                )
                db.session.add(user)
                db.session.flush()
                
                # Assign RBAC roles if provided
                if rbac_role_ids and project_id:
                    user_role_service = get_user_role_service()
                    user_role_service.assign_roles_to_user(user.id, project_id, rbac_role_ids)
                
                # Assign product permissions - always try to assign if product_ids provided
                if project_id:
                    user_permission_service = get_user_permission_service()
                    # Process product_ids to filter out invalid values like 0
                    processed_product_ids = user_permission_service.process_product_ids_from_data(product_ids)
                    if processed_product_ids:
                        user_permission_service.assign_product_permissions(user.id, project_id, processed_product_ids)
                
                # Set work duration if specified
                if work_duration_days:
                    user.expires_at = datetime.utcnow() + timedelta(days=work_duration_days)
                
                # Add token balance if provided
                if token_balance > 0:
                    user.token_balance = token_balance
                
                db.session.commit()
                
                # Mark referral code as used
                referral = ReferralCode.query.filter_by(code=invite_code).first()
                if referral:
                    referral.used = True
                    referral.used_by = user.id
                    db.session.commit()
            else:
                # Default behavior for project invite codes
                default_role = UserRoles.ADMIN.value
                user = user_crud_service.create_user(
                    username, None, password, project_id, default_role
                )
                
                # Mark invite code as used
                success, error = invite_service.use_invite_code(invite_code, user.id)
                if not success:
                    logger.warning(f"Failed to mark invite code as used: {error}")
        except (ValidationError, ConflictError, ServiceError):
            # Let global error handler deal with these, but ensure rollback
            db.session.rollback()
            raise

        return (
            jsonify(
                {
                    "message": "User registered successfully with invite code",
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "project_id": project_id,
                }
            ),
            201,
        )

    except (ValidationError, ConflictError, ServiceError):
        # Let global error handler deal with these
        raise
    except Exception as e:
        import traceback
        logger.error(f"Error in invite registration: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({"error": "REGISTRATION_FAILED", "message": "Registration failed"}), 500

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
@require_project_isolation
def get_current_user():
    """Get current user information"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "USER_NOT_FOUND"}), 404

        user_profile_service = get_service('user_profile_service')
        profile_data = user_profile_service.get_user_profile(user)
        return jsonify(profile_data)

    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        return jsonify({"error": "INTERNAL_ERROR"}), 500

@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
@require_project_isolation
@validate_request(UserProfileUpdateSchema, allow_empty=True)
def update_profile(validated_data=None):
    """Update user profile"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "USER_NOT_FOUND"}), 404

        if not validated_data:
            validated_data = {}

        user_profile_service = get_service('user_profile_service')
        success, error = user_profile_service.update_user_profile(user, validated_data)
        if not success:
            return jsonify({"error": "UPDATE_FAILED", "message": error}), 400

        return jsonify({"message": "Profile updated successfully"})

    except Exception as e:
        logger.error(f"Error updating profile: {str(e)}")
        return jsonify({"error": "UPDATE_FAILED", "message": "Failed to update profile"}), 500

@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
@require_project_isolation
@validate_request(ChangePasswordRequestSchema)
def change_password(validated_data=None):
    """Change user password"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "USER_NOT_FOUND"}), 404

        if not validated_data:
            return jsonify({"error": "PASSWORD_CHANGE_FAILED", "message": "Invalid request data"}), 400

        user_profile_service = get_service('user_profile_service')
        success, error = user_profile_service.change_password(
            user, validated_data["current_password"], validated_data["new_password"]
        )
        if not success:
            return jsonify({"error": "PASSWORD_CHANGE_FAILED", "message": error}), 400

        return jsonify({"message": "Password changed successfully"})

    except Exception as e:
        logger.error(f"Error changing password: {str(e)}")
        return (
            jsonify({"error": "PASSWORD_CHANGE_FAILED", "message": "Failed to change password"}),
            500,
        )

@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
@require_project_isolation
def logout():
    """
    User logout
    
    SECURITY: This endpoint clears HttpOnly JWT cookies server-side.
    Frontend should NOT manually delete cookies with tokens as they should
    have HttpOnly flag set. This prevents XSS attacks from stealing tokens.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if user:

            try:
                auth_service = get_service('auth_service')
                auth_service.log_login_activity(
                    user,
                    request.remote_addr,
                    request.headers.get("User-Agent", ""),
                    "",
                    "User logged out",
                )
            except Exception as e:
                logger.warning(f"Failed to log logout activity: {e}")

        # SECURITY: Clear HttpOnly cookies server-side using unset_jwt_cookies
        # This sets Set-Cookie headers with expired dates to invalidate the cookies
        # Frontend cannot access HttpOnly cookies, so they must be cleared here
        response = make_response(jsonify({"message": "Logged out successfully"}))
        unset_jwt_cookies(response)
        
        return response

    except Exception as e:
        logger.error(f"Error in logout: {str(e)}")
        # Even on error, try to clear cookies to prevent token leakage
        try:
            response = make_response(jsonify({"error": "LOGOUT_FAILED", "message": "Logout failed"}), 500)
            unset_jwt_cookies(response)
            return response
        except Exception:
            return jsonify({"error": "LOGOUT_FAILED", "message": "Logout failed"}), 500

@auth_bp.route("/validate-code", methods=["POST"])
def validate_access_code():
    """Validate access code for Classic Login products"""
    try:
        data = request.get_json()
        access_code = data.get("access_code")

        if not access_code:
            return jsonify({"error": "Access code is required"}), 400

        from ..models.products import Product
        from ..models.keys import Key

        key = Key.query.filter_by(key=access_code).first()

        if not key:
            return jsonify({"valid": False, "message": "Access code not found"}), 404

        if key.status != 1:
            return jsonify({"valid": False, "message": "Access code is inactive"}), 400

        if key.expires_at and key.expires_at < datetime.utcnow():
            return jsonify({"valid": False, "message": "Access code has expired"}), 400

        product = Product.query.filter_by(id=key.product_id, project_id=key.project_id).first()
        if not product:
            return jsonify({"valid": False, "message": "Product not found"}), 404

        if product.login_type != "classic_login":
            return jsonify({"valid": False, "message": "This product does not use Classic Login"}), 400

        generation_type = "license_key"
        if key.key_metadata:
            try:
                import json

                metadata = json.loads(key.key_metadata)
                generation_type = metadata.get("generation_type", "license_key")
            except:
                pass

        return jsonify(
            {
                "valid": True,
                "message": "Access code is valid",
                "product_id": product.id,
                "product_name": product.name,
                "generation_type": generation_type,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                "max_devices": key.max_devices,
            }
        )

    except Exception as e:
        logger.error(f"Error validating access code: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@validate_request(AccessCodeRegisterSchema)
@auth_bp.route("/activate-code", methods=["POST"])
@jwt_required()
@require_project_isolation
def activate_access_code(validated_data=None):
    """Activate access code for user"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id and not RBACManager.is_owner(user):
            return jsonify({"error": "User must be assigned to a project"}), 403


        from ..models.core import UserProductPermission
        from ..models.products import Product
        from ..models.keys import Key

        key = Key.query.filter_by(key=access_code, project_id=user.project_id).first()

        if not key:
            return jsonify({"error": "Access code not found"}), 404

        if key.status != 1:
            return jsonify({"error": "Access code is inactive"}), 400

        if key.expires_at and key.expires_at < datetime.utcnow():
            return jsonify({"error": "Access code has expired"}), 400

        product = Product.query.filter_by(id=key.product_id, project_id=user.project_id).first()
        if not product or product.name != product_name:
            return jsonify({"error": "Product not found or name mismatch"}), 404

        if product.login_type != "classic_login":
            return jsonify({"error": "This product does not use Classic Login"}), 400

        existing_permission = UserProductPermission.query.filter_by(
            user_id=user_id, product_id=product.id, project_id=user.project_id
        ).first()

        if existing_permission:
            return jsonify(
                {"message": "Access code already activated for this product", "product_name": product.name}
            )

        permission = UserProductPermission(
            user_id=user_id,
            product_id=product.id,
            project_id=user.project_id,
            granted_at=datetime.utcnow(),
            granted_by="access_code",
            access_code=access_code,
        )

        db.session.add(permission)

        try:
            auth_service.log_login_activity(
                user,
                request.remote_addr,
                request.headers.get("User-Agent", ""),
                "",
                f"Activated access code for product: {product.name}",
            )
        except Exception as e:
            logger.warning(f"Failed to log activation activity: {e}")

        db.session.commit()

        return jsonify(
            {
                "message": f"Access code activated successfully for {product.name}",
                "product_name": product.name,
                "expires_at": key.expires_at.isoformat() if key.expires_at else None,
            }
        )

    except Exception as e:
        logger.error(f"Error activating access code: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@validate_request(ClassicLoginRegisterSchema)
@auth_bp.route("/register-with-code", methods=["POST"])
def register_with_code(validated_data=None):
    """Register user with invite code for Classic Login products"""
    try:

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({"error": "Username already exists"}), 400

        if email:
            existing_email = User.query.filter_by(email=email.lower()).first()
            if existing_email:
                return jsonify({"error": "Email already exists"}), 400

        from ..models.core import UserProductPermission
        from ..models.products import Product
        from ..models.keys import Key

        key = Key.query.filter_by(key=invite_code).first()

        if not key:
            return jsonify({"error": "Invalid invite code"}), 404

        if key.status != 1:
            return jsonify({"error": "Invite code is inactive"}), 400

        if key.expires_at and key.expires_at < datetime.utcnow():
            return jsonify({"error": "Invite code has expired"}), 400

        product = Product.query.filter_by(id=key.product_id, project_id=key.project_id).first()
        if not product:
            return jsonify({"error": "Product not found"}), 404

        if product.login_type != "classic_login":
            return jsonify({"error": "This product does not use Classic Login"}), 400

        if product.invite_code_required and not invite_code:
            return jsonify({"error": "Invite code is required for this product"}), 400

        existing_permission = UserProductPermission.query.filter_by(
            access_code=invite_code, project_id=product.project_id
        ).first()

        if existing_permission:
            return jsonify({"error": "Invite code has already been used"}), 400

        from werkzeug.security import generate_password_hash

        hashed_password = generate_password_hash(password)

        user = User(
            username=username,
            password=hashed_password,
            email=email.lower() if email else None,
            role=UserRoles.CLIENT.value,
            project_id=product.project_id,
            created_at=datetime.utcnow(),
        )

        db.session.add(user)
        db.session.flush()

        permission = UserProductPermission(
            user_id=user.id,
            product_id=product.id,
            project_id=product.project_id,
            granted_at=datetime.utcnow(),
            granted_by="invite_code",
            access_code=invite_code,
            has_access=True,
        )

        db.session.add(permission)

        try:
            auth_service.log_login_activity(
                user,
                request.remote_addr,
                request.headers.get("User-Agent", ""),
                "",
                f"Registered with invite code for product: {product.name}",
            )
        except Exception as e:
            logger.warning(f"Failed to log registration activity: {e}")

        db.session.commit()

        from flask_jwt_extended import create_access_token

        access_token = create_access_token(identity=str(user.id))

        return (
            jsonify(
                {
                    "message": f"Registration successful! Welcome to {product.name}",
                    "access_token": access_token,
                    "user": {
                        "id": user.unique_id,
                        "username": user.username,
                        "email": user.email,
                        "roles": RBACManager.get_user_role_names(user),
                    },
                    "product": {"id": product.unique_id, "name": product.name, "login_type": product.login_type},
                }
            ),
            201,
        )

    except Exception as e:
        logger.error(f"Error in register_with_code: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route("/validate_invite_code", methods=["POST"])
def validate_invite_code():
    """Validate an invite code and return information about it"""
    try:
        data = request.get_json() or {}
        invite_code = data.get("invite_code", "").strip()

        if not invite_code:
            return jsonify({"error": "Invite code is required"}), 400

        code_info, error = invite_service.validate_invite_code(invite_code)
        if not code_info:
            return jsonify({"error": error}), 400

        code_type = code_info.get("code_type", "project_invite")
        project_id = code_info.get("project_id")

        response_data = {
            "code": code_info["code"],
            "project_id": project_id,
            "expires_at": code_info["expires_at"],
            "max_uses": code_info.get("max_uses"),
            "used_count": code_info.get("used_count", 0),
            "code_type": code_type,
        }

        # Add referral code specific fields if it's a referral code
        if code_type == "referral":
            response_data["token_balance"] = code_info.get("token_balance", 0)
            response_data["work_duration_days"] = code_info.get("work_duration_days")
            response_data["product_ids"] = code_info.get("product_ids", [])
            response_data["rbac_role_ids"] = code_info.get("rbac_role_ids", [])
            
            # Get role information for rbac_role_ids
            rbac_role_ids = code_info.get("rbac_role_ids", [])
            roles = []
            if rbac_role_ids and project_id:
                from ..models.rbac import Role
                role_objects = Role.query.filter(
                    Role.id.in_(rbac_role_ids),
                    Role.project_id == project_id
                ).all()
                roles = [
                    {
                        "id": role.id,
                        "name": role.name,
                        "description": role.description,
                        "is_system_role": role.is_system_role,
                    }
                    for role in role_objects
                ]
            response_data["roles"] = roles
            response_data["requires_project_name"] = False
        elif project_id:
            # Project invite code with project_id
            project = Project.query.get(project_id)
            if project:
                response_data["project_name"] = project.name
                response_data["requires_project_name"] = False
            else:
                response_data["requires_project_name"] = False
        else:
            # Project invite code without project_id (requires project name)
            response_data["requires_project_name"] = True

        return jsonify(response_data), 200

    except Exception as e:
        import traceback
        logger.error(f"Error validating invite code: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to validate invite code"}), 500
