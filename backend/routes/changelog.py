import json
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..models.core import User
from ..models.products import ChangelogEntry, Product
from ..models.keys import Key
from ..models.agents import Agent, AgentChangelog
from ..services.activity import activity_service
from ..utils.fulltext_search import fulltext_search_filter
from ..utils.rbac_utils import RBACManager
from ..routes.agents import find_agent_by_id_or_unique_id

changelog_bp = Blueprint("changelog", __name__)

def find_product_by_id_or_unique_id(product_identifier, project_id):
    """
    Helper function to find a product by id (int), unique_id (string), or name (string)
    
    Args:
        product_identifier: Either an integer id, string unique_id, or product name
        project_id: Project ID to filter by
    
    Returns:
        Product object or None if not found
    """
    logger = logging.getLogger(__name__)
    
    # Try as integer id (primary key) first
    if isinstance(product_identifier, int) or (isinstance(product_identifier, str) and product_identifier.isdigit()):
        try:
            product_id_int = int(product_identifier)
            product = Product.query.filter_by(id=product_id_int, project_id=project_id).first()
            if product:
                return product
            else:
                # Log for debugging - check if product exists in different project
                product_any_project = Product.query.filter_by(id=product_id_int).first()
                if product_any_project:
                    logger.warning(
                        f"Product {product_id_int} exists but belongs to project {product_any_project.project_id}, "
                        f"not the requested project {project_id}"
                    )
                else:
                    logger.debug(f"Product {product_id_int} not found in any project")
        except (ValueError, TypeError) as e:
            logger.debug(f"Error converting product_identifier to int: {e}")
            pass
    
    # Try as unique_id (string)
    product = Product.query.filter_by(unique_id=str(product_identifier), project_id=project_id).first()
    if product:
        return product
    
    # Try as name (string) as fallback
    product = Product.query.filter_by(name=str(product_identifier), project_id=project_id).first()
    return product

@changelog_bp.route("/products/<product_identifier>/changelog", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_product_changelog(product_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Product not found: identifier={product_identifier}, "
                f"project_id={user.project_id}, user_id={user_id}"
            )
            return jsonify({"error": "Product not found"}), 404

        entries = (
            ChangelogEntry.query.filter_by(
                product_id=product.id, project_id=user.project_id, is_public=True
            )
            .order_by(ChangelogEntry.release_date.desc())
            .all()
        )

        changelog_data = []
        for entry in entries:
            changelog_data.append(
                {
                    "id": entry.id,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "release_date": entry.release_date.isoformat() if entry.release_date else None,
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                }
            )

        return jsonify(
            {
                "success": True,
                "product_id": product.id,
                "product_name": product.name,
                "changelog": changelog_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch changelog: {str(e)}"}), 500

@changelog_bp.route("/products/<product_identifier>/changelog", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_changelog_entry(product_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    can_manage_changelog = rbac_service.check_permission(
        user.id, "products.manage_changelog"
    ) or rbac_service.check_permission(user.id, "agents.manage_changelog")
    if not can_manage_changelog:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        data = request.get_json()

        version = data.get("version")
        title = data.get("title")
        changes = data.get("changes", [])

        if not version or not title:
            return jsonify({"error": "Version and title are required"}), 400

        existing_entry = ChangelogEntry.query.filter_by(
            product_id=product.id, version=version, project_id=user.project_id
        ).first()

        if existing_entry:
            return jsonify({"error": "Version already exists for this product"}), 400

        changelog_entry = ChangelogEntry(
            product_id=product.id,
            version=version,
            title=title,
            description=data.get("description"),
            changes=json.dumps(changes) if changes else "[]",
            release_date=(
                datetime.fromisoformat(data["release_date"])
                if data.get("release_date")
                else datetime.utcnow()
            ),
            is_public=True,
            created_by=user_id,
            project_id=user.project_id,
        )

        db.session.add(changelog_entry)

        product.version = version
        product.updated_at = datetime.utcnow()

        db.session.commit()

        activity_service.log_activity(
            user,
            "create_changelog_entry",
            details=f"Created changelog entry {version} for product: {product.id}",
            ip=request.remote_addr,
        )

        return (
            jsonify(
                {
                    "success": True,
                    "message": "Changelog entry created successfully",
                    "entry": {
                        "id": changelog_entry.id,
                        "version": changelog_entry.version,
                        "title": changelog_entry.title,
                        "description": changelog_entry.description,
                        "changes": changelog_entry.changes_list,
                        "release_date": changelog_entry.release_date.isoformat(),
                        "is_public": changelog_entry.is_public,
                    },
                }
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create changelog entry: {str(e)}"}), 500

@changelog_bp.route("/changelog/<int:entry_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_changelog_entry(entry_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    can_manage_changelog = rbac_service.check_permission(
        user.id, "products.manage_changelog"
    ) or rbac_service.check_permission(user.id, "agents.manage_changelog")
    if not can_manage_changelog:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        entry = ChangelogEntry.query.filter_by(id=entry_id, project_id=user.project_id).first()
        is_agent_entry = False
        
        if not entry:
            agent_entry = AgentChangelog.query.filter_by(id=entry_id, project_id=user.project_id).first()
            if agent_entry:
                entry = agent_entry
                is_agent_entry = True

        if not entry:
            return jsonify({"error": "Changelog entry not found"}), 404

        data = request.get_json()

        if "title" in data:
            entry.title = data["title"]
        if "description" in data:
            entry.description = data["description"]
        if "changes" in data:
            entry.changes = json.dumps(data["changes"]) if data["changes"] else "[]"
        if "release_date" in data and data["release_date"]:
            entry.release_date = datetime.fromisoformat(data["release_date"])
        
        # Handle agent-specific fields
        if is_agent_entry:
            agent_entry = entry  # entry is AgentChangelog at this point
            if "change_type" in data:
                agent_entry.change_type = data["change_type"]
            if "custom_type_name" in data:
                agent_entry.custom_type_name = data.get("custom_type_name")

        db.session.commit()

        # Get the appropriate ID for logging
        if is_agent_entry:
            entity_id = getattr(entry, 'agent_id', None)
            entity_type = "agent"
        else:
            entity_id = getattr(entry, 'product_id', None)
            entity_type = "product"
        
        activity_service.log_activity(
            user,
            "update_changelog_entry",
            details=f"Updated changelog entry {entry.version} for {entity_type}: {entity_id}",
            ip=request.remote_addr,
        )

        response_data = {
            "success": True,
            "message": "Changelog entry updated successfully",
            "entry": {
                "id": entry.id,
                "version": entry.version,
                "title": entry.title,
                "description": entry.description,
                "changes": entry.changes_list,
                "release_date": entry.release_date.isoformat(),
                "is_public": entry.is_public,
            },
        }
        
        # Add agent-specific fields to response
        if is_agent_entry:
            agent_entry = entry  # entry is AgentChangelog at this point
            response_data["entry"]["change_type"] = agent_entry.change_type
            response_data["entry"]["custom_type_name"] = agent_entry.custom_type_name

        return jsonify(response_data)

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to update changelog entry: {str(e)}"}), 500

@changelog_bp.route("/changelog/<int:entry_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_changelog_entry(entry_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    can_manage_changelog = rbac_service.check_permission(
        user.id, "products.manage_changelog"
    ) or rbac_service.check_permission(user.id, "agents.manage_changelog")
    if not can_manage_changelog:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        entry = ChangelogEntry.query.filter_by(id=entry_id, project_id=user.project_id).first()

        if not entry:
            return jsonify({"error": "Changelog entry not found"}), 404

        product_name = entry.product.name
        version = entry.version

        db.session.delete(entry)
        db.session.commit()

        activity_service.log_activity(
            user,
            "delete_changelog_entry",
            details=f"Deleted changelog entry {version} for product: {entry.product_id}",
            ip=request.remote_addr,
        )

        return jsonify({"success": True, "message": "Changelog entry deleted successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to delete changelog entry: {str(e)}"}), 500

@changelog_bp.route("/changelog/<int:entry_id>", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_changelog_entry(entry_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        entry = ChangelogEntry.query.filter_by(id=entry_id, project_id=user.project_id).first()

        if not entry:
            return jsonify({"error": "Changelog entry not found"}), 404

        return jsonify(
            {
                "success": True,
                "entry": {
                    "id": entry.id,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "release_date": entry.release_date.isoformat() if entry.release_date else None,
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                    "product_id": entry.product_id,
                },
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch changelog entry: {str(e)}"}), 500

@changelog_bp.route("/products/<product_identifier>/changelog/latest", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_latest_changelog(product_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.project_id:
        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        product = find_product_by_id_or_unique_id(product_identifier, user.project_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        latest_entry = (
            ChangelogEntry.query.filter_by(
                product_id=product.id, project_id=user.project_id, is_public=True
            )
            .order_by(ChangelogEntry.release_date.desc())
            .first()
        )

        if not latest_entry:
            return jsonify(
                {
                    "success": True,
                    "product_id": product.id,
                    "product_name": product.name,
                    "latest_changelog": None,
                }
            )

        return jsonify(
            {
                "success": True,
                "product_id": product.id,
                "product_name": product.name,
                "latest_changelog": {
                    "id": latest_entry.id,
                    "version": latest_entry.version,
                    "title": latest_entry.title,
                    "description": latest_entry.description,
                    "changes": latest_entry.changes_list,
                    "release_date": latest_entry.release_date.isoformat(),
                    "is_public": latest_entry.is_public,
                },
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch latest changelog: {str(e)}"}), 500

@changelog_bp.route("/changelog/search", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def search_changelog():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        query = request.args.get("q", "")
        product_id = request.args.get("product_id", type=int)
        version = request.args.get("version", "")

        search_query = ChangelogEntry.query.filter_by(project_id=user.project_id, is_public=True)

        if product_id:
            search_query = search_query.filter_by(product_id=product_id)

        if version:

            search_query = fulltext_search_filter(search_query, version, "search_vector")

        if query:

            search_query = fulltext_search_filter(search_query, query, "search_vector")

        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)

        pagination = search_query.order_by(ChangelogEntry.release_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        results = []
        for entry in pagination.items:
            results.append(
                {
                    "id": entry.id,
                    "product_id": entry.product_id,
                    "product_name": entry.product.name,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "release_date": entry.release_date.isoformat(),
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                }
            )

        return jsonify(
            {
                "success": True,
                "results": results,
                "total": pagination.total,
                "pages": pagination.pages,
                "current_page": page,
                "per_page": per_page,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to search changelog: {str(e)}"}), 500

@changelog_bp.route("/agents/<agent_identifier>/changelog", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_loader_changelog(agent_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        agent = find_agent_by_id_or_unique_id(agent_identifier, user.project_id)
        if not agent:
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Agent not found: identifier={agent_identifier}, "
                f"project_id={user.project_id}, user_id={user_id}"
            )
            return jsonify({"error": "Agent not found"}), 404

        entries = (
            AgentChangelog.query.filter_by(
                agent_id=agent.id, project_id=user.project_id, is_public=True
            )
            .order_by(AgentChangelog.release_date.desc())
            .all()
        )

        changelog_data = []
        for entry in entries:
            changelog_data.append(
                {
                    "id": entry.id,
                    "version": entry.version,
                    "title": entry.title,
                    "description": entry.description,
                    "changes": entry.changes_list,
                    "change_type": entry.change_type,
                    "custom_type_name": entry.custom_type_name,
                    "release_date": entry.release_date.isoformat() if entry.release_date else None,
                    "is_public": entry.is_public,
                    "created_by": entry.created_by,
                }
            )

        return jsonify(
            {
                "success": True,
                "agent_id": agent.id,
                "agent_name": agent.name,
                "changelog": changelog_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch changelog: {str(e)}"}), 500

@changelog_bp.route("/agents/<agent_identifier>/changelog", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_loader_changelog_entry(agent_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    from ..services.rbac import rbac_service

    can_manage_changelog = rbac_service.check_permission(
        user.id, "products.manage_changelog"
    ) or rbac_service.check_permission(user.id, "agents.manage_changelog")
    if not can_manage_changelog:
        return jsonify({"error": "Insufficient permissions"}), 403

    try:
        agent = find_agent_by_id_or_unique_id(agent_identifier, user.project_id)
        if not agent:
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Agent not found: identifier={agent_identifier}, "
                f"project_id={user.project_id}, user_id={user_id}"
            )
            return jsonify({"error": "Agent not found"}), 404

        data = request.get_json()

        version = data.get("version")
        title = data.get("title")
        changes = data.get("changes", [])
        change_type = data.get("change_type", "release")
        custom_type_name = data.get("custom_type_name")

        if not version or not title:
            return jsonify({"error": "Version and title are required"}), 400

        existing_entry = AgentChangelog.query.filter_by(
            agent_id=agent.id, version=version, project_id=user.project_id
        ).first()

        if existing_entry:
            return jsonify({"error": "Version already exists for this agent"}), 400

        new_entry = AgentChangelog(
            agent_id=agent.id,
            version=version,
            title=title,
            description=data.get("description"),
            changes=json.dumps(changes),
            change_type=change_type,
            custom_type_name=custom_type_name,
            release_date=(
                datetime.fromisoformat(data.get("release_date"))
                if data.get("release_date")
                else datetime.utcnow()
            ),
            is_public=True,
            created_by=user.id,
            project_id=user.project_id,
        )

        db.session.add(new_entry)
        db.session.commit()

        agent.version = version
        agent.changelog = title
        agent.updated_at = datetime.utcnow()
        db.session.commit()

        activity_service.log_activity(
            user,
            "loader_changelog_created",
            details=f"Created changelog entry v{version} for agent: {agent.id}",
        )

        return jsonify(
            {
                "success": True,
                "message": "Changelog entry created successfully",
                "entry": {
                    "id": new_entry.id,
                    "version": new_entry.version,
                    "title": new_entry.title,
                    "change_type": new_entry.change_type,
                },
            }
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to create changelog entry: {str(e)}"}), 500

@changelog_bp.route("/agents/<agent_identifier>/changelog/latest", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_latest_loader_changelog(agent_identifier):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:

        return jsonify({"error": "User not found"}), 404

    if not user.project_id:

        return jsonify({"error": "User must be assigned to a project"}), 403

    if not user.project_id:
        return jsonify({"error": "No project associated"}), 400

    try:
        agent = find_agent_by_id_or_unique_id(agent_identifier, user.project_id)
        if not agent:
            logger = logging.getLogger(__name__)
            logger.warning(
                f"Agent not found: identifier={agent_identifier}, "
                f"project_id={user.project_id}, user_id={user_id}"
            )
            return jsonify({"error": "Agent not found"}), 404

        latest_entry = (
            AgentChangelog.query.filter_by(
                agent_id=agent.id, project_id=user.project_id, is_public=True
            )
            .order_by(AgentChangelog.release_date.desc())
            .first()
        )

        if not latest_entry:
            return jsonify(
                {
                    "success": True,
                    "agent_id": agent.id,
                    "agent_name": agent.name,
                    "latest_changelog": None,
                    "message": "No changelog entries found",
                }
            )

        changelog_data = {
            "id": latest_entry.id,
            "version": latest_entry.version,
            "title": latest_entry.title,
            "description": latest_entry.description,
            "changes": latest_entry.changes_list,
            "change_type": latest_entry.change_type,
            "custom_type_name": latest_entry.custom_type_name,
            "release_date": (
                latest_entry.release_date.isoformat() if latest_entry.release_date else None
            ),
            "is_public": latest_entry.is_public,
        }

        return jsonify(
            {
                "success": True,
                "agent_id": agent.id,
                "agent_name": agent.name,
                "latest_changelog": changelog_data,
            }
        )

    except Exception as e:
        return jsonify({"error": f"Failed to fetch latest changelog: {str(e)}"}), 500
