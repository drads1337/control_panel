"""
RBAC Routes
Handles Role-Based Access Control endpoints
"""

import logging
from datetime import datetime
from functools import wraps

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..middleware.auth import enforce_project_scope, require_project_isolation
from ..middleware.validation import validate_request
from ..models.core import Project, User
from ..models.products import Product
from ..models.rbac import (
    AttributeRule,
    Permission,
    ResourceAttribute,
    Role,
    RolePermission,
    UserAttribute,
    UserPermission,
    UserRole,
)
from ..schemas.rbac import (
    AttributeRuleCreateSchema,
    PermissionCheckSchema,
    PermissionCreateSchema,
    PermissionUpdateSchema,
    ResourceAttributeSetSchema,
    RoleCreateSchema,
    RoleDeleteSchema,
    RolePermissionAssignSchema,
    RolePermissionsUpdateSchema,
    RoleUpdateSchema,
    UserAttributeSetSchema,
    UserPermissionsAssignSchema,
    UserRoleAssignSchema,
)
from ..services.rbac import rbac_service

rbac_bp = Blueprint("rbac", __name__)

def find_product_by_id_or_unique_id(product_identifier, project_id):
    """
    Helper function to find a product by either id (int) or unique_id (string)
    
    Args:
        product_identifier: Either an integer id or string unique_id
        project_id: Project ID to filter by
    
    Returns:
        Product object or None if not found
    """
    from ..models.products import Product
    
    # Try as integer id (primary key) first
    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
        try:
            product_id_int = int(product_identifier)
            product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            if product:
                return product
        except (ValueError, TypeError):
            pass
    
    # Try as unique_id (string)
    product = Product.query.filter_by(unique_id=str(product_identifier), project_id=project_id).first()
    return product

def find_user_by_id_or_unique_id(user_identifier, project_id=None):
    """
    Helper function to find a user by either id (int) or unique_id (string)
    
    Args:
        user_identifier: Either an integer id or string unique_id
        project_id: Optional project_id for additional filtering
    
    Returns:
        User object or None if not found
    """
    # Try as integer id (primary key) first
    if isinstance(user_identifier, int) or (isinstance(user_identifier, str) and user_identifier.isdigit()):
        user = User.query.get(int(user_identifier))
        if user:
            if project_id is None or user.project_id == project_id:
                return user
    
    # Try as unique_id (string)
    user = User.query.filter_by(unique_id=str(user_identifier)).first()
    if user:
        if project_id is None or user.project_id == project_id:
            return user
    
    return None

def get_current_user():
    """Get current user from JWT token"""
    user_id = get_jwt_identity()
    if not user_id:
        return None
    return User.query.get(user_id)

def admin_required(f):
    """Decorator to require admin role (static roles excluded from RBAC management)"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..utils.rbac_utils import RBACManager
        if RBACManager.is_owner(current_user) or RBACManager.is_admin(current_user):
            return jsonify({"error": "Static roles cannot manage RBAC"}), 403

        from ..services.rbac import rbac_service

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        if 'current_user' not in kwargs:
            return f(*args, current_user=current_user, **kwargs)
        return f(*args, **kwargs)

    return decorated_function

def token_required(f):
    """Decorator to require valid JWT token"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        if 'current_user' not in kwargs:
            return f(*args, current_user=current_user, **kwargs)
        return f(*args, **kwargs)

    return decorated_function

@rbac_bp.route("/roles", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_roles(current_user):
    """Get all roles for the current user's project"""
    try:
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        if not current_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        project_id = current_user.project_id

        existing_roles = Role.query.filter_by(project_id=project_id).count()
        if existing_roles == 0:
            logging.info(f"RBAC not initialized for project {project_id}, initializing...")
            success = rbac_service.initialize_default_data(project_id)
            if not success:
                logging.error(f"Failed to initialize RBAC for project {project_id}")
                return jsonify({"error": "Failed to initialize RBAC system"}), 500

        roles = rbac_service.get_roles(project_id)

        filtered_roles = []
        for role in roles:

            if role["name"] in ["owner", "admin"]:
                continue
            filtered_roles.append(role)

        return jsonify({"success": True, "roles": filtered_roles})

    except Exception as e:
        logging.error(
            f"RBAC_ROLES_GET_ERROR user_id={current_user.id if current_user else 'unknown'} error={e}"
        )
        import traceback

        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to get roles", "details": str(e)}), 500

@rbac_bp.route("/roles", methods=["POST"])
@jwt_required()
def create_role():
    """Create a new custom role"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        name = data.get("name")
        description = data.get("description", "")
        permissions = data.get("permissions", [])
        parent_role_id = data.get("parent_role_id")

        if not name:
            return jsonify({"error": "Role name is required"}), 400

        if not isinstance(permissions, list):
            return jsonify({"error": "Permissions must be a list"}), 400

        project_id = current_user.project_id

        role = rbac_service.create_role(
            project_id=project_id,
            name=name,
            description=description,
            permissions=permissions,
            parent_role_id=parent_role_id,
        )

        logging.info(
            f"RBAC_ROLE_CREATED user_id={current_user.id} role_id={role['id']} name={name}"
        )

        return jsonify({"success": True, "role": role}), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(f"RBAC_ROLE_CREATION_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to create role"}), 500

@rbac_bp.route("/roles/<int:role_id>", methods=["PUT"])
@jwt_required()
@require_project_isolation
def update_role(role_id):
    """Update an existing role"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role or role.project_id != current_user.project_id:
            return jsonify({"error": "Role not found"}), 404

        updated_role = rbac_service.update_role(role_id, current_user.project_id, **data)

        logging.info(f"RBAC_ROLE_UPDATED user_id={current_user.id} role_id={role_id}")

        return jsonify({"success": True, "role": updated_role})

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(
            f"RBAC_ROLE_UPDATE_ERROR user_id={current_user.id} role_id={role_id} error={e}"
        )
        return jsonify({"error": "Failed to update role"}), 500

@rbac_bp.route("/roles/<int:role_id>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def delete_role(role_id):
    """Delete a role"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role or role.project_id != current_user.project_id:
            return jsonify({"error": "Role not found"}), 404

        data = request.get_json(silent=True) or {}
        force = data.get("force", False)
        reassign_to_role_id = data.get("reassign_to_role_id")

        success = rbac_service.delete_role(
            role_id, current_user.project_id, force=force, reassign_to_role_id=reassign_to_role_id
        )

        if success:
            logging.info(
                f"RBAC_ROLE_DELETED user_id={current_user.id} role_id={role_id} force={force}"
            )
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Failed to delete role"}), 500

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        user_id = current_user.id if current_user else None
        logging.error(
            f"RBAC_ROLE_DELETION_ERROR user_id={user_id} role_id={role_id} error={e}", exc_info=True
        )
        return jsonify({"error": f"Failed to delete role: {str(e)}"}), 500

@rbac_bp.route("/permissions", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_permissions(current_user):
    """Get all permissions for the current user's project"""
    try:
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        if not current_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        project_id = current_user.project_id

        existing_permissions = Permission.query.filter_by(project_id=project_id).count()
        if existing_permissions == 0:
            logging.info(f"RBAC not initialized for project {project_id}, initializing...")
            success = rbac_service.initialize_default_data(project_id)
            if not success:
                logging.error(f"Failed to initialize RBAC for project {project_id}")
                return jsonify({"error": "Failed to initialize RBAC system"}), 500

        permissions = rbac_service.get_permissions(project_id)

        return jsonify({"success": True, "permissions": permissions})

    except Exception as e:
        logging.error(
            f"RBAC_PERMISSIONS_GET_ERROR user_id={current_user.id if current_user else 'unknown'} error={e}"
        )
        import traceback

        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to get permissions", "details": str(e)}), 500

@rbac_bp.route("/permissions", methods=["POST"])
@jwt_required()
def create_permission():
    """Create a new permission"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        name = data.get("name")
        description = data.get("description", "")
        resource = data.get("resource")
        action = data.get("action")
        product_id = data.get("product_id")
        resource_type = data.get("resource_type")
        resource_id = data.get("resource_id")
        scope = data.get("scope", "global")

        if not all([name, resource, action]):
            return jsonify({"error": "Name, resource, and action are required"}), 400

        permission = rbac_service.create_permission(
            project_id=current_user.project_id,
            name=name,
            description=description,
            resource=resource,
            action=action,
            product_id=product_id,
            resource_type=resource_type,
            resource_id=resource_id,
            scope=scope,
        )

        logging.info(
            f"RBAC_PERMISSION_CREATED user_id={current_user.id} permission_id={permission['id']} name={name}"
        )

        return jsonify({"success": True, "permission": permission}), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(f"RBAC_PERMISSION_CREATION_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to create permission"}), 500

@validate_request(PermissionUpdateSchema)
@rbac_bp.route("/permissions/<int:permission_id>", methods=["PUT"])
@jwt_required()
def update_permission(permission_id, validated_data=None):
    """Update an existing permission"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        update_data = validated_data.dict(exclude_unset=True)
        updated_permission = rbac_service.update_permission(
            permission_id, current_user.project_id, **update_data
        )

        logging.info(
            f"RBAC_PERMISSION_UPDATED user_id={current_user.id} permission_id={permission_id}"
        )

        return jsonify({"success": True, "permission": updated_permission})

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(
            f"RBAC_PERMISSION_UPDATE_ERROR user_id={current_user.id} permission_id={permission_id} error={e}"
        )
        return jsonify({"error": "Failed to update permission"}), 500

@rbac_bp.route("/permissions/<int:permission_id>", methods=["DELETE"])
@jwt_required()
def delete_permission(permission_id):
    """Delete a permission"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.delete"):
            return jsonify({"error": "Admin access required"}), 403

        success = rbac_service.delete_permission(permission_id, current_user.project_id)

        if success:
            logging.info(
                f"RBAC_PERMISSION_DELETED user_id={current_user.id} permission_id={permission_id}"
            )
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Permission not found"}), 404

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(
            f"RBAC_PERMISSION_DELETION_ERROR user_id={current_user.id} permission_id={permission_id} error={e}"
        )
        return jsonify({"error": "Failed to delete permission"}), 500

@rbac_bp.route("/users/<user_id>/roles", methods=["GET"])
@jwt_required()
@token_required
@admin_required
@require_project_isolation
def get_user_roles(user_id, current_user):
    """Get all roles assigned to a user"""

    if not current_user:
        return jsonify({"error": "Authentication required"}), 401

    try:

        target_user = find_user_by_id_or_unique_id(user_id, current_user.project_id)

        if not target_user or not target_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        if target_user.project_id != current_user.project_id:
            return jsonify({"error": "User not found"}), 404

        roles = rbac_service.get_user_roles(target_user.id)

        return jsonify({"success": True, "user_id": target_user.id, "roles": roles})

    except Exception as e:
        logging.error(
            f"RBAC_USER_ROLES_GET_ERROR user_id={current_user.id} target_user_id={user_id} error={e}"
        )
        return jsonify({"error": "Failed to get user roles"}), 500

@rbac_bp.route("/users/<user_id>/roles", methods=["POST"])
@jwt_required()
@token_required
@admin_required
@require_project_isolation
def assign_role_to_user(user_id, current_user):
    """Assign a role to a user"""

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        role_id = data.get("role_id")
        if not role_id:
            return jsonify({"error": "Role ID is required"}), 400

        target_user = find_user_by_id_or_unique_id(user_id, current_user.project_id)

        if not target_user or not target_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        if target_user.project_id != current_user.project_id:
            return jsonify({"error": "User not found"}), 404

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role or role.project_id != current_user.project_id:
            return jsonify({"error": "Role not found"}), 404

        success = rbac_service.assign_role_to_user(target_user.id, role_id)

        if success:
            logging.info(
                f"RBAC_ROLE_ASSIGNED user_id={current_user.id} target_user_id={user_id} role_id={role_id}"
            )
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Failed to assign role"}), 500

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(
            f"RBAC_ROLE_ASSIGNMENT_ERROR user_id={current_user.id} target_user_id={user_id} error={e}"
        )
        return jsonify({"error": "Failed to assign role"}), 500

@rbac_bp.route("/users/<user_id>/roles/<int:role_id>", methods=["DELETE"])
@jwt_required()
@token_required
@admin_required
@require_project_isolation
def remove_role_from_user(user_id, role_id, current_user):
    """Remove a role from a user"""

    try:

        target_user = find_user_by_id_or_unique_id(user_id, current_user.project_id)

        if not target_user or not target_user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
        if target_user.project_id != current_user.project_id:
            return jsonify({"error": "User not found"}), 404

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role or role.project_id != current_user.project_id:
            return jsonify({"error": "Role not found"}), 404

        success = rbac_service.remove_role_from_user(target_user.id, role_id)

        if success:
            logging.info(
                f"RBAC_ROLE_REMOVED user_id={current_user.id} target_user_id={user_id} role_id={role_id}"
            )
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Role not assigned to user"}), 404

    except Exception as e:
        logging.error(
            f"RBAC_ROLE_REMOVAL_ERROR user_id={current_user.id} target_user_id={user_id} role_id={role_id} error={e}"
        )
        return jsonify({"error": "Failed to remove role"}), 500

@rbac_bp.route("/users/<user_id>/permissions", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_user_permissions(user_id, current_user):
    """Get all permissions for a user"""

    logging.info(
        f"RBAC_PERMISSIONS_GET: Request for user_id={user_id} (type={type(user_id).__name__}) by current_user_id={current_user.id} "
        f"(username={current_user.username}, project_id={current_user.project_id})"
    )

    try:

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        has_view_permission = rbac_service.check_permission(current_user.id, "employees.view")
        has_rbac_permission = rbac_service.check_permission(current_user.id, "rbac.view")

        logging.debug(
            f"RBAC_PERMISSIONS_GET: current_user permissions - employees.view={has_view_permission}, "
            f"rbac.view={has_rbac_permission}, is_owner={RBACManager.is_owner(current_user)}, "
            f"is_admin={RBACManager.is_admin(current_user)}"
        )

        if not has_view_permission and not has_rbac_permission:

            if not (RBACManager.is_owner(current_user) or RBACManager.is_admin(current_user)):
                logging.warning(
                    f"RBAC_PERMISSIONS_GET: Insufficient permissions - current_user_id={current_user.id} "
                    f"trying to access user_id={user_id}"
                )
                return jsonify({"error": "Insufficient permissions"}), 403

        # Check if user exists in database - try by id or unique_id
        target_user = find_user_by_id_or_unique_id(user_id, current_user.project_id)
        
        if not target_user:
            # Additional debugging: check if any user with this ID exists (shouldn't be needed, but for debugging)
            from sqlalchemy import text
            try:
                result = db.session.execute(
                    text("SELECT id, username, project_id FROM \"user\" WHERE id = :user_id"),
                    {"user_id": user_id}
                ).fetchone()
                
                if result:
                    logging.error(
                        f"RBAC_PERMISSIONS_GET: User {user_id} exists in DB (username={result[1]}, project_id={result[2]}) "
                        f"but User.query.get() returned None. This is unexpected! "
                        f"Requested by current_user_id={current_user.id} (project_id={current_user.project_id})"
                    )
                else:
                    logging.error(
                        f"RBAC_PERMISSIONS_GET: User not found - user_id={user_id} does not exist in database at all. "
                        f"Requested by current_user_id={current_user.id} (username={current_user.username}, project_id={current_user.project_id})"
                    )
            except Exception as db_error:
                logging.error(
                    f"RBAC_PERMISSIONS_GET: Error checking user existence: {db_error}. "
                    f"User {user_id} not found. Requested by current_user_id={current_user.id}"
                )
            
            return jsonify({"error": "User not found"}), 404

        logging.info(
            f"RBAC_PERMISSIONS_GET: Target user found - user_id={user_id}, username={target_user.username}, "
            f"project_id={target_user.project_id}, current_user_project_id={current_user.project_id}"
        )

        if not target_user.project_id:
            logging.warning(
                f"RBAC_PERMISSIONS_GET: User {user_id} (username={target_user.username}) has no project_id. "
                f"Returning empty permissions list."
            )

            return jsonify({"success": True, "user_id": user_id, "permissions": []})

        if target_user.project_id != current_user.project_id:
            logging.error(
                f"RBAC_PERMISSIONS_GET: Project isolation violation - user_id={user_id} "
                f"(username={target_user.username}, project_id={target_user.project_id}) "
                f"belongs to different project than current_user_id={current_user.id} "
                f"(username={current_user.username}, project_id={current_user.project_id}). "
                f"Returning 404 to prevent information leakage."
            )
            return jsonify({"error": "User not found"}), 404

        try:
            # Use the actual database id for the service call
            permissions = rbac_service.get_user_permissions(target_user.id)
            logging.info(
                f"RBAC_PERMISSIONS_GET: Successfully retrieved {len(permissions) if permissions else 0} "
                f"permissions for user_id={user_id} (username={target_user.username})"
            )
            return jsonify(
                {
                    "success": True,
                    "user_id": target_user.id,
                    "permissions": list(permissions) if permissions else [],
                }
            )
        except Exception as perm_error:
            logging.error(
                f"Failed to get permissions for user {user_id}: {perm_error}", exc_info=True
            )

            return jsonify({"success": True, "user_id": user_id, "permissions": []})

    except Exception as e:
        logging.error(
            f"RBAC_USER_PERMISSIONS_GET_ERROR user_id={current_user.id if current_user else 'unknown'} target_user_id={user_id} error={e}",
            exc_info=True,
        )
        import traceback

        logging.error(f"Traceback: {traceback.format_exc()}")

        return jsonify({"success": True, "user_id": user_id, "permissions": [], "error": str(e)})

@validate_request(UserPermissionsAssignSchema)
@rbac_bp.route("/users/<user_id>/permissions", methods=["PUT"])
@jwt_required()
@token_required
@require_project_isolation
def update_user_permissions(user_id, current_user, validated_data=None):
    """Update individual permissions for a user (overrides role permissions)"""

    try:

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        has_edit_permission = rbac_service.check_permission(current_user.id, "employees.edit")
        has_rbac_permission = rbac_service.check_permission(current_user.id, "rbac.view")

        if not has_edit_permission and not has_rbac_permission:

            if not (RBACManager.is_owner(current_user) or RBACManager.is_admin(current_user)):
                return jsonify({"error": "Insufficient permissions"}), 403

        target_user = find_user_by_id_or_unique_id(user_id, current_user.project_id)

        if not target_user:
            return jsonify({"error": "User not found"}), 404

        if target_user.project_id != current_user.project_id:
            return jsonify({"error": "User not found"}), 404

        user_roles = RBACManager.get_user_role_names(target_user)
        if "owner" in user_roles or "admin" in user_roles:
            logging.warning(
                f"RBAC_USER_PERMISSIONS_UPDATE_BLOCKED user_id={current_user.id} target_user_id={user_id} reason=static_role roles={user_roles}"
            )
            return jsonify({"error": "Static roles cannot manage RBAC"}), 403

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        permissions = validated_data.permissions

        if len(permissions) == 0:
            logging.warning(
                f"RBAC_USER_PERMISSIONS_UPDATE_BLOCKED user_id={current_user.id} target_user_id={user_id} reason=no_permissions"
            )
            return jsonify({"error": "At least one permission is required"}), 400

        logging.info(
            f"RBAC_USER_PERMISSIONS_UPDATE_REQUEST user_id={current_user.id} target_user_id={user_id} permissions_count={len(permissions)} permissions={permissions}"
        )

        project_permissions = Permission.query.filter_by(project_id=current_user.project_id).all()
        permission_map = {p.name: p for p in project_permissions}

        logging.debug(
            f"RBAC_USER_PERMISSIONS_UPDATE_AVAILABLE project_id={current_user.project_id} available_permissions_count={len(permission_map)}"
        )

        invalid_permissions = [p for p in permissions if p not in permission_map]
        if invalid_permissions:
            logging.warning(
                f"RBAC_USER_PERMISSIONS_UPDATE_INVALID user_id={current_user.id} target_user_id={user_id} invalid_permissions={invalid_permissions}"
            )
            return jsonify({"error": f"Invalid permissions: {', '.join(invalid_permissions)}"}), 400

        from ..models.rbac import UserPermission
        # Use the actual database id
        actual_user_id = target_user.id
        deleted_count = UserPermission.query.filter_by(user_id=actual_user_id).delete()
        logging.debug(
            f"RBAC_USER_PERMISSIONS_DELETE_EXISTING user_id={actual_user_id} deleted_count={deleted_count}"
        )

        added_count = 0
        for permission_name in permissions:
            permission = permission_map[permission_name]
            user_permission = UserPermission(
                user_id=actual_user_id,
                permission_id=permission.id,
                permission_type="allow"
            )
            db.session.add(user_permission)
            added_count += 1

        db.session.commit()
        logging.debug(
            f"RBAC_USER_PERMISSIONS_ADDED user_id={actual_user_id} added_count={added_count}"
        )

        from ..utils.service_helpers import get_service
        cache_service = get_service('cache_service')
        cache_service.delete("rbac:user_permissions", user_id=actual_user_id)

        logging.info(
            f"RBAC_USER_PERMISSIONS_UPDATED user_id={current_user.id} target_user_id={actual_user_id} permissions_count={len(permissions)}"
        )

        return jsonify({"success": True, "user_id": actual_user_id, "permissions_count": len(permissions)})

    except Exception as e:
        db.session.rollback()
        logging.error(
            f"RBAC_USER_PERMISSIONS_UPDATE_ERROR user_id={current_user.id if current_user else 'unknown'} target_user_id={user_id} error={e}",
            exc_info=True,
        )
        return jsonify({"error": "Failed to update user permissions"}), 500

@validate_request(PermissionCheckSchema)
@rbac_bp.route("/check-permission", methods=["POST"])
@jwt_required()
@token_required
def check_permission(current_user, validated_data=None):
    """Check if current user has a specific permission"""
    try:
        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        permission = validated_data.permission
        resource_type = validated_data.resource_type
        resource_id = validated_data.resource_id
        context = validated_data.context

        has_permission = rbac_service.check_permission(
            current_user.id, permission, resource_type=resource_type, resource_id=resource_id, context=context
        )

        return jsonify(
            {"success": True, "permission": permission, "has_permission": has_permission}
        )

    except Exception as e:
        logging.error(f"RBAC_PERMISSION_CHECK_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to check permission"}), 500

@rbac_bp.route("/roles/<int:role_id>/users", methods=["GET"])
@jwt_required()
@token_required
@admin_required
@require_project_isolation
def get_role_users(current_user, role_id):
    """Get all users assigned to a role"""
    try:

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role or role.project_id != current_user.project_id:
            return jsonify({"error": "Role not found"}), 404

        users = rbac_service.get_role_users(role_id)

        return jsonify({"success": True, "role_id": role_id, "users": users})

    except Exception as e:
        logging.error(
            f"RBAC_ROLE_USERS_GET_ERROR user_id={current_user.id} role_id={role_id} error={e}"
        )
        return jsonify({"error": "Failed to get role users"}), 500

@rbac_bp.route("/statistics", methods=["GET"])
@jwt_required()
@token_required
@admin_required
def get_rbac_statistics(current_user):
    """Get RBAC statistics for the project"""
    try:
        project_id = current_user.project_id
        statistics = rbac_service.get_rbac_statistics(project_id)

        return jsonify({"success": True, "statistics": statistics})

    except Exception as e:
        logging.error(f"RBAC_STATISTICS_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get RBAC statistics"}), 500

@rbac_bp.route("/initialize", methods=["POST"])
@jwt_required()
@token_required
@admin_required
@require_project_isolation
def initialize_rbac(current_user):
    """Initialize RBAC system for the project"""
    try:
        project_id = current_user.project_id

        existing_roles = Role.query.filter_by(project_id=project_id).count()
        if existing_roles > 0:
            return jsonify({"error": "RBAC system is already initialized for this project"}), 400

        success = rbac_service.initialize_default_data(project_id)

        if success:
            logging.info(f"RBAC_INITIALIZED user_id={current_user.id} project_id={project_id}")
            return jsonify({"success": True, "message": "RBAC system initialized successfully"})
        else:
            return jsonify({"error": "Failed to initialize RBAC system"}), 500

    except Exception as e:
        logging.error(f"RBAC_INITIALIZATION_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to initialize RBAC system"}), 500

@rbac_bp.route("/products", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_products_for_rbac(current_user):
    """Get all products for RBAC management"""
    try:
        project_id = current_user.project_id
        products = Product.query.filter_by(project_id=project_id).all()

        products_data = []
        for product in products:
            products_data.append(
                {
                    "id": product.id,
                    "name": product.name,
                    "description": product.description,
                    "status": product.status,
                    "created_at": product.created_at.isoformat() if product.created_at else None,
                }
            )

        return jsonify({"success": True, "products": products_data})

    except Exception as e:
        logging.error(f"RBAC_PRODUCTS_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get products"}), 500

@rbac_bp.route("/products/<product_identifier>/permissions", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_product_permissions(current_user, product_identifier):
    """Get permissions for a specific product"""
    try:

        product = find_product_by_id_or_unique_id(product_identifier, current_user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        permissions = Permission.query.filter_by(
            project_id=current_user.project_id, product_id=product.id
        ).all()

        permissions_data = []
        for permission in permissions:
            permissions_data.append(
                {
                    "id": permission.id,
                    "name": permission.name,
                    "description": permission.description,
                    "resource": permission.resource,
                    "action": permission.action,
                    "product_id": permission.product_id,
                }
            )

        return jsonify(
            {
                "success": True,
                "product": {"id": product.unique_id, "name": product.name},
                "permissions": permissions_data,
            }
        )

    except Exception as e:
        logging.error(
            f"RBAC_PRODUCT_PERMISSIONS_GET_ERROR user_id={current_user.id} product_identifier={product_identifier} error={e}"
        )
        return jsonify({"error": "Failed to get product permissions"}), 500

@rbac_bp.route("/products/<product_identifier>/permissions", methods=["POST"])
@jwt_required()
@require_project_isolation
def create_product_permission(product_identifier):
    """Create a new permission for a specific product"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        product = find_product_by_id_or_unique_id(product_identifier, current_user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        name = data.get("name")
        description = data.get("description", "")
        resource = data.get("resource")
        action = data.get("action")

        if not all([name, resource, action]):
            return jsonify({"error": "Name, resource, and action are required"}), 400

        permission = Permission(
            name=name,
            description=description,
            resource=resource,
            action=action,
            product_id=product.id,
            project_id=current_user.project_id,
            created_at=datetime.utcnow(),
        )

        db.session.add(permission)
        db.session.commit()

        logging.info(
            f"RBAC_PRODUCT_PERMISSION_CREATED user_id={current_user.id} product_id={product.id} permission_id={permission.id}"
        )

        return (
            jsonify(
                {
                    "success": True,
                    "permission": {
                        "id": permission.id,
                        "name": permission.name,
                        "description": permission.description,
                        "resource": permission.resource,
                        "action": permission.action,
                        "product_id": permission.product_id,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        logging.error(
            f"RBAC_PRODUCT_PERMISSION_CREATION_ERROR user_id={current_user.id} product_identifier={product_identifier} error={e}"
        )
        return jsonify({"error": "Failed to create product permission"}), 500

@rbac_bp.route("/roles/<int:role_id>/products/<product_identifier>/permissions", methods=["POST"])
@jwt_required()
@require_project_isolation
def assign_product_permissions_to_role(role_id, product_identifier):
    """Assign product-specific permissions to a role"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role:
            return jsonify({"error": "Role not found"}), 404

        product = find_product_by_id_or_unique_id(product_identifier, current_user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404
        
        product_id = product.id

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        permissions = data.get("permissions", [])
        if not isinstance(permissions, list):
            return jsonify({"error": "Permissions must be a list"}), 400

        assigned_permissions = []
        for permission_name in permissions:

            permission = Permission.query.filter_by(
                name=permission_name, project_id=current_user.project_id, product_id=product.id
            ).first()

            if not permission:

                resource, action = (
                    permission_name.split(".", 1)
                    if "." in permission_name
                    else (permission_name, "view")
                )
                permission = Permission(
                    name=permission_name,
                    description=f"Product-specific permission for {product.name}",
                    resource=resource,
                    action=action,
                    product_id=product.id,
                    project_id=current_user.project_id,
                    created_at=datetime.utcnow(),
                )
                db.session.add(permission)
                db.session.flush()

            existing = RolePermission.query.filter_by(
                role_id=role_id, permission_id=permission.id
            ).first()

            if not existing:
                role_permission = RolePermission(
                    role_id=role_id, permission_id=permission.id, created_at=datetime.utcnow()
                )
                db.session.add(role_permission)
                assigned_permissions.append(permission_name)

        db.session.commit()

        logging.info(
            f"RBAC_PRODUCT_PERMISSIONS_ASSIGNED user_id={current_user.id} role_id={role_id} product_id={product_id} permissions={assigned_permissions}"
        )

        return jsonify(
            {
                "success": True,
                "assigned_permissions": assigned_permissions,
                "role": role.name,
                "product": product.name,
            }
        )

    except Exception as e:
        db.session.rollback()
        logging.error(
            f"RBAC_PRODUCT_PERMISSIONS_ASSIGNMENT_ERROR user_id={current_user.id} role_id={role_id} product_id={product_id} error={e}"
        )
        return jsonify({"error": "Failed to assign product permissions"}), 500

@rbac_bp.route("/files", methods=["GET"])
@jwt_required()
@token_required
def get_files_for_rbac(current_user):
    """Get files for RBAC management"""
    try:

        if not rbac_service.check_permission(current_user.id, "files.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.products import FileMeta as File

        project_id = current_user.project_id
        files = File.query.filter_by(project_id=project_id).all()

        files_data = []
        for file in files:
            files_data.append(
                {
                    "id": file.id,
                    "name": file.name,
                    "path": file.path,
                    "size": file.size,
                    "uploaded_at": file.uploaded_at.isoformat() if file.uploaded_at else None,
                    "uploaded_by": file.uploaded_by,
                }
            )

        return jsonify({"success": True, "files": files_data})

    except Exception as e:
        logging.error(f"RBAC_FILES_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get files"}), 500

@rbac_bp.route("/notifications", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_notifications_for_rbac(current_user):
    """Get notifications for RBAC management"""
    try:

        if not rbac_service.check_permission(current_user.id, "notifications.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.notifications import Notification

        project_id = current_user.project_id
        notifications = Notification.query.filter_by(project_id=project_id).all()

        notifications_data = []
        for notification in notifications:
            notifications_data.append(
                {
                    "id": notification.id,
                    "title": notification.title,
                    "message": notification.message,
                    "type": notification.type,
                    "status": notification.status,
                    "created_at": (
                        notification.created_at.isoformat() if notification.created_at else None
                    ),
                    "created_by": notification.created_by,
                }
            )

        return jsonify({"success": True, "notifications": notifications_data})

    except Exception as e:
        logging.error(f"RBAC_NOTIFICATIONS_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get notifications"}), 500

@rbac_bp.route("/changelog", methods=["GET"])
@jwt_required()
@token_required
def get_changelog_for_rbac(current_user):
    """Get changelog for RBAC management"""
    try:

        if not rbac_service.check_permission(current_user.id, "changelog.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.products import ChangelogEntry

        project_id = current_user.project_id
        changelog_entries = ChangelogEntry.query.filter_by(project_id=project_id).all()

        changelog_data = []
        for entry in changelog_entries:
            changelog_data.append(
                {
                    "id": entry.id,
                    "title": entry.title,
                    "description": entry.description,
                    "version": entry.version,
                    "type": entry.type,
                    "status": entry.status,
                    "created_at": entry.created_at.isoformat() if entry.created_at else None,
                    "created_by": entry.created_by,
                }
            )

        return jsonify({"success": True, "changelog": changelog_data})

    except Exception as e:
        logging.error(f"RBAC_CHANGELOG_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get changelog"}), 500

@rbac_bp.route("/billing", methods=["GET"])
@jwt_required()
@token_required
def get_billing_for_rbac(current_user):
    """Get billing information for RBAC management"""
    try:

        if not rbac_service.check_permission(current_user.id, "billing.view"):
            return jsonify({"error": "Insufficient permissions"}), 403

        from ..models.servers import Billing as BillingInfo

        project_id = current_user.project_id
        billing_info = BillingInfo.query.filter_by(project_id=project_id).first()

        if not billing_info:
            return jsonify(
                {
                    "success": True,
                    "billing": {"balance": 0.0, "currency": "USD", "last_transaction": None},
                }
            )

        billing_data = {
            "id": billing_info.id,
            "balance": float(billing_info.balance),
            "currency": billing_info.currency,
            "last_transaction": (
                billing_info.last_transaction.isoformat() if billing_info.last_transaction else None
            ),
            "updated_at": billing_info.updated_at.isoformat() if billing_info.updated_at else None,
        }

        return jsonify({"success": True, "billing": billing_data})

    except Exception as e:
        logging.error(f"RBAC_BILLING_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get billing information"}), 500

@rbac_bp.route("/billing/top-up", methods=["POST"])
@jwt_required()
def top_up_balance():
    """Top up account balance"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        if not rbac_service.check_permission(current_user.id, "billing.top_up"):
            return jsonify({"error": "Insufficient permissions"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        amount = data.get("amount")
        payment_method = data.get("payment_method", "card")

        if not amount or amount <= 0:
            return jsonify({"error": "Invalid amount"}), 400

        from ..models.servers import Billing as BillingInfo

        project_id = current_user.project_id
        billing_info = BillingInfo.query.filter_by(project_id=project_id).first()

        if not billing_info:
            billing_info = BillingInfo(
                project_id=project_id, balance=0.0, currency="USD", created_at=datetime.utcnow()
            )
            db.session.add(billing_info)

        billing_info.balance += amount
        billing_info.last_transaction = datetime.utcnow()
        billing_info.updated_at = datetime.utcnow()

        db.session.commit()

        logging.info(
            f"RBAC_BALANCE_TOP_UP user_id={current_user.id} amount={amount} new_balance={billing_info.balance}"
        )

        return jsonify(
            {
                "success": True,
                "message": f"Balance topped up by ${amount}",
                "new_balance": float(billing_info.balance),
            }
        )

    except Exception as e:
        db.session.rollback()
        logging.error(f"RBAC_BALANCE_TOP_UP_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to top up balance"}), 500

@rbac_bp.route("/hierarchy", methods=["GET"])
@jwt_required()
@token_required
def get_role_hierarchy(current_user):
    """Get role hierarchy for the current user's project"""
    try:
        project_id = current_user.project_id
        hierarchy = rbac_service.get_role_hierarchy(project_id)

        return jsonify({"success": True, "hierarchy": hierarchy})

    except Exception as e:
        logging.error(f"RBAC_HIERARCHY_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get role hierarchy"}), 500

@rbac_bp.route("/roles/<int:role_id>/inheritance", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_role_inheritance_chain(current_user, role_id):
    """Get inheritance chain for a specific role"""
    try:

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role:
            return jsonify({"error": "Role not found"}), 404

        chain = rbac_service.get_role_inheritance_chain(role_id)

        return jsonify({"success": True, "role_id": role_id, "inheritance_chain": chain})

    except Exception as e:
        logging.error(
            f"RBAC_INHERITANCE_CHAIN_GET_ERROR user_id={current_user.id} role_id={role_id} error={e}"
        )
        return jsonify({"error": "Failed to get inheritance chain"}), 500

@rbac_bp.route("/status", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_rbac_status(current_user):
    """Get RBAC system status for the current user's project"""
    try:
        project_id = current_user.project_id

        from ...services.projects import project_relationships_service
        
        roles_count = Role.query.filter_by(project_id=project_id).count()
        permissions_count = Permission.query.filter_by(project_id=project_id).count()
        users_count = project_relationships_service.get_user_count(project_id)

        user_roles_count = UserRole.query.join(Role).filter(Role.project_id == project_id).count()

        is_initialized = roles_count > 0

        user_roles = rbac_service.get_user_roles(current_user.id)

        user_permissions = rbac_service.get_user_permissions(current_user.id)

        return jsonify(
            {
                "success": True,
                "status": {
                    "is_initialized": is_initialized,
                    "roles_count": roles_count,
                    "permissions_count": permissions_count,
                    "users_count": users_count,
                    "user_roles_count": user_roles_count,
                    "current_user": {
                        "id": current_user.unique_id,
                        "username": current_user.username,
                        "roles": user_roles,
                        "permissions": list(user_permissions),
                    },
                },
            }
        )

    except Exception as e:
        logging.error(f"RBAC_STATUS_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get RBAC status"}), 500

@rbac_bp.route("/abac/rules", methods=["GET"])
@jwt_required()
@token_required
def get_abac_rules(current_user):
    """Get all ABAC rules for the current user's project"""
    try:
        project_id = current_user.project_id
        rules = (
            AttributeRule.query.filter_by(project_id=project_id)
            .order_by(AttributeRule.priority)
            .all()
        )

        rules_data = []
        for rule in rules:
            rules_data.append(
                {
                    "id": rule.id,
                    "name": rule.name,
                    "description": rule.description,
                    "rule_type": rule.rule_type,
                    "conditions": rule.get_conditions(),
                    "target_resource": rule.target_resource,
                    "target_action": rule.target_action,
                    "priority": rule.priority,
                    "is_active": rule.is_active,
                    "created_at": rule.created_at.isoformat(),
                    "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
                }
            )

        return jsonify({"success": True, "rules": rules_data})

    except Exception as e:
        logging.error(f"ABAC_RULES_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get ABAC rules"}), 500

@rbac_bp.route("/abac/rules", methods=["POST"])
@jwt_required()
def create_abac_rule():
    """Create a new ABAC rule"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        name = data.get("name")
        description = data.get("description", "")
        rule_type = data.get("rule_type")
        conditions = data.get("conditions", {})
        target_resource = data.get("target_resource")
        target_action = data.get("target_action")
        priority = data.get("priority", 100)

        if not all([name, rule_type]):
            return jsonify({"error": "Name and rule_type are required"}), 400

        rule = rbac_service.create_attribute_rule(
            project_id=current_user.project_id,
            name=name,
            description=description,
            rule_type=rule_type,
            conditions=conditions,
            target_resource=target_resource,
            target_action=target_action,
            priority=priority,
        )

        logging.info(
            f"ABAC_RULE_CREATED user_id={current_user.id} rule_id={rule['id']} name={name}"
        )

        return jsonify({"success": True, "rule": rule}), 201

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(f"ABAC_RULE_CREATION_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to create ABAC rule"}), 500

@rbac_bp.route("/abac/users/<int:user_id>/attributes", methods=["POST"])
@jwt_required()
@require_project_isolation
def set_user_attribute(user_id):
    """Set a user attribute for ABAC"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        target_user = User.query.get(user_id)
        if not target_user or target_user.project_id != current_user.project_id:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        attribute_name = data.get("attribute_name")
        attribute_value = data.get("attribute_value")
        attribute_type = data.get("attribute_type", "string")

        if not all([attribute_name, attribute_value]):
            return jsonify({"error": "attribute_name and attribute_value are required"}), 400

        attribute = rbac_service.set_user_attribute(
            user_id=user_id,
            attribute_name=attribute_name,
            attribute_value=attribute_value,
            attribute_type=attribute_type,
        )

        logging.info(
            f"ABAC_USER_ATTRIBUTE_SET user_id={current_user.id} target_user_id={user_id} name={attribute_name}"
        )

        return jsonify({"success": True, "attribute": attribute})

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(
            f"ABAC_USER_ATTRIBUTE_SET_ERROR user_id={current_user.id} target_user_id={user_id} error={e}"
        )
        return jsonify({"error": "Failed to set user attribute"}), 500

@rbac_bp.route("/abac/resources/<resource_type>/<int:resource_id>/attributes", methods=["POST"])
@jwt_required()
def set_resource_attribute(resource_type, resource_id):
    """Set a resource attribute for ABAC"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        attribute_name = data.get("attribute_name")
        attribute_value = data.get("attribute_value")
        attribute_type = data.get("attribute_type", "string")

        if not all([attribute_name, attribute_value]):
            return jsonify({"error": "attribute_name and attribute_value are required"}), 400

        attribute = rbac_service.set_resource_attribute(
            project_id=current_user.project_id,
            resource_type=resource_type,
            resource_id=resource_id,
            attribute_name=attribute_name,
            attribute_value=attribute_value,
            attribute_type=attribute_type,
        )

        logging.info(
            f"ABAC_RESOURCE_ATTRIBUTE_SET user_id={current_user.id} resource_type={resource_type} resource_id={resource_id} name={attribute_name}"
        )

        return jsonify({"success": True, "attribute": attribute})

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(
            f"ABAC_RESOURCE_ATTRIBUTE_SET_ERROR user_id={current_user.id} resource_type={resource_type} resource_id={resource_id} error={e}"
        )
        return jsonify({"error": "Failed to set resource attribute"}), 500

@validate_request(PermissionCheckSchema)
@rbac_bp.route("/abac/check-permission", methods=["POST"])
@jwt_required()
@token_required
def check_abac_permission(current_user, validated_data=None):
    """Check permission with ABAC context"""
    try:
        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        permission = validated_data.permission
        resource_type = validated_data.resource_type
        resource_id = validated_data.resource_id
        context = validated_data.context

        has_permission = rbac_service.check_permission(
            user_id=current_user.id,
            permission=permission,
            resource_type=resource_type,
            resource_id=resource_id,
            context=context,
        )

        return jsonify(
            {
                "success": True,
                "permission": permission,
                "has_permission": has_permission,
                "context": {
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "additional_context": context,
                },
            }
        )

    except Exception as e:
        logging.error(f"ABAC_PERMISSION_CHECK_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to check ABAC permission"}), 500

@rbac_bp.route("/resources", methods=["GET"])
@jwt_required()
@token_required
def get_available_resources(current_user):
    """Get all available resources for permission management"""
    try:
        project_id = current_user.project_id

        resource_types = {
            "keys": {
                "model": "Key",
                "display_name": "Keys",
                "description": "License keys and activation codes",
            },
            "products": {
                "model": "Product",
                "display_name": "Products",
                "description": "Product configurations and settings",
            },
            "files": {
                "model": "File",
                "display_name": "Files",
                "description": "Uploaded files and documents",
            },
            "servers": {
                "model": "Server",
                "display_name": "Servers",
                "description": "Server configurations",
            },
            "users": {"model": "User", "display_name": "Users", "description": "User accounts"},
            "webhooks": {
                "model": "Webhook",
                "display_name": "Webhooks",
                "description": "Webhook configurations",
            },
        }

        resources_data = []

        for resource_type, config in resource_types.items():
            try:

                from ..models.core import Project, User
                from ..models.products import Product
                from ..models.keys import Key
                from ..models.agents import Agent
                from ..models.servers import Server
                from ..models.webhooks import Webhook

                model_mapping = {
                    "Project": Project,
                    "User": User,
                    "Product": Product,
                    "Key": Key,
                    "Agent": Agent,
                    "Webhook": Webhook,
                    "Server": Server,
                }
                model_class = model_mapping.get(config["model"])

                if model_class:

                    count = model_class.query.filter_by(project_id=project_id).count()

                    resources_data.append(
                        {
                            "type": resource_type,
                            "display_name": config["display_name"],
                            "description": config["description"],
                            "count": count,
                            "available_actions": _get_available_actions(resource_type),
                        }
                    )
            except Exception as e:
                logging.warning(f"Failed to get resource count for {resource_type}: {e}")
                continue

        return jsonify({"success": True, "resources": resources_data})

    except Exception as e:
        logging.error(f"RBAC_RESOURCES_GET_ERROR user_id={current_user.id} error={e}")
        return jsonify({"error": "Failed to get available resources"}), 500

@rbac_bp.route("/resources/<resource_type>", methods=["GET"])
@jwt_required()
@token_required
def get_resource_instances(current_user, resource_type):
    """Get instances of a specific resource type"""
    try:
        project_id = current_user.project_id

        model_mapping = {
            "keys": "Key",
            "products": "Product",
            "files": "File",
            "servers": "Server",
            "users": "User",
            "webhooks": "Webhook",
        }

        if resource_type not in model_mapping:
            return jsonify({"error": "Invalid resource type"}), 400

        from ..models.core import Project, User
        from ..models.products import Product
        from ..models.keys import Key
        from ..models.agents import Agent
        from ..models.servers import Server
        from ..models.webhooks import Webhook

        model_classes = {
            "Project": Project,
            "User": User,
            "Product": Product,
            "Key": Key,
            "Agent": Agent,
            "Webhook": Webhook,
            "Server": Server,
        }
        model_class = model_classes.get(model_mapping[resource_type])

        if not model_class:
            return jsonify({"error": "Resource type not supported"}), 400

        instances = model_class.query.filter_by(project_id=project_id).all()

        instances_data = []
        for instance in instances:

            instance_data = {
                "id": instance.id,
                "name": getattr(instance, "name", f"{resource_type}_{instance.id}"),
                "description": getattr(instance, "description", ""),
                "created_at": getattr(instance, "created_at", None),
            }

            if hasattr(instance, "status"):
                instance_data["status"] = instance.status
            if hasattr(instance, "type"):
                instance_data["type"] = instance.type

            instances_data.append(instance_data)

        return jsonify(
            {"success": True, "resource_type": resource_type, "instances": instances_data}
        )

    except Exception as e:
        logging.error(
            f"RBAC_RESOURCE_INSTANCES_GET_ERROR user_id={current_user.id} resource_type={resource_type} error={e}"
        )
        return jsonify({"error": "Failed to get resource instances"}), 500

@rbac_bp.route("/resources/<resource_type>/<int:resource_id>/permissions", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_resource_permissions(current_user, resource_type, resource_id):
    """Get permissions for a specific resource instance"""
    try:
        project_id = current_user.project_id

        permissions = Permission.query.filter_by(
            project_id=project_id, resource_type=resource_type, resource_id=resource_id
        ).all()

        permissions_data = []
        for permission in permissions:
            permissions_data.append(
                {
                    "id": permission.id,
                    "name": permission.name,
                    "description": permission.description,
                    "resource": permission.resource,
                    "action": permission.action,
                    "scope": permission.scope,
                    "resource_identifier": permission.get_resource_identifier(),
                    "created_at": permission.created_at.isoformat(),
                }
            )

        return jsonify(
            {
                "success": True,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "permissions": permissions_data,
            }
        )

    except Exception as e:
        logging.error(
            f"RBAC_RESOURCE_PERMISSIONS_GET_ERROR user_id={current_user.id} resource_type={resource_type} resource_id={resource_id} error={e}"
        )
        return jsonify({"error": "Failed to get resource permissions"}), 500

def _get_available_actions(resource_type):
    """Get available actions for a resource type"""
    action_mapping = {
        "keys": ["view", "create", "edit", "delete", "generate", "activate", "deactivate"],
        "products": ["view", "create", "edit", "delete", "activate", "deactivate", "configure"],
        "files": ["view", "upload", "download", "delete", "manage"],
        "servers": ["view", "create", "edit", "delete", "start", "stop", "restart"],
        "users": ["view", "create", "edit", "delete", "manage_roles", "reset_password"],
        "webhooks": ["view", "create", "edit", "delete", "test", "enable", "disable"],
    }

    return action_mapping.get(resource_type, ["view", "create", "edit", "delete"])

@rbac_bp.route("/roles/<int:role_id>/permissions", methods=["POST"])
@jwt_required()
@require_project_isolation
def assign_permission_to_role(role_id):
    """Assign a permission to a role with allow/deny type"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role:
            return jsonify({"error": "Role not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        permission_id = data.get("permission_id")
        permission_type = data.get("permission_type", "allow")

        if not permission_id:
            return jsonify({"error": "permission_id is required"}), 400

        permission = Permission.query.filter_by(
            id=permission_id, project_id=current_user.project_id
        ).first()
        if not permission:
            return jsonify({"error": "Permission not found"}), 404

        success = rbac_service.assign_permission_to_role(role_id, permission_id, permission_type)

        if success:
            logging.info(
                f"RBAC_PERMISSION_ASSIGNED user_id={current_user.id} role_id={role_id} permission_id={permission_id} type={permission_type}"
            )
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Failed to assign permission"}), 500

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logging.error(
            f"RBAC_PERMISSION_ASSIGNMENT_ERROR user_id={current_user.id} role_id={role_id} error={e}"
        )
        return jsonify({"error": "Failed to assign permission"}), 500

@rbac_bp.route("/roles/<int:role_id>/permissions/<int:permission_id>", methods=["DELETE"])
@jwt_required()
@require_project_isolation
def remove_permission_from_role(role_id, permission_id):
    """Remove a permission from a role"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        from ..services.rbac import rbac_service
        from ..utils.rbac_utils import RBACManager

        if not rbac_service.check_permission(current_user.id, "rbac.view"):
            return jsonify({"error": "Admin access required"}), 403

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role:
            return jsonify({"error": "Role not found"}), 404

        success = rbac_service.remove_permission_from_role(role_id, permission_id)

        if success:
            logging.info(
                f"RBAC_PERMISSION_REMOVED user_id={current_user.id} role_id={role_id} permission_id={permission_id}"
            )
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Permission not assigned to role"}), 404

    except Exception as e:
        logging.error(
            f"RBAC_PERMISSION_REMOVAL_ERROR user_id={current_user.id} role_id={role_id} permission_id={permission_id} error={e}"
        )
        return jsonify({"error": "Failed to remove permission"}), 500

@rbac_bp.route("/roles/<int:role_id>/permissions", methods=["PUT"])
@jwt_required()
@token_required
@require_project_isolation
def update_role_permissions(current_user, role_id):
    """Update role permissions in bulk - replaces all permissions for the role"""
    try:

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role:
            return jsonify({"error": "Role not found"}), 404

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        permission_ids = data.get("permission_ids", [])
        if not isinstance(permission_ids, list):
            return jsonify({"error": "permission_ids must be a list"}), 400

        permissions = Permission.query.filter(
            Permission.id.in_(permission_ids), Permission.project_id == current_user.project_id
        ).all()

        if len(permissions) != len(permission_ids):
            return (
                jsonify({"error": "Some permissions not found or do not belong to this project"}),
                400,
            )

        RolePermission.query.filter_by(role_id=role_id).delete()

        for permission in permissions:
            role_permission = RolePermission(role_id=role_id, permission_id=permission.id)
            db.session.add(role_permission)

        db.session.commit()

        logging.info(
            f"RBAC_ROLE_PERMISSIONS_UPDATED user_id={current_user.id} role_id={role_id} permissions_count={len(permissions)}"
        )

        return jsonify({"success": True, "role_id": role_id, "permissions_count": len(permissions)})

    except Exception as e:
        db.session.rollback()
        logging.error(
            f"RBAC_ROLE_PERMISSIONS_UPDATE_ERROR user_id={current_user.id} role_id={role_id} error={e}"
        )
        return jsonify({"error": "Failed to update role permissions"}), 500

@rbac_bp.route("/roles/<int:role_id>/permissions/detailed", methods=["GET"])
@jwt_required()
@token_required
@require_project_isolation
def get_role_permissions_detailed(current_user, role_id):
    """Get detailed permissions for a role including allow/deny types"""
    try:

        role = Role.query.filter_by(id=role_id, project_id=current_user.project_id).first()
        if not role:
            return jsonify({"error": "Role not found"}), 404

        permissions = rbac_service.get_role_permissions_detailed(role_id)

        return jsonify(
            {
                "success": True,
                "role_id": role_id,
                "role_name": role.name,
                "permissions": permissions,
            }
        )

    except Exception as e:
        logging.error(
            f"RBAC_ROLE_PERMISSIONS_DETAILED_ERROR user_id={current_user.id} role_id={role_id} error={e}"
        )
        return jsonify({"error": "Failed to get role permissions"}), 500

@rbac_bp.route("/users/<int:user_id>/permissions/detailed", methods=["GET"])
@jwt_required()
@token_required
@admin_required
@require_project_isolation
def get_user_permissions_detailed(user_id, current_user):
    """Get detailed permissions for a user including allow/deny types"""

    if not current_user:
        return jsonify({"error": "Authentication required"}), 401

    try:

        target_user = User.query.get(user_id)
        if not target_user or target_user.project_id != current_user.project_id:
            return jsonify({"error": "User not found"}), 404

        user_roles = rbac_service.get_user_roles(user_id)

        all_allow_permissions = []
        all_deny_permissions = []

        for role_data in user_roles:
            role_permissions = rbac_service.get_role_permissions_detailed(role_data["id"])
            all_allow_permissions.extend(role_permissions["allow"])
            all_deny_permissions.extend(role_permissions["deny"])

        allow_set = set()
        deny_set = set()

        for perm in all_allow_permissions:
            allow_set.add(perm["name"])

        for perm in all_deny_permissions:
            deny_set.add(perm["name"])

        final_permissions = allow_set - deny_set

        return jsonify(
            {
                "success": True,
                "user_id": user_id,
                "username": target_user.username,
                "roles": user_roles,
                "permissions": {
                    "allow": list(allow_set),
                    "deny": list(deny_set),
                    "final": list(final_permissions),
                },
            }
        )

    except Exception as e:
        logging.error(
            f"RBAC_USER_PERMISSIONS_DETAILED_ERROR user_id={current_user.id} target_user_id={user_id} error={e}"
        )
        return jsonify({"error": "Failed to get user permissions"}), 500

@rbac_bp.route("/navigation", methods=["GET"])
@jwt_required()
@token_required
def get_navigation_config(current_user):
    """
    Get navigation configuration for the current user based on their role and permissions.

    Returns a list of navigation items that the user has access to, with their permission requirements.
    The frontend will add UI metadata (title, icon) based on the href.

    This centralizes navigation logic on the server, making it easier to maintain and allowing
    for dynamic navigation based on project settings or feature flags.
    """
    try:
        from ..utils.rbac_utils import RBACManager

        if not current_user:
            return jsonify({"error": "Authentication required"}), 401

        user_role = RBACManager.get_user_role_names(current_user)
        primary_role = user_role[0] if user_role else None

        if primary_role == "owner":
            navigation_items = [
                {
                    "href": "/owner-dashboard",
                    "roles": ["owner"]
                },
                {
                    "href": "/projects",
                    "roles": ["owner"]
                },
                {
                    "href": "/servers",
                    "roles": ["owner"]
                },
                {
                    "href": "/logs",
                    "roles": ["owner"]
                }
            ]
        else:

            navigation_items = [
                {
                    "href": "/dashboard",
                    "permission": "analytics.view"
                },
                {
                    "href": "/projects",
                    "roles": ["owner"]
                },
                {
                    "href": "/servers",
                    "roles": ["owner"]
                },
                {
                    "href": "/management-page",
                    "permissionPrefixes": ["keys.", "files.", "products.", "agents."]
                },
                {
                    "href": "/users-management",
                    "permissionPrefixes": ["employees.", "clients."]
                },
                {
                    "href": "/remote-control",
                    "permissionPrefix": "remote_control."
                },
                {
                    "href": "/security",
                    "permissionPrefix": "security."
                },
                {
                    "href": "/webhooks",
                    "permissionPrefix": "webhooks."
                },
                {
                    "href": "/logs",
                    "permissionPrefix": "logs."
                }
            ]

        return jsonify({
            "success": True,
            "navigation": navigation_items,
            "role": primary_role
        })

    except Exception as e:
        logging.error(
            f"RBAC_NAVIGATION_ERROR user_id={current_user.id if current_user else 'unknown'} error={e}"
        )
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to get navigation configuration"}), 500
