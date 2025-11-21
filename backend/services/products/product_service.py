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
                        "id": agent_assignment.agent.id,
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
                "id": product.id,
                "unique_id": product.unique_id,
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
                "id": product.id,
                "unique_id": product.unique_id,
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
                            "id": product.id,
                            "unique_id": product.unique_id,
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
    ) -> Tuple[Optional[Product], Optional[str]]:
        """
        Create a new product with prices

        Args:
            user: User creating the product
            product_data: Product data dictionary from validated schema

        Returns:
            Tuple of (Product object or None, error message or None)
        """
        try:

            existing_product = Product.query.filter_by(
                name=product_data["name"], project_id=user.project_id
            ).first()

            if existing_product:
                return None, "Product already exists"

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
            return new_product, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating product: {str(e)}")
            import traceback

            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return None, f"Failed to create product: {str(e)}"

    def get_product(
        self, user: User, product_id: int
    ) -> Tuple[Optional[Product], Optional[str]]:
        """
        Get a single product by ID with access control

        Args:
            user: User requesting the product
            product_id: ID of the product to retrieve

        Returns:
            Tuple of (Product object or None, error message or None)
        """
        try:

            product = Product.query.filter_by(id=product_id, project_id=user.project_id).first()

            if not product:
                return None, "Product not found or access denied"

            return product, None

        except Exception as e:
            self.logger.error(f"Error getting product {product_id}: {str(e)}")
            return None, f"Failed to get product: {str(e)}"

product_service = ProductService()
