"""
User Referral Codes Routes
Handles referral code management
"""

import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import desc

from ...core.extensions import db
from ...middleware.auth import enforce_project_scope, require_role, require_user
from ...middleware.validation import validate_request
from ...models import ReferralCode, User
from ...models.rbac import Role
from ...schemas.referral import ReferralCodeCreateSchema
from ...utils.service_helpers import get_service
from ...utils.role_constants import RolePermissions, UserRoles

referral_codes_bp = Blueprint("users_referral_codes", __name__)
logger = logging.getLogger(__name__)

@referral_codes_bp.route("/refcodes", methods=["GET"])
@jwt_required()
@require_user
@enforce_project_scope
@require_role(RolePermissions.ADMIN_ROLES)
def get_refcodes(current_user, project_id=None):
    """Get referral codes for admin users"""
    try:

        if project_id is None:
            project_id = current_user.project_id

        if not project_id:
            return jsonify({"error": "Project ID is required"}), 400

        referral_codes = (
            ReferralCode.query.filter_by(project_id=project_id)
            .order_by(desc(ReferralCode.created_at))
            .all()
        )

        # Get all role IDs from all referral codes for batch query
        all_role_ids = set()
        for code in referral_codes:
            if code.rbac_role_ids:
                if isinstance(code.rbac_role_ids, list):
                    all_role_ids.update(code.rbac_role_ids)
        
        # Batch fetch all roles
        roles_dict = {}
        if all_role_ids and project_id:
            roles = Role.query.filter(
                Role.id.in_(list(all_role_ids)),
                Role.project_id == project_id
            ).all()
            roles_dict = {
                role.id: {
                    "id": role.id,
                    "name": role.name,
                    "description": role.description,
                    "is_system_role": role.is_system_role,
                }
                for role in roles
            }
        
        codes_data = []
        for code in referral_codes:
            rbac_role_ids = code.rbac_role_ids if code.rbac_role_ids else []
            # Get role information for this code's rbac_role_ids
            roles = []
            if rbac_role_ids:
                if isinstance(rbac_role_ids, list):
                    roles = [roles_dict[role_id] for role_id in rbac_role_ids if role_id in roles_dict]
            
            # Compute is_expired based on expires_at
            is_expired = False
            if code.expires_at and code.expires_at < datetime.utcnow():
                is_expired = True
            
            # Get role names as comma-separated string for backward compatibility
            role_names = ", ".join([role["name"] for role in roles]) if roles else None
            
            codes_data.append(
                {
                    "id": code.id,
                    "code": code.code,
                    "expires_at": code.expires_at.isoformat() if code.expires_at else None,
                    "used": code.used,
                    "is_expired": is_expired,
                    "used_by": code.used_by,
                    "product_ids": code.product_ids_list,
                    "rbac_role_ids": rbac_role_ids,
                    "roles": roles,
                    "role": role_names,
                    "token_balance": code.token_balance,
                    "work_duration_days": code.work_duration_days,
                    "project_id": code.project_id,
                    "created_by": code.created_by,
                    "created_at": code.created_at.isoformat() if code.created_at else None,
                }
            )

        return jsonify(codes_data)

    except Exception as e:
        logger.error(f"Error getting referral codes: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to get referral codes"}), 500

@referral_codes_bp.route("/refcodes", methods=["POST"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
def create_refcode(current_user, project_id=None):
    """Create a new referral code"""
    try:

        if project_id is None:
            project_id = current_user.project_id

        if not project_id:
            return jsonify({"error": "Project ID is required"}), 400

        # Note: This endpoint will be migrated to use validate_request in next iteration
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        try:
            schema_data = ReferralCodeCreateSchema(**data)
            code = schema_data.code.strip() if schema_data.code else None
            token_balance = schema_data.token_balance
            work_duration_days = schema_data.work_duration_days
            product_ids = schema_data.product_ids
            rbac_role_ids = schema_data.rbac_role_ids
            expires_days = schema_data.expires_days or schema_data.expires_in_days or 90
        except Exception as e:
            return jsonify({"error": f"Validation error: {str(e)}"}), 400

        from datetime import datetime, timedelta
        import secrets
        import string

        # Generate code if not provided
        if not code:
            def generate_code():
                return "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))

            code = generate_code()
            while ReferralCode.query.filter_by(code=code).first():
                code = generate_code()
        else:
            # Check if code already exists
            existing_code = ReferralCode.query.filter_by(code=code).first()
            if existing_code:
                return jsonify({"error": "Referral code already exists"}), 400

        referral_code = ReferralCode(
            code=code,
            project_id=project_id,
            token_balance=token_balance,
            work_duration_days=work_duration_days,
            expires_at=datetime.utcnow() + timedelta(days=expires_days),
            product_ids=product_ids if product_ids else None,
            rbac_role_ids=rbac_role_ids if rbac_role_ids else None,
            created_by=current_user.id,
        )

        db.session.add(referral_code)
        db.session.commit()

        activity_service = get_service('activity_service')
        activity_service.log_activity(
            current_user,
            "create_referral_code",
            details=f"Created referral code: {code}",
            ip=request.remote_addr,
        )

        return jsonify(
            {
                "message": "Referral code created successfully",
                "code": {
                    "id": referral_code.id,
                    "code": referral_code.code,
                    "token_balance": referral_code.token_balance,
                    "work_duration_days": referral_code.work_duration_days,
                    "expires_at": referral_code.expires_at.isoformat() if referral_code.expires_at else None,
                    "product_ids": referral_code.product_ids_list,
                    "rbac_role_ids": referral_code.rbac_role_ids if referral_code.rbac_role_ids else [],
                    "project_id": referral_code.project_id,
                    "created_by": referral_code.created_by,
                    "created_at": referral_code.created_at.isoformat() if referral_code.created_at else None,
                },
            }
        ), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating referral code: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to create referral code"}), 500

@referral_codes_bp.route("/refcodes/<int:code_id>", methods=["DELETE"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
def delete_refcode(code_id, current_user, project_id=None):
    """Delete a referral code"""
    try:

        if project_id is None:
            project_id = current_user.project_id

        referral_code = ReferralCode.query.get(code_id)
        if not referral_code:
            return jsonify({"error": "Referral code not found"}), 404

        if not project_id or referral_code.project_id != project_id:

            from ...services.rbac import rbac_service

            can_view_all = rbac_service.check_permission(
                current_user.id, "employees.view"
            ) or rbac_service.check_permission(current_user.id, "clients.view")
            if not can_view_all:
                return jsonify({"error": "Access denied"}), 403

        code_value = referral_code.code
        db.session.delete(referral_code)
        db.session.commit()

        activity_service = get_service('activity_service')
        activity_service.log_activity(
            current_user,
            "delete_referral_code",
            details=f"Deleted referral code: {code_value}",
            ip=request.remote_addr,
        )

        return jsonify({"message": "Referral code deleted successfully"})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting referral code: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to delete referral code"}), 500

@referral_codes_bp.route("/refcodes/delete-unused", methods=["DELETE"])
@jwt_required()
@require_user
@require_role(RolePermissions.ADMIN_ROLES)
def delete_unused_refcodes(current_user, project_id=None):
    """Delete all unused referral codes"""
    try:

        if project_id is None:
            project_id = current_user.project_id

        if not project_id:
            return jsonify({"error": "Project ID is required"}), 400

        from datetime import datetime

        unused_codes = ReferralCode.query.filter(
            ReferralCode.project_id == project_id,
            ReferralCode.used == False,
            ReferralCode.expires_at < datetime.utcnow(),
        ).all()

        deleted_count = len(unused_codes)

        for code in unused_codes:
            db.session.delete(code)

        db.session.commit()

        activity_service = get_service('activity_service')
        activity_service.log_activity(
            current_user,
            "delete_unused_referral_codes",
            details=f"Deleted {deleted_count} unused referral codes",
            ip=request.remote_addr,
        )

        return jsonify(
            {"message": f"Deleted {deleted_count} unused referral codes", "deleted_count": deleted_count}
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting unused referral codes: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to delete unused referral codes"}), 500
