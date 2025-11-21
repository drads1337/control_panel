import json
import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.utils import secure_filename

from ..core.extensions import db
from ..middleware.auth import require_project_isolation, require_project_with_grace_period
from ..models.core import User
from ..models.products import Product
from ..models.agents import Agent, AgentProductAssignment
from ..config.config import Config

agents_bp = Blueprint("agents", __name__)

ALLOWED_EXTENSIONS = Config.ALLOWED_LOADER_EXTENSIONS

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@agents_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_loaders():
    """Get all agents with their assigned products (supports both /api/agents and /api/agents)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        agents = Agent.query.filter_by(project_id=user.project_id).all()
        result = []

        for agent in agents:
            uploads_dir = os.path.join(current_app.root_path, "uploads", "products")

            file_path = None
            if agent.file and agent.file != "0" and agent.file != "":
                file_path = os.path.join(uploads_dir, agent.file)
                if not os.path.exists(file_path):
                    file_path = None

            logo_path = None
            if agent.logo and agent.logo != "0" and agent.logo != "":
                logo_path = os.path.join(uploads_dir, agent.logo)
                if not os.path.exists(logo_path):
                    logo_path = None

            banner_path = None
            if agent.banner and agent.banner != "0" and agent.banner != "":
                banner_path = os.path.join(uploads_dir, agent.banner)
                if not os.path.exists(banner_path):
                    banner_path = None

            background_path = None
            if agent.background and agent.background != "0" and agent.background != "":
                background_path = os.path.join(uploads_dir, agent.background)
                if not os.path.exists(background_path):
                    background_path = None

            agent_data = {
                "id": agent.unique_id,
                "name": agent.name,
                "description": agent.description,
                "status": agent.status,
                "logo": agent.logo if logo_path else None,
                "banner": agent.banner if banner_path else None,
                "background": agent.background if background_path else None,
                "file": agent.file if file_path else None,
                "changelog": agent.changelog,
                "notifications": agent.notifications,
                "version": agent.version,
                "downloads": agent.downloads,
                "active_users": agent.active_users,
                "last_update": agent.updated_at.isoformat() if agent.updated_at else None,
                "created_at": agent.created_at.isoformat() if agent.created_at else None,
                "updated_at": agent.updated_at.isoformat() if agent.updated_at else None,
            }

            assignments = AgentProductAssignment.query.filter_by(agent_id=agent.id).all()
            agent_data["assigned_products"] = [assignment.product_id for assignment in assignments]

            result.append(agent_data)

        return jsonify({
            "agents": result,
            "success": True
        })
    except Exception as e:
        current_app.logger.error(f"Error getting agents: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to get agents: {str(e)}", "success": False}), 500

@agents_bp.route("/available-products", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_available_products_for_agents():
    """Get only multi-app products that can be assigned to agents (universal terminology)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        from ..services.products import product_service

        product_service.invalidate_product_cache(user.project_id)

        result = product_service.get_products_cached(
            project_id=user.project_id,
            product_type="all",
            user_id=user_id,
        )

        if result.get("success"):

            products_data = []
            all_products = result.get("products", [])
            current_app.logger.info(f"Total products found: {len(all_products)}")

            for product in all_products:
                current_app.logger.info(
                    f"Product: {product.get('name')}, is_multi_app: {product.get('is_multi_app')}"
                )

                product_data = {
                    "id": product["id"],
                    "name": product["name"],
                    "description": product.get("description", ""),
                    "status": product.get("status", "active"),
                    "logo": product.get("logo", ""),
                    "version": product.get("version", "1.0.0"),
                    "is_multi_app": product.get("is_multi_app", False),
                }
                products_data.append(product_data)

            current_app.logger.info(f"Multi-app products found: {len(products_data)}")

            debug_info = {
                "total_products": len(all_products),
                "multi_app_products": len(products_data),
                "products_data": products_data,
                "all_products_debug": [
                    {"id": p["id"], "name": p["name"], "is_multi_app": p.get("is_multi_app", False)}
                    for p in all_products
                ],
            }
            current_app.logger.info(f"Debug info: {debug_info}")

            return jsonify({"products": products_data, "success": True, "debug": debug_info})
        else:
            current_app.logger.error(f"Product service error: {result.get('error', 'Unknown error')}")
            return (
                jsonify(
                    {
                        "error": f'Failed to fetch products: {result.get("error", "Unknown error")}',
                        "success": False,
                    }
                ),
                500,
            )

    except Exception as e:
        current_app.logger.error(f"Error getting available products for agents: {str(e)}")
        import traceback

        current_app.logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"error": f"Failed to get available products: {str(e)}", "success": False}), 500

@agents_bp.route("", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_loader():
    """Create a new agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        data = request.get_json()

        if not data or not data.get("name") or not data.get("description"):
            return jsonify({"error": "Name and description are required", "success": False}), 400

        existing_agent = Agent.query.filter_by(
            name=data["name"], project_id=user.project_id
        ).first()
        if existing_agent:
            return jsonify({"error": "Agent with this name already exists", "success": False}), 400

        new_agent = Agent(
            name=data["name"],
            description=data["description"],
            status=data.get("status", "active"),
            logo=data.get("logo"),
            banner=data.get("banner"),
            background=data.get("background"),
            file=data.get("file", f"{data['name'].lower().replace(' ', '_')}_loader.exe"),
            changelog=data.get("changelog", "Initial version"),
            notifications=data.get("notifications", "New agent added!"),
            version=data.get("version", "1.0.0"),
            downloads=data.get("downloads", 0),
            active_users=data.get("active_users", 0),
            created_by=user.id,
            project_id=user.project_id,
        )

        db.session.add(new_agent)
        db.session.commit()

        try:
            from .files import clear_storage_cache

            clear_storage_cache(user.project_id)
        except ImportError:
            pass

        agent_data = {
            "id": new_agent.unique_id,
            "name": new_agent.name,
            "description": new_agent.description,
            "status": new_agent.status,
            "logo": new_agent.logo,
            "banner": new_agent.banner,
            "background": new_agent.background,
            "file": new_agent.file,
            "changelog": new_agent.changelog,
            "notifications": new_agent.notifications,
            "version": new_agent.version,
            "downloads": new_agent.downloads,
            "active_users": new_agent.active_users,
            "last_update": new_agent.updated_at.isoformat() if new_agent.updated_at else None,
            "created_at": new_agent.created_at.isoformat() if new_agent.created_at else None,
            "updated_at": new_agent.updated_at.isoformat() if new_agent.updated_at else None,
            "assigned_products": [],
        }

        try:
            from ..services.cache import cache_service

            cache_service.invalidate_pattern(f"agents:project_id={user.project_id}:*")
        except ImportError:
            pass

        return jsonify(
            {"agent": agent_data, "success": True, "message": "Agent created successfully"}
        )
    except Exception as e:
        current_app.logger.error(f"Error creating agent: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to create agent", "success": False}), 500

@agents_bp.route("/<int:agent_id>", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_loader(agent_id):
    """Update an existing agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        agent = Agent.query.filter_by(id=agent_id, project_id=user.project_id).first()
        if not agent:
            return jsonify({"error": "Agent not found", "success": False}), 404

        data = request.get_json()

        if data.get("name"):
            existing_agent = Agent.query.filter_by(
                name=data["name"], project_id=user.project_id
            ).first()
            if existing_agent and existing_agent.id != agent_id:
                return (
                    jsonify({"error": "Agent with this name already exists", "success": False}),
                    400,
                )

            agent.name = data["name"]

        if data.get("description"):
            agent.description = data["description"]

        if data.get("status"):
            agent.status = data["status"]

        if data.get("logo") is not None:
            agent.logo = data["logo"]

        if data.get("banner") is not None:
            agent.banner = data["banner"]

        if data.get("background") is not None:
            agent.background = data["background"]

        if data.get("file"):
            agent.file = data["file"]

        if data.get("changelog"):
            agent.changelog = data["changelog"]

        if data.get("notifications"):
            agent.notifications = data["notifications"]

        if data.get("version"):
            agent.version = data["version"]

        agent.updated_at = datetime.utcnow()

        db.session.commit()

        try:
            from ..services.cache import cache_service

            cache_service.invalidate_pattern(f"agents:project_id={user.project_id}:*")
        except ImportError:
            pass

        return jsonify({"success": True, "message": "Agent updated successfully"})
    except Exception as e:
        current_app.logger.error(f"Error updating agent: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to update agent", "success": False}), 500

@agents_bp.route("/<int:agent_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_loader(agent_id):
    """Delete a agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        agent = Agent.query.filter_by(id=agent_id, project_id=user.project_id).first()
        if not agent:
            return jsonify({"error": "Agent not found", "success": False}), 404

        AgentProductAssignment.query.filter_by(
            agent_id=agent_id, project_id=user.project_id
        ).delete()

        db.session.delete(agent)
        db.session.commit()

        try:
            from ..services.cache import cache_service

            cache_service.invalidate_pattern(f"agents:project_id={user.project_id}:*")
        except ImportError:
            pass

        return jsonify({"success": True, "message": "Agent deleted successfully"})
    except Exception as e:
        current_app.logger.error(f"Error deleting agent: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to delete agent", "success": False}), 500

@agents_bp.route("/<int:agent_id>/assign-products", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def assign_products_to_agent(agent_id):
    """Assign products to an agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        agent = Agent.query.filter_by(id=agent_id, project_id=user.project_id).first()
        if not agent:
            return jsonify({"error": "Agent not found", "success": False}), 404

        data = request.get_json()
        product_ids = data.get("product_ids", [])

        if not isinstance(product_ids, list):
            return jsonify({"error": "product_ids must be a list", "success": False}), 400

        current_assignments = AgentProductAssignment.query.filter_by(
            agent_id=agent_id, project_id=user.project_id
        ).all()
        current_product_ids = {assignment.product_id for assignment in current_assignments}

        for product_id in product_ids:
            if product_id in current_product_ids:

                continue

            existing_assignment = AgentProductAssignment.query.filter_by(
                product_id=product_id, project_id=user.project_id
            ).first()

            if existing_assignment and existing_assignment.agent_id != agent_id:

                other_agent = Agent.query.get(existing_assignment.agent_id)
                agent_name = (
                    other_agent.name if other_agent else f"Agent {existing_assignment.agent_id}"
                )
                product = Product.query.get(product_id)
                product_name = product.name if product else f"Product {product_id}"
                return (
                    jsonify(
                        {
                            "error": f'Product "{product_name}" is already assigned to agent "{agent_name}". A product can only be assigned to one agent at a time.',
                            "success": False,
                        }
                    ),
                    400,
                )

        AgentProductAssignment.query.filter_by(
            agent_id=agent_id, project_id=user.project_id
        ).delete()

        for product_id in product_ids:
            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()
            if product:
                assignment = AgentProductAssignment(
                    agent_id=agent_id,
                    product_id=product_id,
                    assigned_by=user.id,
                    project_id=user.project_id,
                )
                db.session.add(assignment)

        db.session.commit()

        return jsonify({"success": True, "message": "Products assigned to agent successfully"})
    except Exception as e:
        current_app.logger.error(f"Error assigning products to agent: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to assign products to agent", "success": False}), 500

@agents_bp.route("/<int:agent_id>/files", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def upload_loader_files(agent_id):
    """Upload files for a agent"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:

            return jsonify({"error": "User not found"}), 404

        if not user.project_id:

            return jsonify({"error": "User must be assigned to a project"}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated"}), 400

        agent = Agent.query.filter_by(id=agent_id, project_id=user.project_id).first()
        if not agent:
            return jsonify({"error": "Agent not found", "success": False}), 404

        uploaded_files = {}

        for file_type in ["logo", "banner", "background", "file"]:
            if file_type in request.files:
                file = request.files[file_type]
                if file and file.filename:
                    if not allowed_file(file.filename):
                        return (
                            jsonify(
                                {
                                    "error": f"File type not allowed for {file_type}",
                                    "success": False,
                                }
                            ),
                            400,
                        )

                    file.seek(0, 2)
                    file_size = file.tell()
                    file.seek(0)

                    filename = secure_filename(file.filename)
                    unique_filename = f"{file_type}_{agent_id}_{uuid.uuid4().hex}_{filename}"

                    upload_path = os.path.join(current_app.root_path, "uploads", "agents")
                    os.makedirs(upload_path, exist_ok=True)

                    file_path = os.path.join(upload_path, unique_filename)
                    file.save(file_path)

                    # SECURITY: Validate file signature (magic bytes) to prevent file type spoofing
                    # This prevents attackers from uploading executable files with image extensions
                    from ..services.files.file_service import file_service
                    
                    # Determine expected extensions based on file type
                    expected_extensions = None
                    if file_type in ["logo", "banner", "background"]:
                        # For images, expect image extensions
                        ext = filename.rsplit(".", 1)[1].lower() if "." in filename else None
                        if ext and ext in ["png", "jpg", "jpeg", "gif", "webp"]:
                            expected_extensions = [ext]
                    
                    is_valid, validation_error = file_service.validate_file_signature(file_path, expected_extensions)
                    if not is_valid:
                        # Remove the invalid file
                        try:
                            os.remove(file_path)
                        except Exception:
                            pass
                        return (
                            jsonify(
                                {
                                    "error": validation_error or f"File validation failed for {file_type}",
                                    "success": False,
                                }
                            ),
                            400,
                        )

                    if file_type == "logo":
                        agent.logo = unique_filename
                    elif file_type == "banner":
                        agent.banner = unique_filename
                    elif file_type == "background":
                        agent.background = unique_filename
                    elif file_type == "file":
                        agent.file = unique_filename

                    uploaded_files[file_type] = unique_filename

        if uploaded_files:
            agent.updated_at = datetime.utcnow()
            db.session.commit()

            try:
                from .files import clear_storage_cache

                clear_storage_cache(user.project_id)
            except ImportError:
                pass

        return jsonify(
            {
                "success": True,
                "message": "Files uploaded successfully",
                "uploaded_files": uploaded_files,
            }
        )
    except Exception as e:
        current_app.logger.error(f"Error uploading agent files: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to upload files", "success": False}), 500

@agents_bp.route("/<int:agent_id>/status", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_loader_status(agent_id):
    """Update agent status"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found", "success": False}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project", "success": False}), 403

        agent = Agent.query.filter_by(id=agent_id, project_id=user.project_id).first()
        if not agent:
            return jsonify({"error": "Agent not found", "success": False}), 404

        data = request.get_json()
        new_status = data.get("status")

        if new_status not in ["active", "inactive", "maintenance", "testing"]:
            return jsonify({"error": "Invalid status", "success": False}), 400

        agent.status = new_status
        agent.updated_at = datetime.utcnow()

        db.session.commit()

        try:
            from ..services.cache import cache_service

            cache_service.invalidate_pattern(f"agents:project_id={user.project_id}:*")
        except ImportError:
            pass

        try:
            from ..services.activity import activity_service

            activity_service.log_activity(
                user,
                "agent_status_updated",
                details=f"Updated status to {new_status} for agent: {agent.name}",
            )
        except ImportError:
            pass

        return jsonify({"success": True, "message": f"Agent status updated to {new_status}"})
    except Exception as e:
        current_app.logger.error(f"Error updating agent status: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to update agent status", "success": False}), 500

@agents_bp.route("/cache/refresh", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def refresh_loader_cache():
    """Force refresh agent cache for debugging"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found", "success": False}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project", "success": False}), 403

        from ..services.cache import cache_service

        success = cache_service.force_refresh_loader_cache(user.project_id)

        if success:
            return jsonify({"success": True, "message": "Agent cache refreshed successfully"})
        else:
            return jsonify({"error": "Failed to refresh cache", "success": False}), 500

    except Exception as e:
        current_app.logger.error(f"Error refreshing agent cache: {str(e)}")
        return jsonify({"error": "Failed to refresh cache", "success": False}), 500

@agents_bp.route("/<int:agent_id>/download", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def download_loader(agent_id):
    """Record agent download and return download info"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user or not user.project_id:
            return jsonify({"error": "User not found or not assigned to project", "success": False}), 403
        
        agent = Agent.query.filter_by(id=agent_id, project_id=user.project_id).first()
        if not agent:
            return jsonify({"error": "Agent not found", "success": False}), 404

        agent.downloads = (agent.downloads or 0) + 1
        agent.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify(
            {
                "success": True,
                "download_url": f"/api/uploads/agents/{agent.file}" if agent.file else None,
                "filename": agent.file,
                "downloads": agent.downloads,
            }
        )
    except Exception as e:
        current_app.logger.error(f"Error recording agent download: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to record download", "success": False}), 500

@agents_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_loader_stats():
    """Get agent statistics"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403

        project_id = user.project_id

        total_loaders = Agent.query.filter_by(project_id=project_id).count()
        active_loaders = Agent.query.filter_by(project_id=project_id, status="active").count()
        inactive_loaders = Agent.query.filter_by(project_id=project_id, status="inactive").count()
        maintenance_loaders = Agent.query.filter_by(
            project_id=project_id, status="maintenance"
        ).count()
        testing_loaders = Agent.query.filter_by(project_id=project_id, status="testing").count()

        total_downloads = (
            db.session.query(db.func.sum(Agent.downloads))
            .filter_by(project_id=project_id)
            .scalar()
            or 0
        )
        total_active_users = (
            db.session.query(db.func.sum(Agent.active_users))
            .filter_by(project_id=project_id)
            .scalar()
            or 0
        )

        stats = {
            "total_loaders": total_loaders,
            "active_loaders": active_loaders,
            "inactive_loaders": inactive_loaders,
            "maintenance_loaders": maintenance_loaders,
            "testing_loaders": testing_loaders,
            "total_downloads": total_downloads,
            "total_active_users": total_active_users,
        }

        return jsonify({"stats": stats, "success": True})
    except Exception as e:
        current_app.logger.error(f"Error getting agent stats: {str(e)}")
        return jsonify({"error": "Failed to get agent stats", "success": False}), 500

@agents_bp.route("/<int:agent_id>/config", methods=["PUT"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def update_loader_config(agent_id):
    """Update agent configuration (login type, multi-login, invite code requirements, key prefix)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if not user.project_id:
            return jsonify({"error": "User must be assigned to a project"}), 403
            return jsonify({"error": "Access denied", "success": False}), 403

        if not user.project_id:
            return jsonify({"error": "No project associated", "success": False}), 400

        agent = Agent.query.filter_by(id=agent_id, project_id=user.project_id).first()
        if not agent:
            return jsonify({"error": "Agent not found", "success": False}), 404

        data = request.get_json()

        if "login_type" in data:
            allowed_login_types = ["license_generation", "invite_code"]
            if data["login_type"] not in allowed_login_types:
                return (
                    jsonify(
                        {
                            "error": f'Invalid login type. Allowed: {", ".join(allowed_login_types)}',
                            "success": False,
                        }
                    ),
                    400,
                )
            agent.login_type = data["login_type"]

        if "invite_code_required" in data:
            agent.invite_code_required = bool(data["invite_code_required"])

        if "custom_key_prefix" in data:
            agent.custom_key_prefix = data["custom_key_prefix"]

        if "key_prefix_format" in data:
            agent.key_prefix_format = data["key_prefix_format"]

        agent.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify(
            {
                "success": True,
                "message": "Agent configuration updated successfully",
                "config": {
                    "login_type": agent.login_type,
                    "invite_code_required": agent.invite_code_required,
                    "custom_key_prefix": agent.custom_key_prefix,
                    "key_prefix_format": agent.key_prefix_format,
                },
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error updating agent configuration: {str(e)}")
        db.session.rollback()
        return jsonify({"error": "Failed to update agent configuration", "success": False}), 500
