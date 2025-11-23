"""
Product Service (formerly Product Service)
Provides cached access to product data and operations
Universal terminology for B2B/SaaS applications
"""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, func

from ...core.extensions import db
from ...models.core import User
from ...models.products import Product, ProductExtraFile, ProductFileConfig, ProductFileDownload, ProductKeyPrice
from ...models.keys import Key
from ...models.agents import Agent, AgentProductAssignment, AgentDownloadLog
from ...services.cache import cache_service
from ...utils.service_exceptions import NotFoundError, PermissionDeniedError, ConflictError, ServiceError

class ProductService:
    """Service for managing product data with caching"""

    def __init__(self, cache_service=None, logger=None):
        self.cache_service = cache_service
        self.logger = logger or logging.getLogger(__name__)

    @property
    def _cache_service(self):
        """Get cache service instance"""
        return self.cache_service if self.cache_service is not None else cache_service

    def get_products_cached(
        self, project_id: int, product_type: str = "all", user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get products with caching support"""

        def fetch_products():
            """Fetch products from database"""
            try:
                self.logger.info(
                    f"Fetching products from database for project {project_id}, type: {product_type}"
                )

                query = Product.query.filter_by(project_id=project_id)

                if product_type == "multi_app":
                    query = query.filter_by(is_multi_app=True)
                elif product_type == "product_library":
                    query = query.filter_by(is_multi_app=False)

                products = query.all()
                self.logger.info(f"Found {len(products)} products for project {project_id}")

                products_data = []
                for product in products:
                    try:
                        product_data = self._build_product_data(product, project_id)
                        products_data.append(product_data)
                    except Exception as product_error:
                        self.logger.error(f"Error processing product {product.id}: {str(product_error)}")
                        continue

                return {
                    "success": True,
                    "products": products_data,
                    "total_count": len(products_data),
                    "filter_type": product_type,
                }

            except Exception as e:
                self.logger.error(f"Error fetching products: {str(e)}")
                return {
                    "success": False,
                    "error": f"Failed to fetch products: {str(e)}",
                    "products": [],
                    "total_count": 0,
                }

        cache_key_params = {"project_id": project_id, "type": product_type}

        if user_id:
            cache_key_params["user_id"] = user_id

        cached_result = self._cache_service.get_or_set(
            cache_type="products", fetch_func=fetch_products, **cache_key_params
        )

        return cached_result or {
            "success": False,
            "error": "Failed to fetch products",
            "products": [],
            "total_count": 0,
        }

    def _build_product_data(self, product: Product, project_id: int) -> Dict[str, Any]:
        """Build product data dictionary with all related information"""
        try:

            prices = ProductKeyPrice.query.filter_by(product_id=product.id, project_id=project_id).all()
            price_dict = {}

            for price in prices:
                if not price.period.startswith("custom_"):
                    price_dict[price.period] = price.price

            backgrounds = []
            if hasattr(product, "backgrounds") and product.backgrounds:
                try:
                    if isinstance(product.backgrounds, str):
                        backgrounds = json.loads(product.backgrounds)
                    else:
                        backgrounds = product.backgrounds
                except (json.JSONDecodeError, TypeError):
                    backgrounds = []

            agent_info = None
            if product.is_multi_app:
                agent_assignment = AgentProductAssignment.query.filter_by(
                    product_id=product.id, project_id=project_id
                ).first()

                if agent_assignment and agent_assignment.agent:
                    agent_info = {
                        "id": agent_assignment.agent.unique_id,
                        "name": agent_assignment.agent.name,
                        "version": agent_assignment.agent.version or "1.0.0",
                        "status": agent_assignment.agent.status or "active",
                    }

            active_users_count = (
                db.session.query(User.id)
                .join(Key, User.id == Key.user_id)
                .filter(
                    and_(
                        Key.product_id == product.id,
                        Key.project_id == project_id,
                        Key.activated_at.isnot(None),
                        Key.status == 1,
                    )
                )
                .distinct()
                .count()
            )

            total_downloads = product.downloads or 0

            config_downloads = (
                db.session.query(ProductFileDownload)
                .join(ProductFileConfig, ProductFileDownload.file_id == ProductFileConfig.id)
                .filter(
                    and_(ProductFileDownload.file_type == "config", ProductFileConfig.product_id == product.id)
                )
                .count()
            )

            extra_file_downloads = (
                db.session.query(ProductFileDownload)
                .join(ProductExtraFile, ProductFileDownload.file_id == ProductExtraFile.id)
                .filter(
                    and_(
                        ProductFileDownload.file_type == "extra_file", ProductExtraFile.product_id == product.id
                    )
                )
                .count()
            )

            total_downloads += config_downloads + extra_file_downloads

            if product.is_multi_app:
                agent_assignment = AgentProductAssignment.query.filter_by(
                    product_id=product.id, project_id=project_id
                ).first()

                if agent_assignment:
                    agent_downloads = AgentDownloadLog.query.filter_by(
                        agent_id=agent_assignment.agent_id
                    ).count()
                    total_downloads += agent_downloads

            return {
                "id": product.unique_id,
                "name": product.name,
                "description": product.description or "",
                "status": product.status,
                "logo": product.logo or "",
                "banner": product.banner or "",
                "backgrounds": backgrounds,
                "file": product.loader_file or "",
                "changelog": product.changelog or "",
                "notifications": product.notifications or "",
                "prices": price_dict,
                "version": product.version or "1.0.0",
                "downloads": total_downloads,
                "activeUsers": active_users_count,
                "lastUpdate": product.created_at.strftime("%Y-%m-%d") if product.created_at else "N/A",
                "created_at": product.created_at.isoformat() if product.created_at else None,
                "is_multi_app": product.is_multi_app,
                "login_type": product.login_type or "license_generation",
                "invite_code_required": product.invite_code_required or False,
                "custom_key_prefix": product.custom_key_prefix or "",
                "key_prefix_format": product.key_prefix_format or "{name}-{duration}-{custom}",
                "agent": agent_info,
            }

        except Exception as e:
            self.logger.error(f"Error building product data for product {product.id}: {str(e)}")

            return {
                "id": product.unique_id,
                "name": product.name,
                "description": product.description or "",
                "status": product.status or "active",
                "logo": "",
                "banner": "",
                "backgrounds": [],
                "file": "",
                "changelog": "",
                "notifications": "",
                "prices": {},
                "version": "1.0.0",
                "downloads": 0,
                "activeUsers": 0,
                "lastUpdate": "N/A",
                "created_at": None,
                "is_multi_app": False,
                "login_type": "license_generation",
                "invite_code_required": False,
                "custom_key_prefix": "",
                "key_prefix_format": "{name}-{duration}-{custom}",
                "agent": None,
            }

    def invalidate_product_cache(self, project_id: int, product_id: Optional[int] = None) -> bool:
        """Invalidate product cache for a project or specific product - INSTANT updates"""
        try:

            deleted_count = self._cache_service.invalidate_product_instantly(project_id, product_id)

            self.logger.info(
                f"INSTANT product cache invalidation completed: {deleted_count} keys deleted"
            )
            return deleted_count > 0

        except Exception as e:
            self.logger.error(f"INSTANT product cache invalidation error: {e}")

            try:
                patterns = [
                    f"products:project_id={project_id}:*",
                    f"products:project_id={project_id}:type=all*",
                    f"products:project_id={project_id}:type=multi_app*",
                    f"products:project_id={project_id}:type=product_library*",
                ]

                total_deleted = 0
                for pattern in patterns:
                    deleted_count = self._cache_service.invalidate_pattern(pattern)
                    total_deleted += deleted_count

                self.logger.info(f"Fallback product cache invalidation: {total_deleted} keys deleted")
                return total_deleted > 0
            except Exception as fallback_error:
                self.logger.error(f"Fallback product cache invalidation error: {fallback_error}")
                return False

    def get_product_simple_cached(
        self, project_id: int, user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get simplified product list with caching and instant update detection"""

        def fetch_simple_products():
            """Fetch simplified products from database"""
            try:
                from ...utils.rbac_utils import RBACManager

                user = User.query.get(user_id) if user_id else None
                from ...services.rbac import rbac_service

                can_view_all = user and (
                    RBACManager.is_owner(user)
                    or rbac_service.check_permission(user.id, "products.view")
                )
                if can_view_all and RBACManager.is_owner(user):
                    products = Product.query.all()
                else:
                    products = Product.query.filter_by(project_id=project_id).all()

                products_data = []
                for product in products:
                    products_data.append(
                        {
                            "id": product.unique_id,
                            "name": product.name,
                            "description": product.description,
                            "is_active": product.is_active,
                            "status": product.status,
                            "project_id": product.project_id,
                        }
                    )

                return products_data

            except Exception as e:
                self.logger.error(f"Error fetching simple products: {e}")
                return []

        cache_key_params = {"project_id": project_id, "simple": True}

        if user_id:
            cache_key_params["user_id"] = user_id

        cached_result = self._cache_service.get_or_set(
            cache_type="products", fetch_func=fetch_simple_products, **cache_key_params
        )

        return cached_result or []

    def create_product(
        self, user: User, product_data: Dict[str, Any]
    ) -> Product:
        """
        Create a new product with prices

        Args:
            user: User creating the product
            product_data: Product data dictionary from validated schema

        Returns:
            Product object

        Raises:
            ConflictError: If product with this name already exists
            ServiceError: If database operation fails
        """
        try:

            existing_product = Product.query.filter_by(
                name=product_data["name"], project_id=user.project_id
            ).first()

            if existing_product:
                raise ConflictError("Product already exists", resource_type="product")

            new_product = Product(
                name=product_data["name"],
                description=product_data.get("description", ""),
                status=product_data.get("status", "active"),
                is_active=product_data.get("status", "active") == "active",
                project_id=user.project_id,
                changelog=product_data.get("changelog", ""),
                notifications=product_data.get("notifications", ""),
                version=product_data.get("version", "1.0.0"),
                downloads=product_data.get("downloads", 0),
                active_users=product_data.get("activeUsers", 0),
                is_multi_app=product_data.get("is_multi_app", False),
            )

            db.session.add(new_product)
            db.session.flush()

            if product_data.get("prices"):
                prices_data = product_data["prices"]
                for period, price in prices_data.items():
                    if period in ["hour", "day", "week", "month"]:
                        if price is not None and price != "":
                            product_price = ProductKeyPrice(
                                product_id=new_product.id,
                                period=period,
                                price=price,
                                project_id=user.project_id,
                            )
                            db.session.add(product_price)

            if user.project_id:
                from ...utils.project_counters import increment_project_product_counters
                increment_project_product_counters(user.project_id)

            db.session.commit()

            self.invalidate_product_cache(user.project_id, new_product.id)

            self.logger.info(f"Product created successfully: {new_product.id} by user {user.id}")
            return new_product

        except ConflictError:
            db.session.rollback()
            raise
        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating product: {str(e)}", exc_info=True)
            raise ServiceError(f"Failed to create product: {str(e)}", status_code=500) from e

    def get_product(
        self, user: User, product_id
    ) -> Product:
        """
        Get a single product by ID or unique_id with access control

        Args:
            user: User requesting the product
            product_id: ID (int) or unique_id (str) of the product to retrieve

        Returns:
            Product object

        Raises:
            NotFoundError: If product not found
            PermissionDeniedError: If user doesn't have access
            ServiceError: If database operation fails
        """
        try:
            from ...utils.rbac_utils import RBACManager
            
            # Check if user is owner - owners can access products from any project
            is_owner = RBACManager.is_owner(user)
            
            # Try to determine if product_id is an integer ID or a string unique_id
            product = None
            
            # First, try as integer ID
            if isinstance(product_id, int) or (isinstance(product_id, str) and product_id.isdigit()):
                try:
                    product_id_int = int(product_id)
                    if is_owner:
                        # Owners can access products from any project
                        product = Product.query.filter_by(id=product_id_int).first()
                    else:
                        # Non-owners must have project_id and product must belong to their project
                        if not user.project_id:
                            raise PermissionDeniedError("User must be assigned to a project")
                        product = Product.query.filter_by(id=product_id_int, project_id=user.project_id).first()
                except (ValueError, TypeError):
                    pass
            
            # If not found, try as unique_id (string)
            if not product:
                if is_owner:
                    # Owners can access products from any project
                    product = Product.query.filter_by(unique_id=str(product_id)).first()
                else:
                    # Non-owners must have project_id and product must belong to their project
                    if not user.project_id:
                        raise PermissionDeniedError("User must be assigned to a project")
                    product = Product.query.filter_by(unique_id=str(product_id), project_id=user.project_id).first()

            if not product:
                raise NotFoundError("Product", resource_id=str(product_id))

            return product

        except (NotFoundError, PermissionDeniedError):
            raise
        except Exception as e:
            self.logger.error(f"Error getting product {product_id}: {str(e)}", exc_info=True)
            raise ServiceError(f"Failed to get product: {str(e)}", status_code=500) from e

    def get_products_count(
        self, project_id: int, product_type: str = "all", user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get count of products with caching support (optimized version that doesn't load full product data)
        This is much more efficient than get_products_cached when you only need the count.
        """
        def fetch_count():
            """Fetch product count from database"""
            try:
                from ...models.core import UserProductPermission
                from ...models.rbac import UserRole, Role
                from ...services.rbac import rbac_service
                from ...utils.rbac_utils import RBACManager

                self.logger.info(
                    f"Fetching product count from database for project {project_id}, type: {product_type}"
                )

                # Base query for products
                query = Product.query.filter_by(project_id=project_id)

                if product_type == "multi_app":
                    query = query.filter_by(is_multi_app=True)
                elif product_type == "product_library":
                    query = query.filter_by(is_multi_app=False)

                # Get all product IDs first (lightweight query)
                product_ids = [p.id for p in query.with_entities(Product.id).all()]

                if not product_ids:
                    return {
                        "success": True,
                        "count": 0,
                    }

                # Get user permissions if user_id is provided
                user_product_permissions = {}
                has_view_permission = False
                is_seller = False

                if user_id:
                    try:
                        user_product_permissions = {
                            perm.product_id: perm.has_access
                            for perm in UserProductPermission.query.filter_by(user_id=user_id).all()
                        }
                    except Exception as perm_error:
                        db.session.rollback()
                        self.logger.warning(f"Transaction aborted, rolling back and retrying UserProductPermission query: {str(perm_error)}")
                        user_product_permissions = {
                            perm.product_id: perm.has_access
                            for perm in UserProductPermission.query.filter_by(user_id=user_id).all()
                        }

                    # Check global view permission
                    has_view_permission = rbac_service.check_permission(user_id, "products.view")

                    # Check if user is seller
                    try:
                        user_roles = db.session.query(Role.name).join(
                            UserRole, Role.id == UserRole.role_id
                        ).filter(UserRole.user_id == user_id).all()
                        user_role_names = [role[0] for role in user_roles]
                        is_seller = 'seller' in user_role_names or any('seller' in str(role).lower() for role in user_role_names)
                    except Exception as role_error:
                        db.session.rollback()
                        self.logger.warning(f"Transaction aborted, rolling back and retrying user roles query: {str(role_error)}")
                        user_roles = db.session.query(Role.name).join(
                            UserRole, Role.id == UserRole.role_id
                        ).filter(UserRole.user_id == user_id).all()
                        user_role_names = [role[0] for role in user_roles]
                        is_seller = 'seller' in user_role_names or any('seller' in str(role).lower() for role in user_role_names)

                # Count products based on permissions
                # If user has global view permission and is not a seller, count all
                if user_id and has_view_permission and not is_seller:
                    count = len(product_ids)
                else:
                    # Need to check each product's permission
                    count = 0
                    for product_id in product_ids:
                        should_include = False

                        if product_id in user_product_permissions:
                            should_include = user_product_permissions[product_id]
                        else:
                            if is_seller:
                                should_include = False
                            elif not has_view_permission:
                                # Check per-product permission
                                should_include = rbac_service.check_permission(user_id, "products.view", product_id=product_id)
                            else:
                                should_include = True

                        if should_include:
                            count += 1

                self.logger.info(f"Found {count} products for project {project_id} (type: {product_type})")
                return {
                    "success": True,
                    "count": count,
                }

            except Exception as e:
                self.logger.error(f"Error fetching product count: {str(e)}")
                return {
                    "success": False,
                    "error": f"Failed to fetch product count: {str(e)}",
                    "count": 0,
                }

        cache_key_params = {"project_id": project_id, "type": product_type, "count": True}

        if user_id:
            cache_key_params["user_id"] = user_id

        cached_result = self._cache_service.get_or_set(
            cache_type="products", fetch_func=fetch_count, **cache_key_params
        )

        return cached_result or {
            "success": False,
            "error": "Failed to fetch product count",
            "count": 0,
        }

product_service = ProductService()
