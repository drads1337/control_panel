"""
Monitoring Routes
Provides endpoints for checking load status on critical endpoints.
"""

import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..middleware.auth import require_permission
from ..services.monitoring.load_monitor import load_monitor

monitoring_bp = Blueprint("monitoring", __name__)
logger = logging.getLogger(__name__)


@monitoring_bp.route("/load/status", methods=["GET"])
@jwt_required()
@require_permission("admin.view")
def get_load_status():
    """
    Get current load status for all monitored endpoints.
    
    Requires admin.view permission.
    """
    try:
        status = load_monitor.get_all_endpoints_status()
        return jsonify({"status": "success", "data": status}), 200
    except Exception as e:
        logger.error(f"Failed to get load status: {e}")
        return jsonify({"error": "Failed to get load status"}), 500


@monitoring_bp.route("/load/<endpoint>", methods=["GET"])
@jwt_required()
@require_permission("admin.view")
def get_endpoint_load(endpoint: str):
    """
    Get load metrics for a specific endpoint.
    
    Args:
        endpoint: Endpoint name (connect, heartbeat)
    
    Requires admin.view permission.
    """
    try:
        if endpoint not in ["connect", "heartbeat"]:
            return jsonify({"error": "Invalid endpoint"}), 400
        
        metrics = load_monitor.check_load(endpoint)
        return jsonify({"status": "success", "data": metrics}), 200
    except Exception as e:
        logger.error(f"Failed to get endpoint load: {e}")
        return jsonify({"error": "Failed to get endpoint load"}), 500


@monitoring_bp.route("/load/<endpoint>/top-ips", methods=["GET"])
@jwt_required()
@require_permission("admin.view")
def get_top_ips(endpoint: str):
    """
    Get top IP addresses by request count for an endpoint.
    Useful for DDoS detection.
    
    Args:
        endpoint: Endpoint name (connect, heartbeat)
    
    Requires admin.view permission.
    """
    try:
        if endpoint not in ["connect", "heartbeat"]:
            return jsonify({"error": "Invalid endpoint"}), 400
        
        limit = int(request.args.get("limit", 10))
        top_ips = load_monitor.get_top_ips(endpoint, limit=limit)
        
        return jsonify({"status": "success", "data": {"endpoint": endpoint, "top_ips": top_ips}}), 200
    except Exception as e:
        logger.error(f"Failed to get top IPs: {e}")
        return jsonify({"error": "Failed to get top IPs"}), 500

