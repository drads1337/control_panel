import logging
import uuid
from datetime import datetime

from flask import g, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from ..core.extensions import db
from ..models.core import User
from ..services.activity import activity_service
from ..utils.data_masking import create_safe_log_details, mask_username

class ActivityLoggerMiddleware:

    def __init__(self, app):
        self.app = app
        self.app.before_request(self.before_request)
        self.app.after_request(self.after_request)

    def before_request(self):
        g.start_time = datetime.utcnow()
        g.request_id = str(uuid.uuid4())
        request.environ["HTTP_X_REQUEST_ID"] = g.request_id

    def after_request(self, response):
        try:
            if self._should_log_request(request):
                self._log_activity(request, response)
        except Exception as e:
            logging.warning(f"[WARNING] Failed to log activity in middleware: {e}")

        return response

    def _should_log_request(self, request):
        logging.debug(f"[DEBUG] Request: {request.method} {request.path}")

        excluded_paths = [
            "/static/",
            "/favicon.ico",
            "/robots.txt",
            "/api/health",
            "/api/status",
            "/api/challenge",
            "/api/connect",
        ]

        path = request.path
        for excluded in excluded_paths:
            if path.startswith(excluded):
                return False

        if not path.startswith("/api/"):
            return False

        if request.method == "OPTIONS":
            return False

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            logging.debug(
                f"[DEBUG] No valid Authorization header for {request.method} {request.path}"
            )
            return False

        return True

    def _log_activity(self, request, response):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                logging.debug(
                    f"[DEBUG] No Authorization header found for {request.method} {request.path}"
                )
                return

            token = auth_header.split(" ")[1]

            logging.debug(f"[DEBUG] Processing token for {request.method} {request.path}")

            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()
                logging.debug(f"[DEBUG] JWT verification successful, user_id: {user_id}")
            except Exception as jwt_error:
                logging.debug(f"[DEBUG] JWT verification failed: {jwt_error}")
                return

            if not user_id:
                logging.debug(f"[DEBUG] No user_id found in JWT token")
                return

            user = None
            try:
                if db.session.is_active:
                    user = User.query.get(user_id)
                else:
                    db.session.rollback()
                    user = User.query.get(user_id)

                if not user:
                    logging.debug(f"[DEBUG] User not found for user_id: {user_id}")
                    return

            except Exception as db_error:
                logging.debug(f"[DEBUG] Database error when getting user: {db_error}")
                try:
                    db.session.rollback()
                    user = User.query.get(user_id)
                    if not user:
                        logging.debug(
                            f"[DEBUG] User not found for user_id: {user_id} after rollback"
                        )
                        return
                except Exception as retry_error:
                    logging.debug(f"[DEBUG] Failed to get user even after rollback: {retry_error}")
                    return

            masked_username = mask_username(user.username) if user.username else "unknown"
            logging.debug(f"[DEBUG] Found user: {masked_username} (ID: {user.id})")

            action = self._determine_action(request)
            logging.debug(f"[DEBUG] Determined action: {action}")

            self._log_async(user=user, action=action, request=request, response=response)

        except Exception as e:
            logging.warning(f"[WARNING] Failed to log activity: {e}")
            import traceback

            logging.warning(f"[WARNING] Traceback: {traceback.format_exc()}")

    def _determine_action(self, request):
        """
        Automatically determine action from request endpoint.
        Uses request.endpoint (e.g., 'projects.get_projects') to generate action name.
        Falls back to path-based mapping for special cases or when endpoint is unavailable.
        """
        method = request.method

        if request.endpoint:

            endpoint_parts = request.endpoint.split('.')

            if len(endpoint_parts) >= 2:
                blueprint_name = endpoint_parts[0]
                function_name = endpoint_parts[1]

                blueprint_name = blueprint_name.replace('_bp', '').replace('_', '.')

                action = f"{blueprint_name}.{function_name}"
                return action

        path = request.path
        action_map = {
            "/api/users/profile": "profile_view" if method == "GET" else "profile_update",
            "/api/users/change_password": "password_change",
            "/api/users/avatar": "avatar_upload" if method == "POST" else "avatar_view",
            "/api/keys": "keys_view" if method == "GET" else "keys_manage",
            "/api/games": "games_view" if method == "GET" else "games_manage",
            "/api/projects": "projects_view" if method == "GET" else "projects_manage",
            "/api/panel_tools/projects": "projects_view" if method == "GET" else "projects_manage",
            "/api/sessions": "sessions_view" if method == "GET" else "sessions_manage",
            "/api/logs": "logs_view",
            "/api/notifications": (
                "notifications_view" if method == "GET" else "notifications_manage"
            ),
            "/api/files": "files_view" if method == "GET" else "files_manage",
            "/api/me": "profile_view",
            "/api/chat": "chat_view" if method == "GET" else "chat_send",
            "/api/changelog": "changelog_view" if method == "GET" else "changelog_manage",
            "/api/loaders": "loaders_view" if method == "GET" else "loaders_manage",
            "/api/servers": "servers_view" if method == "GET" else "servers_manage",
            "/api/analytics": "analytics_view",
            "/api/webhooks": "webhooks_view" if method == "GET" else "webhooks_manage",
            "/api/rbac": "rbac_view" if method == "GET" else "rbac_manage",
            "/api/dashboard": "dashboard_view",
            "/api/admin": "admin_view" if method == "GET" else "admin_manage",
            "/api/connect": "connect_view" if method == "GET" else "connect_manage",
        }

        if path in action_map:
            return action_map[path]

        for pattern, action in action_map.items():
            if path.startswith(pattern):
                return action

        return f'{method.lower()}_{path.split("/")[-1]}'

    def _log_async(self, user, action, request, response):
        try:
            from threading import Thread

            from flask import current_app

            request_data = {
                "method": request.method,
                "path": request.path,
                "user_agent": request.headers.get("User-Agent"),
                "session_id": request.headers.get("X-Session-ID"),
            }

            response_data = {
                "status_code": response.status_code if response else None,
                "content_length": getattr(response, "content_length", None) if response else None,
            }

            duration = None
            if hasattr(g, "start_time"):
                duration = (datetime.utcnow() - g.start_time).total_seconds()

            from ..utils.ip_utils import get_real_ip

            real_ip = get_real_ip()

            app_context = current_app._get_current_object()

            def log_async():
                try:
                    with app_context.app_context():
                        details = self._get_request_details_from_data(
                            request_data, response_data, duration
                        )

                        masked_username = (
                            mask_username(user.username) if user.username else "unknown"
                        )
                        logging.debug(
                            f"[DEBUG] Logging activity: {action} for user {masked_username}"
                        )

                        safe_details = create_safe_log_details(
                            action,
                            user_id=user.id,
                            username=user.username,
                            project_id=user.project_id,
                            details=details,
                        )

                        activity_service.log_activity(
                            user=user,
                            action=action,
                            ip=real_ip,
                            user_agent=request_data["user_agent"],
                            details=safe_details,
                            session_id=request_data["session_id"],
                        )

                        logging.debug(f"[DEBUG] Successfully logged activity: {action}")

                except Exception as e:
                    logging.warning(f"[WARNING] Async logging failed: {e}")
                    import traceback

                    logging.warning(f"[WARNING] Async logging traceback: {traceback.format_exc()}")

            Thread(target=log_async, daemon=True).start()

        except Exception as e:
            logging.warning(f"[WARNING] Could not start async logging: {e}")

    def _get_request_details_from_data(self, request_data, response_data, duration):
        details = []

        details.append(f"{request_data['method']} {request_data['path']}")

        if response_data["status_code"]:
            details.append(f"Status: {response_data['status_code']}")

        if duration is not None:
            details.append(f"Duration: {duration:.3f}s")

        if response_data["content_length"]:
            details.append(f"Size: {response_data['content_length']} bytes")

        return " | ".join(details)

    def _get_request_details(self, request, response):
        details = []

        details.append(f"{request.method} {request.path}")

        if response:
            details.append(f"Status: {response.status_code}")

        if hasattr(g, "start_time"):
            duration = (datetime.utcnow() - g.start_time).total_seconds()
            details.append(f"Duration: {duration:.3f}s")

        if response and hasattr(response, "content_length"):
            details.append(f"Size: {response.content_length} bytes")

        return " | ".join(details)
