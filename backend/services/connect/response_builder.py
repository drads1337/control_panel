"""
Response Builder
Handles response formatting and encryption
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from ...config.config import Config
from ...models import ProjectEncryptionKeys
from ...utils.rbac_utils import RBACManager
from ...utils.role_constants import UserRoles
from ...utils.secure_crypto import MasterKeyManager, encrypt_data_with_project_key

class ResponseBuilder:
    """Handles response building and encryption"""

    def build_success_response(
        self,
        token: str,
        project_id: int,
        expires_at: str,
        seconds_left: int,
        seconds_left_human: str,
        notifications: list,
        heartbeat_session: Optional[Dict] = None,
        offline_ticket: Optional[str] = None,
        access_token: Optional[str] = None,
        product_obj: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Build success response for connect endpoint

        Args:
            token: Connect token
            project_id: Project ID
            expires_at: Expiration timestamp
            seconds_left: Seconds until expiration
            seconds_left_human: Human readable time
            notifications: List of notifications
            heartbeat_session: Heartbeat session data (optional)
            offline_ticket: Offline authentication ticket (JWT) (optional)
            access_token: JWT access token for API authentication (optional)
            product_obj: Product object (optional) - includes product info in response

        Returns:
            Response dictionary
        """
        now = datetime.utcnow()
        now_utc = now.isoformat() + "Z"

        response = {
            "a": token[:16],
            "b": os.urandom(4).hex(),
            "c": int(now.timestamp()),
            "d": token[16:32],
            "e": os.urandom(3).hex(),
            "f": token[32:],
            "g": os.urandom(2).hex(),
            "x": os.urandom(8).hex(),
            "y": os.urandom(8).hex(),
            "project_id": project_id,
            "expires_at": expires_at,
            "seconds_left": seconds_left,
            "seconds_left_human": seconds_left_human,
            "now_utc": now_utc,
            "notifications": notifications,
        }

        if heartbeat_session:
            response["heartbeat_session"] = {
                "session_id": heartbeat_session["session_id"],
                "heartbeat_interval": heartbeat_session["heartbeat_interval"],
                "next_heartbeat_due": heartbeat_session["next_heartbeat_due"],
                "tolerance": heartbeat_session["tolerance"],
            }

        if offline_ticket:
            response["offline_ticket"] = offline_ticket

        if access_token:
            response["access_token"] = access_token


        if product_obj:

            background_value = ""
            if product_obj.backgrounds:
                try:
                    backgrounds_list = json.loads(product_obj.backgrounds)
                    if isinstance(backgrounds_list, list) and len(backgrounds_list) > 0:
                        background_value = backgrounds_list[0] if isinstance(backgrounds_list[0], str) else str(backgrounds_list[0])
                    else:
                        background_value = product_obj.backgrounds
                except:
                    background_value = product_obj.backgrounds
            
            response["product"] = {
                "id": product_obj.id,
                "unique_id": product_obj.unique_id or "",
                "name": product_obj.name or "",
                "description": product_obj.description or "",
                "version": product_obj.version or "1.0.0",
                "logo": product_obj.logo or "",
                "banner": product_obj.banner or "",
                "background": background_value,
                "file": product_obj.loader_file or "",
            }

        return response

    def build_error_response(
        self, error_message: str, project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Build error response

        Args:
            error_message: Error message
            project_id: Project ID (optional)

        Returns:
            Error response dictionary
        """
        response = {"error": error_message, "r": os.urandom(16).hex()}

        if project_id:
            response["project_id"] = project_id

        return response

    def encrypt_response(
        self,
        response: Dict[str, Any],
        used_global_key: bool = False,
        project_id: Optional[int] = None,
        use_legacy: bool = True,
    ) -> str:
        """
        Encrypt response data

        Args:
            response: Response dictionary
            used_global_key: Whether global key was used for request
            project_id: Project ID for project-specific encryption
            use_legacy: Use AES-256-GCM format (default True for client compatibility)

        Returns:
            Encrypted response string
        """
        try:
            if used_global_key:
                if use_legacy:

                    logging.info(f"[ENCRYPT_RESPONSE] Encrypting with AES-256-GCM (legacy)")

                    logging.info(f"[ENCRYPT_RESPONSE] MASTER_KEY length: {len(Config.MASTER_KEY)}")
                    logging.info(f"[ENCRYPT_RESPONSE] MASTER_KEY prefix (masked): {Config.MASTER_KEY[:8]}...")
                    encrypted_blob = MasterKeyManager.encrypt_with_master_key_legacy(
                        json.dumps(response), Config.MASTER_KEY
                    )
                    logging.info(
                        f"[ENCRYPT_RESPONSE] Encrypted response with AES-256-GCM, data_length={len(json.dumps(response))}, encrypted_length={len(encrypted_blob)}"
                    )
                else:
                    encrypted_blob = MasterKeyManager.encrypt_with_master_key(
                        json.dumps(response), Config.MASTER_KEY
                    )
                    logging.info(
                        f"[ENCRYPT_RESPONSE] Encrypted response with global master key (Fernet), data_length={len(json.dumps(response))}"
                    )
                return encrypted_blob
            elif project_id:



                try:
                    encrypted_blob = encrypt_data_with_project_key(response, project_id)
                    logging.info(
                        f"[DEBUG] Encrypted response with project {project_id} master key, data_length={len(json.dumps(response))}"
                    )
                    return encrypted_blob
                except Exception as e:
                    logging.error(
                        f"[ENCRYPT_RESPONSE] SECURITY: Failed to encrypt with project {project_id} key: {e}. "
                        f"Global MASTER_KEY fallback is disabled for security. "
                        f"Project {project_id} must configure its own encryption key."
                    )

                    raise ValueError(
                        f"Encryption failed for project {project_id}. "
                        f"Project must configure its own encryption key. "
                        f"Global MASTER_KEY fallback is disabled for security (prevents data isolation breach)."
                    ) from e
            else:


                logging.error(
                    "[ENCRYPT_RESPONSE] SECURITY: No project_id provided for encryption. "
                    "Global MASTER_KEY fallback is disabled for security."
                )
                raise ValueError(
                    "Project ID is required for encryption. "
                    "Global MASTER_KEY fallback is disabled for security (prevents data isolation breach)."
                )

        except Exception as e:
            logging.error(f"Error encrypting response: {e}")





            error_response = {"error": "Internal server error", "r": os.urandom(16).hex()}


            if not project_id:
                logging.warning(
                    "[ENCRYPT_RESPONSE] Using global MASTER_KEY for error response (no project_id). "
                    "This should only happen for critical system errors."
                )
                return MasterKeyManager.encrypt_with_master_key_legacy(
                    json.dumps(error_response), Config.MASTER_KEY
                )
            else:


                logging.error(
                    f"[ENCRYPT_RESPONSE] Critical: Cannot encrypt error response for project {project_id}. "
                    "Returning unencrypted error (client should handle gracefully)."
                )

                return json.dumps(error_response)

    def build_classic_connect_response(
        self, token: str, project_id: int, notifications: list, login_type: str = "classic"
    ) -> Dict[str, Any]:
        """
        Build response for classic connect endpoint

        Args:
            token: Connect token
            project_id: Project ID
            notifications: List of notifications
            login_type: Type of login (classic, etc.)

        Returns:
            Response dictionary
        """
        now = datetime.utcnow()
        now_utc = now.isoformat() + "Z"

        expires_at = (now + timedelta(hours=24)).isoformat()
        seconds_left = 24 * 3600
        seconds_left_human = "24 h"

        response = {
            "a": token[:16],
            "b": os.urandom(4).hex(),
            "c": int(now.timestamp()),
            "d": token[16:32],
            "e": os.urandom(3).hex(),
            "f": token[32:],
            "g": os.urandom(2).hex(),
            "x": os.urandom(8).hex(),
            "y": os.urandom(8).hex(),
            "project_id": project_id,
            "expires_at": expires_at,
            "seconds_left": seconds_left,
            "seconds_left_human": seconds_left_human,
            "now_utc": now_utc,
            "notifications": notifications,
            "login_type": login_type,
        }

        return response

    def build_web_login_response(
        self,
        access_token: str,
        user: Any,
        project: Any,
        accessible_products: list,
        device_info: list,
        subscription_info: Dict,
    ) -> Dict[str, Any]:
        """
        Build response for web login

        Args:
            access_token: JWT access token
            user: User object
            project: Project object
            accessible_products: List of accessible products
            device_info: List of device information
            subscription_info: Subscription information

        Returns:
            Web login response dictionary
        """
        return {
            "access_token": access_token,
            "user_id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": (
                RBACManager.get_user_role_names(user)[0]
                if RBACManager.get_user_role_names(user)
                else UserRoles.CLIENT.value
            ),
            "project_id": user.project_id,
            "subscription_info": subscription_info,
            "accessible_products": accessible_products,
            "device_info": device_info,
            "login_type": "classic_web",
        }

    def build_project_inactive_response(self, project: Any) -> Dict[str, Any]:
        """
        Build response for inactive project

        Args:
            project: Project object

        Returns:
            Project inactive response dictionary
        """
        error_message = "Project is currently inactive"
        if project.status == "inactive":
            error_message = (
                "Project has been paused. Please contact the project owner to reactivate it."
            )
        elif project.status == "expired":
            error_message = "Project subscription has expired. Please contact the project owner to renew the subscription."

        return {
            "error": "Project Inactive",
            "message": error_message,
            "project_name": project.name,
            "project_status": project.status,
            "subscription_status": project.subscription_status_display,
            "contact_owner": "Please contact the project owner for assistance.",
        }

    def build_product_inactive_response(self, product_obj: Any) -> Dict[str, Any]:
        """
        Build response for inactive product

        Args:
            product_obj: Product object

        Returns:
            Product inactive response dictionary
        """
        if product_obj.status == "inactive":
            return {
                "error": "Product Inactive",
                "message": "This product is currently inactive and access is not allowed.",
                "product_name": product_obj.name,
                "product_status": product_obj.status,
            }
        elif product_obj.status == "maintenance":
            return {
                "error": "Product Maintenance",
                "message": "This product is currently under maintenance. Access is temporarily unavailable.",
                "product_name": product_obj.name,
                "product_status": product_obj.status,
            }

        return {
            "error": "Product Access Denied",
            "message": "Access to this product is not allowed.",
            "product_name": product_obj.name,
            "product_status": product_obj.status,
        }
