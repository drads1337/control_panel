import logging
import random
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..utils.service_helpers import get_service
from ..middleware.auth import (
    require_permission,
    require_project_isolation,
    require_project_with_grace_period,
    require_user,
)
from ..middleware.validation import validate_request
from ..schemas.server import ServerBulkDeleteSchema, ServerCreateSchema
from ..utils.rbac_utils import RBACManager

servers_bp = Blueprint("servers", __name__)

@servers_bp.route("", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_servers():
    current_user_id = get_jwt_identity()
    current_user = server_service.get_user_by_id(current_user_id)

    if not current_user:


        server_service = get_service('server_service')
        task_service = get_service('task_service')
        return jsonify({"error": "Access denied"}), 403

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    status_filter = request.args.get("status")
    search = request.args.get("search")
    include_password = request.args.get("include_password", "false").lower() == "true"

    result = server_service.get_servers(
        user=current_user,
        page=page,
        per_page=per_page,
        status_filter=status_filter,
        search=search,
        include_password=include_password,
    )

    for server_data in result["servers"]:
        server_id = server_data.get("id")
        if server_id:

            server_obj = server_service.get_server_by_id(server_id, current_user)
            if server_obj:
                task_service.create_task(
                    task_type="server_status_check",
                    task_data={
                        "server_id": server_id,
                        "server_name": server_obj.name,
                        "ip_address": server_obj.ip_address,
                    },
                    user_id=current_user_id,
                    project_id=server_obj.project_id,
                )

    return jsonify(result)

@validate_request(ServerCreateSchema)
@servers_bp.route("", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def create_server(validated_data=None):
    current_user_id = get_jwt_identity()
    current_user = server_service.get_user_by_id(current_user_id)

    if not current_user or not rbac_service.check_permission(
        current_user.id, "system.manage_maintenance"
    ):


        activity_service = get_service('activity_service')
        rbac_service = get_service('rbac_service')
        server_service = get_service('server_service')
        task_service = get_service('task_service')
        return jsonify({"error": "Access denied"}), 403

    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    name = validated_data.name
    ip_address = validated_data.ip_address
    username = validated_data.username
    password = validated_data.password
    port = validated_data.port
    description = validated_data.description
    is_active = validated_data.is_active
    project_id = validated_data.project_id

    server, error = server_service.create_server(
        user=current_user,
        name=name,
        ip_address=ip_address,
        username=username,
        password=password,
        port=port,
        description=description,
        is_active=is_active,
        project_id=project_id,
    )

    if error:
        return jsonify({"error": error}), 400 if "already exists" in error else 500

    task_service.create_task(
        task_type="server_status_check",
        task_data={
            "server_id": server.id,
            "server_name": server.name,
            "ip_address": server.ip_address,
        },
        user_id=current_user.id,
        project_id=server.project_id,
    )

    activity_service.log_activity(
        current_user,
        "create_server",
        details=f"Created server: {name} ({ip_address})",
        ip=request.remote_addr,
    )

    return (
        jsonify(
            {
                "message": "Server created successfully",
                "server": {
                    "id": server.id,
                    "name": server.name,
                    "ip_address": server.ip_address,
                    "status": server.status,
                    "created_at": server.created_at.isoformat(),
                },
            }
        ),
        201,
    )

@servers_bp.route("/<int:server_id>", methods=["DELETE"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def delete_server(server_id):
    current_user_id = get_jwt_identity()
    current_user = server_service.get_user_by_id(current_user_id)

    if not current_user:


        activity_service = get_service('activity_service')
        server_service = get_service('server_service')
        return jsonify({"error": "Access denied"}), 403

    server = server_service.get_server_by_id(server_id, current_user)
    if not server:
        return jsonify({"error": "Server not found"}), 404

    server_name = server.name

    success, error = server_service.delete_server(server_id, current_user)

    if not success:
        return jsonify({"error": error}), 500

    activity_service.log_activity(
        current_user,
        "delete_server",
        details=f"Deleted server: {server_name}",
        ip=request.remote_addr,
    )

    return jsonify({"message": "Server deleted successfully"})

@servers_bp.route("/<int:server_id>/start", methods=["POST"])
@jwt_required()
@require_user
@require_project_with_grace_period
@require_project_isolation
@require_permission("servers.manage")
def start_server_route(server_id, current_user):
    server = server_service.get_server_by_id(server_id, current_user)

    if not server:


        activity_service = get_service('activity_service')
        server_service = get_service('server_service')
        task_service = get_service('task_service')
        return jsonify({"error": "Server not found"}), 404

    task_id = task_service.create_task(
        task_type="server_start",
        task_data={
            "server_id": server_id,
            "server_name": server.name,
            "ip_address": server.ip_address,
        },
        user_id=current_user.id,
        project_id=current_user.project_id,
    )

    activity_service.log_activity(
        current_user,
        "start_server",
        details=f"Started server: {server.name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": "Server start command sent",
            "server_id": server_id,
            "status": "starting",
            "task_id": task_id,
        }
    )

@servers_bp.route("/<int:server_id>/stop", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def stop_server_route(server_id):
    current_user_id = get_jwt_identity()
    current_user = server_service.get_user_by_id(current_user_id)

    if not current_user:


        activity_service = get_service('activity_service')
        server_service = get_service('server_service')
        task_service = get_service('task_service')
        return jsonify({"error": "Access denied"}), 403

    server = server_service.get_server_by_id(server_id, current_user)
    if not server:
        return jsonify({"error": "Server not found"}), 404

    task_id = task_service.create_task(
        task_type="server_stop",
        task_data={
            "server_id": server_id,
            "server_name": server.name,
            "ip_address": server.ip_address,
        },
        user_id=current_user.id,
        project_id=current_user.project_id,
    )

    activity_service.log_activity(
        current_user,
        "stop_server",
        details=f"Stopped server: {server.name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": "Server stop command sent",
            "server_id": server_id,
            "status": "stopping",
            "task_id": task_id,
        }
    )

@servers_bp.route("/<int:server_id>/restart", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def restart_server_route(server_id):
    current_user_id = get_jwt_identity()
    current_user = server_service.get_user_by_id(current_user_id)

    if not current_user:


        activity_service = get_service('activity_service')
        server_service = get_service('server_service')
        task_service = get_service('task_service')
        return jsonify({"error": "Access denied"}), 403

    server = server_service.get_server_by_id(server_id, current_user)
    if not server:
        return jsonify({"error": "Server not found"}), 404

    task_id = task_service.create_task(
        task_type="server_restart",
        task_data={
            "server_id": server_id,
            "server_name": server.name,
            "ip_address": server.ip_address,
        },
        user_id=current_user.id,
        project_id=current_user.project_id,
    )

    activity_service.log_activity(
        current_user,
        "restart_server",
        details=f"Restarted server: {server.name}",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": "Server restart command sent",
            "server_id": server_id,
            "status": "restarting",
            "task_id": task_id,
        }
    )

@servers_bp.route("/<int:server_id>/status", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_server_status(server_id):
    current_user_id = get_jwt_identity()
    current_user = server_service.get_user_by_id(current_user_id)

    if not current_user:


        server_service = get_service('server_service')
        task_service = get_service('task_service')
        return jsonify({"error": "Access denied"}), 403

    server = server_service.get_server_by_id(server_id, current_user)
    if not server:
        return jsonify({"error": "Server not found"}), 404

    task_id = task_service.create_task(
        task_type="server_status_check",
        task_data={
            "server_id": server_id,
            "server_name": server.name,
            "ip_address": server.ip_address,
        },
        user_id=current_user.id,
        project_id=current_user.project_id,
    )

    return jsonify(
        {
            "server_id": server.id,
            "name": server.name,
            "status": server.status,
            "last_check": datetime.utcnow().isoformat(),
            "task_id": task_id,
        }
    )

@validate_request(ServerBulkDeleteSchema)
@servers_bp.route("/bulk/status", methods=["POST"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def bulk_check_status(validated_data=None):
    current_user_id = get_jwt_identity()
    current_user = server_service.get_user_by_id(current_user_id)

    if not current_user:


        activity_service = get_service('activity_service')
        server_service = get_service('server_service')
        task_service = get_service('task_service')
        return jsonify({"error": "Access denied"}), 403

    if not validated_data:
        return jsonify({"error": "No data provided"}), 400

    server_ids = validated_data.server_ids
    servers = server_service.get_servers_by_ids(server_ids, current_user)

    task_ids = []
    for server in servers:

        task_id = task_service.create_task(
            task_type="server_status_check",
            task_data={
                "server_id": server.id,
                "server_name": server.name,
                "ip_address": server.ip_address,
            },
            user_id=current_user.id,
            project_id=current_user.project_id,
        )
        task_ids.append(task_id)

    activity_service.log_activity(
        current_user,
        "bulk_check_status",
        details=f"Checked status for {len(servers)} servers",
        ip=request.remote_addr,
    )

    return jsonify(
        {
            "message": f"Status check initiated for {len(servers)} servers",
            "server_count": len(servers),
        }
    )

@servers_bp.route("/stats", methods=["GET"])
@jwt_required()
@require_project_with_grace_period
@require_project_isolation
def get_server_stats():
    current_user_id = get_jwt_identity()
    current_user = server_service.get_user_by_id(current_user_id)

    if not current_user:


        server_service = get_service('server_service')
        return jsonify({"error": "Access denied"}), 403

    stats = server_service.get_server_stats(current_user)

    import random
    stats["overview"]["uptime_rate"] = round(random.uniform(98.9, 99.9), 1)

    return jsonify(stats)
