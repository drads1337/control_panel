import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..utils.service_helpers import get_service
from ..middleware.auth import (
    enforce_project_scope,
    require_auth,
    require_owner,
    require_project_isolation,
    require_project_with_grace_period,
)
from ..middleware.validation import validate_request
from ..models.core import Project, User
from ..schemas.project import (
    ProjectCreateSchema,
    ProjectUpdateSchema,
    ProjectInviteCodeCreateSchema,
)
from ..utils.rbac_utils import RBACManager
from ..utils.role_constants import UserRoles

projects_bp = Blueprint("projects", __name__)

@projects_bp.route("/projects", methods=["GET"])
@jwt_required()
@enforce_project_scope
def get_projects():
    """
    Get list of projects with caching (N+1 problem fixed)
    """
    try:


        cache_service = get_service('cache_service')
        project_service = get_service('project_service')
        if not db.session.is_active:
            db.session.rollback()

        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        is_owner = RBACManager.is_owner(user)

        logging.info(
            f"get_projects route - user_id: {user_id}, "
            f"username: {user.username}, "
            f"is_owner: {is_owner}, "
            f"user.project_id: {user.project_id}"
        )


        if user.project_id:
            project_exists = Project.query.get(user.project_id)
            if not project_exists:
                logging.warning(
                    f"User {user_id} has project_id {user.project_id} but project doesn't exist. Clearing project_id."
                )
                user.project_id = None
                db.session.commit()

        if not is_owner and not user.project_id:
            logging.warning(
                f"Access denied - user {user_id} is not owner and has no project_id"
            )
            return jsonify({"error": "User must be assigned to a project"}), 403

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        search = request.args.get("search")
        force_refresh = request.args.get("force_refresh", "false").lower() == "true"

        logging.info(
            f"get_projects route - Request params: page={page}, per_page={per_page}, "
            f"search={search}, force_refresh={force_refresh}"
        )

        total_projects_in_db = Project.query.count()
        logging.info(f"DEBUG: Total projects in database: {total_projects_in_db}")
        if total_projects_in_db > 0:
            all_project_ids = [p.id for p in Project.query.all()]
            logging.info(f"DEBUG: All project IDs in database: {all_project_ids}")


        if force_refresh:
            try:
                cache_service.invalidate_pattern("projects:*")
                logging.info("Cache invalidated due to force_refresh parameter")
            except Exception as e:
                logging.warning(f"Failed to invalidate cache: {e}")

        logging.info(f"Calling project_service.get_projects_cached for user_id={user_id}")
        result = project_service.get_projects_cached(
            user_id=user_id, page=page, per_page=per_page, search=search
        )

        logging.info(
            f"get_projects result - projects count: {len(result.get('projects', []))}, "
            f"total: {result.get('total', 0)}, "
            f"pages: {result.get('pages', 0)}, "
            f"current_page: {result.get('current_page', 0)}, "
            f"has_error: {'error' in result}, "
            f"result_keys: {list(result.keys())}"
        )

        if result.get('projects'):
            project_ids = [p.get('id') for p in result.get('projects', [])]
            logging.info(f"DEBUG: Returning project IDs: {project_ids}")
        else:
            logging.warning(f"DEBUG: No projects in result! Result: {result}")

        if "error" in result:
            logging.error(f"Error in result: {result.get('error')}")
            return jsonify(result), 500

        response_data = jsonify(result)
        logging.info(f"Returning response with {len(result.get('projects', []))} projects")
        return response_data

    except Exception as e:
        try:
            db.session.rollback()
        except:
            pass

        logging.error(f"Error in get_projects: {str(e)}")
        import traceback

        logging.error(f"Traceback: {traceback.format_exc()}")

        return (
            jsonify(
                {
                    "error": "Failed to retrieve projects",
                    "code": "PROJECTS_RETRIEVAL_ERROR",
                    "message": str(e),
                }
            ),
            500,
        )

@projects_bp.route("/projects", methods=["POST"])
@jwt_required()
@require_auth
@require_owner
@validate_request(ProjectCreateSchema)
def create_project(current_user, validated_data=None):
    """Create a new project"""
    logging.debug("=== FRONTEND CREATE PROJECT CALLED ===")
    logging.debug(f"Request data: {validated_data}")



    project_service = get_service('project_service')
    try:
        user = current_user

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        data = ProjectCreateSchema(**validated_data)
        name = data.name.strip()
        description = data.description.strip() if data.description else ""


        project = project_service.create_project(
            user_id=user.id,
            name=name,
            description=description,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent", ""),
        )

        return jsonify({
            "message": "Project created successfully",
            "project": {
                "id": project.unique_id,
                "name": project.name,
                "description": project.description,
                "created_at": project.created_at.isoformat(),
            },
        }), 201

    except Exception as e:
        logging.error(f"Error creating project: {str(e)}")
        return jsonify({"error": "Failed to create project"}), 500

@projects_bp.route("/projects/<int:project_id>", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
def get_project(project_id):
    """Get information about a specific project with caching"""
    try:


        project_service = get_service('project_service')
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        logging.info(
            f"GET /projects/{project_id} - user_id: {user_id}, user: {user.username if user else 'None'}, user.project_id: {user.project_id if user else 'None'}"
        )

        if not user:
            return jsonify({"error": "Access denied"}), 403

        result = project_service.get_project_cached(project_id=project_id, user_id=user_id)

        logging.info(f"Project service result: {result}")

        if "error" in result:
            if "Access denied" in result["error"]:
                return jsonify(result), 403
            elif "not found" in result["error"]:
                return jsonify(result), 404
            else:
                return jsonify(result), 500

        return jsonify(result)

    except Exception as e:
        logging.error(f"Error getting project {project_id}: {str(e)}")
        import traceback

        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Failed to retrieve project"}), 500

@projects_bp.route("/projects/<project_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@enforce_project_scope
@validate_request(ProjectUpdateSchema)
def update_project(project_id, validated_data=None):
    """Update project information"""
    try:


        project_service = get_service('project_service')
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            logging.warning(f"Update project {project_id}: User {user_id} not found")
            return jsonify({"error": "Access denied"}), 403

        if not validated_data:
            return jsonify({"error": "No data provided"}), 400

        data = ProjectUpdateSchema(**validated_data)
        update_data = data.model_dump(exclude_none=True)

        result = project_service.update_project(
            project_id=project_id,
            user_id=user_id,
            name=update_data.get("name"),
            description=update_data.get("description"),
            status=update_data.get("status"),
            subscription_status=update_data.get("subscription_status"),
            storage_limit_gb=update_data.get("storage_limit_gb"),
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent", ""),
        )

        if "error" in result:
            status_code = 403 if result["error"] == "Access denied" else (
                404 if result["error"] == "Project not found" else 400
            )
            return jsonify(result), status_code

        return jsonify(result)

    except Exception as e:
        import traceback
        logging.error(f"Error updating project {project_id}: {str(e)}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "error": "Failed to update project",
            "message": str(e)
        }), 500

@projects_bp.route("/projects/<project_id>", methods=["DELETE"])
@jwt_required()
@require_auth
@require_owner
def delete_project(project_id, current_user):
    """Delete project and all related data"""
    try:


        project_service = get_service('project_service')
        user = current_user

        result = project_service.delete_project(
            project_id=project_id,
            user_id=user.id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent", ""),
        )

        if "error" in result:
            status_code = 404 if result["error"] == "Project not found" else 500
            return jsonify(result), status_code

        return jsonify(result)

    except Exception as e:
        logging.error(f"Error deleting project {project_id}: {str(e)}")
        return jsonify({"error": "Failed to delete project"}), 500

@projects_bp.route("/projects/<int:project_id>/stats", methods=["GET"])
@jwt_required()
@require_owner
@enforce_project_scope
def get_project_stats(project_id):
    """Get project statistics with caching"""
    try:


        project_service = get_service('project_service')
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "Access denied"}), 403

        result = project_service.get_project_stats_cached(project_id=project_id, user_id=user_id)

        if "error" in result:
            if "Access denied" in result["error"]:
                return jsonify(result), 403
            elif "not found" in result["error"]:
                return jsonify(result), 404
            else:
                return jsonify(result), 500

        return jsonify(result)

    except Exception as e:
        logging.error(f"Error getting project stats {project_id}: {str(e)}")
        return jsonify({"error": "Failed to retrieve project statistics"}), 500

@projects_bp.route("/project-codes", methods=["GET"])
@jwt_required()
@require_owner
def get_project_invite_codes(current_user):
    """Get all project invite codes for the current user's project"""
    try:


        project_service = get_service('project_service')
        result = project_service.get_project_invite_codes(user_id=current_user.id)

        if "error" in result:

            error_message = result.get("error", "")
            if "must be assigned to a project" in error_message or "User not found" in error_message:
                return jsonify(result), 400
            return jsonify(result), 500

        return jsonify(result.get("codes", []))

    except Exception as e:
        logging.error(f"Error getting project invite codes: {str(e)}")
        return jsonify({"error": "Failed to retrieve project invite codes"}), 500

@projects_bp.route("/project-codes/latest", methods=["GET"])
@jwt_required()
@require_owner
def get_latest_project_invite_code(current_user):
    """Get the latest project invite code for the current user's project"""
    try:


        project_service = get_service('project_service')
        result = project_service.get_latest_project_invite_code(user_id=current_user.id)

        if "error" in result:

            error_message = result.get("error", "")
            if "must be assigned to a project" in error_message or "User not found" in error_message:
                return jsonify(result), 400
            return jsonify(result), 500

        return jsonify(result)

    except Exception as e:
        logging.error(f"Error getting latest project invite code: {str(e)}")
        return jsonify({"error": "Failed to retrieve latest project invite code"}), 500

@projects_bp.route("/project-codes", methods=["POST"])
@jwt_required()
@require_owner
@validate_request(ProjectInviteCodeCreateSchema)
def create_project_invite_code(current_user, validated_data=None):
    """Create a new project invite code"""
    try:


        project_service = get_service('project_service')
        if not validated_data:
            validated_data = {}

        data = ProjectInviteCodeCreateSchema(**validated_data)
        expires_in_days = data.expires_in_days

        result = project_service.create_project_invite_code(
            user_id=current_user.id,
            expires_in_days=expires_in_days,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent", ""),
        )

        if "error" in result:

            error_message = result.get("error", "")
            if "must be assigned to a project" in error_message or "User not found" in error_message:
                return jsonify(result), 400
            return jsonify(result), 500

        return jsonify(result), 201

    except Exception as e:
        logging.error(f"Error creating project invite code: {str(e)}")
        return jsonify({"error": "Failed to create project invite code"}), 500

@projects_bp.route("/project-codes/<int:code_id>", methods=["DELETE"])
@jwt_required()
@require_owner
def delete_project_invite_code(code_id, current_user):
    """Delete a project invite code"""
    try:


        project_service = get_service('project_service')
        result = project_service.delete_project_invite_code(
            code_id=code_id,
            user_id=current_user.id,
            ip_address=request.remote_addr,
            user_agent=request.headers.get("User-Agent", ""),
        )

        if "error" in result:
            status_code = 404 if result["error"] == "Invite code not found" else (
                400 if result["error"] == "Cannot delete used invite code" else 500
            )
            return jsonify(result), status_code

        return jsonify(result)

    except Exception as e:
        logging.error(f"Error deleting project invite code: {str(e)}")
        return jsonify({"error": "Failed to delete project invite code"}), 500
