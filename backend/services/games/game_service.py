"""
Game Service
Provides cached access to game data and operations
"""

import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, func

from ...core.extensions import db
from ...models.core import User
from ...models.games import Game, GameExtraFile, GameFileConfig, GameFileDownload, GameKeyPrice
from ...models.keys import Key
from ...models.loaders import Loader, LoaderDownloadLog, LoaderGameAssignment
from ...services.cache import cache_service


class GameService:
    """Service for managing game data with caching"""

    def __init__(self, cache_service=None, logger=None):
        self.cache_service = cache_service
        self.logger = logger or logging.getLogger(__name__)

    @property
    def _cache_service(self):
        """Get cache service instance"""
        return self.cache_service if self.cache_service is not None else cache_service

    def get_games_cached(
        self, project_id: int, game_type: str = "all", user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get games with caching support"""

        def fetch_games():
            """Fetch games from database"""
            try:
                self.logger.info(
                    f"Fetching games from database for project {project_id}, type: {game_type}"
                )

                # Base query
                query = Game.query.filter_by(project_id=project_id)

                # Apply type filter
                if game_type == "multi_app":
                    query = query.filter_by(is_multi_app=True)
                elif game_type == "game_library":
                    query = query.filter_by(is_multi_app=False)

                games = query.all()
                self.logger.info(f"Found {len(games)} games for project {project_id}")

                games_data = []
                for game in games:
                    try:
                        game_data = self._build_game_data(game, project_id)
                        games_data.append(game_data)
                    except Exception as game_error:
                        self.logger.error(f"Error processing game {game.id}: {str(game_error)}")
                        continue

                return {
                    "success": True,
                    "games": games_data,
                    "total_count": len(games_data),
                    "filter_type": game_type,
                }

            except Exception as e:
                self.logger.error(f"Error fetching games: {str(e)}")
                return {
                    "success": False,
                    "error": f"Failed to fetch games: {str(e)}",
                    "games": [],
                    "total_count": 0,
                }

        # Use cache with project_id and game_type as cache keys
        cache_key_params = {"project_id": project_id, "type": game_type}

        # Add user_id to cache key if provided (for user-specific data)
        if user_id:
            cache_key_params["user_id"] = user_id

        # Games fetching is a heavy operation (multiple JOINs, aggregations)
        # Use smart caching which will check update markers automatically
        cached_result = self._cache_service.get_or_set(
            cache_type="games", fetch_func=fetch_games, **cache_key_params
        )

        return cached_result or {
            "success": False,
            "error": "Failed to fetch games",
            "games": [],
            "total_count": 0,
        }

    def _build_game_data(self, game: Game, project_id: int) -> Dict[str, Any]:
        """Build game data dictionary with all related information"""
        try:
            # Get prices
            prices = GameKeyPrice.query.filter_by(game_id=game.id, project_id=project_id).all()
            price_dict = {}

            for price in prices:
                if not price.period.startswith("custom_"):
                    price_dict[price.period] = price.price

            # Get backgrounds
            backgrounds = []
            if hasattr(game, "backgrounds") and game.backgrounds:
                try:
                    if isinstance(game.backgrounds, str):
                        backgrounds = json.loads(game.backgrounds)
                    else:
                        backgrounds = game.backgrounds
                except (json.JSONDecodeError, TypeError):
                    backgrounds = []

            # Get loader info for multi-app games
            loader_info = None
            if game.is_multi_app:
                loader_assignment = LoaderGameAssignment.query.filter_by(
                    game_id=game.id, project_id=project_id
                ).first()

                if loader_assignment and loader_assignment.loader:
                    loader_info = {
                        "id": loader_assignment.loader.id,
                        "name": loader_assignment.loader.name,
                        "version": loader_assignment.loader.version or "1.0.0",
                        "status": loader_assignment.loader.status or "active",
                    }

            # Get active users count
            active_users_count = (
                db.session.query(User.id)
                .join(Key, User.id == Key.user_id)
                .filter(
                    and_(
                        Key.game_id == game.id,
                        Key.project_id == project_id,
                        Key.activated_at.isnot(None),
                        Key.status == 1,
                    )
                )
                .distinct()
                .count()
            )

            # Calculate total downloads
            total_downloads = game.downloads or 0

            # Add config file downloads
            config_downloads = (
                db.session.query(GameFileDownload)
                .join(GameFileConfig, GameFileDownload.file_id == GameFileConfig.id)
                .filter(
                    and_(GameFileDownload.file_type == "config", GameFileConfig.game_id == game.id)
                )
                .count()
            )

            # Add extra file downloads
            extra_file_downloads = (
                db.session.query(GameFileDownload)
                .join(GameExtraFile, GameFileDownload.file_id == GameExtraFile.id)
                .filter(
                    and_(
                        GameFileDownload.file_type == "extra_file", GameExtraFile.game_id == game.id
                    )
                )
                .count()
            )

            total_downloads += config_downloads + extra_file_downloads

            # Add loader downloads for multi-app games
            if game.is_multi_app:
                loader_assignment = LoaderGameAssignment.query.filter_by(
                    game_id=game.id, project_id=project_id
                ).first()

                if loader_assignment:
                    loader_downloads = LoaderDownloadLog.query.filter_by(
                        loader_id=loader_assignment.loader_id
                    ).count()
                    total_downloads += loader_downloads

            # Optimized game data structure - only essential fields
            return {
                "id": game.id,
                "unique_id": game.unique_id,
                "name": game.name,
                "description": game.description or "",
                "status": game.status,
                "logo": game.logo or "",
                "banner": game.banner or "",
                "backgrounds": backgrounds,
                "file": game.loader_file or "",
                "changelog": game.changelog or "",
                "notifications": game.notifications or "",
                "prices": price_dict,
                "version": game.version or "1.0.0",
                "downloads": total_downloads,
                "activeUsers": active_users_count,
                "lastUpdate": game.created_at.strftime("%Y-%m-%d") if game.created_at else "N/A",
                "created_at": game.created_at.isoformat() if game.created_at else None,
                "is_multi_app": game.is_multi_app,
                "login_type": game.login_type or "license_generation",
                "invite_code_required": game.invite_code_required or False,
                "custom_key_prefix": game.custom_key_prefix or "",
                "key_prefix_format": game.key_prefix_format or "{name}-{duration}-{custom}",
                "loader": loader_info,
            }

        except Exception as e:
            self.logger.error(f"Error building game data for game {game.id}: {str(e)}")
            # Return minimal game data
            return {
                "id": game.id,
                "unique_id": game.unique_id,
                "name": game.name,
                "description": game.description or "",
                "status": game.status or "active",
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
                "loader": None,
            }

    def invalidate_game_cache(self, project_id: int, game_id: Optional[int] = None) -> bool:
        """Invalidate game cache for a project or specific game - INSTANT updates"""
        try:
            # Use new instant invalidation method
            deleted_count = self._cache_service.invalidate_game_instantly(project_id, game_id)

            self.logger.info(
                f"INSTANT game cache invalidation completed: {deleted_count} keys deleted"
            )
            return deleted_count > 0

        except Exception as e:
            self.logger.error(f"INSTANT game cache invalidation error: {e}")
            # Fallback to old method
            try:
                patterns = [
                    f"games:project_id={project_id}:*",
                    f"games:project_id={project_id}:type=all*",
                    f"games:project_id={project_id}:type=multi_app*",
                    f"games:project_id={project_id}:type=game_library*",
                ]

                total_deleted = 0
                for pattern in patterns:
                    deleted_count = self._cache_service.invalidate_pattern(pattern)
                    total_deleted += deleted_count

                self.logger.info(f"Fallback game cache invalidation: {total_deleted} keys deleted")
                return total_deleted > 0
            except Exception as fallback_error:
                self.logger.error(f"Fallback game cache invalidation error: {fallback_error}")
                return False

    def get_game_simple_cached(
        self, project_id: int, user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Get simplified game list with caching and instant update detection"""

        def fetch_simple_games():
            """Fetch simplified games from database"""
            try:
                from ...utils.rbac_utils import RBACManager

                # Get user for permission checking
                user = User.query.get(user_id) if user_id else None
                from ...services.rbac import rbac_service

                can_view_all = user and (
                    RBACManager.is_owner(user)
                    or rbac_service.check_permission(user.id, "games.view")
                )
                if can_view_all and RBACManager.is_owner(user):
                    games = Game.query.all()
                else:
                    games = Game.query.filter_by(project_id=project_id).all()

                games_data = []
                for game in games:
                    games_data.append(
                        {
                            "id": game.id,
                            "unique_id": game.unique_id,
                            "name": game.name,
                            "description": game.description,
                            "is_active": game.is_active,
                            "status": game.status,  # Include status for immediate updates
                            "project_id": game.project_id,
                        }
                    )

                return games_data

            except Exception as e:
                self.logger.error(f"Error fetching simple games: {e}")
                return []

        # Cache key parameters
        cache_key_params = {"project_id": project_id, "simple": True}

        if user_id:
            cache_key_params["user_id"] = user_id

        # Use smart caching - it will automatically check update markers
        cached_result = self._cache_service.get_or_set(
            cache_type="games", fetch_func=fetch_simple_games, **cache_key_params
        )

        return cached_result or []

    def create_game(
        self, user: User, game_data: Dict[str, Any]
    ) -> Tuple[Optional[Game], Optional[str]]:
        """
        Create a new game with prices

        Args:
            user: User creating the game
            game_data: Game data dictionary from validated schema

        Returns:
            Tuple of (Game object or None, error message or None)
        """
        try:
            # Check if game with same name already exists
            existing_game = Game.query.filter_by(
                name=game_data["name"], project_id=user.project_id
            ).first()

            if existing_game:
                return None, "Game already exists"

            # Create new game
            new_game = Game(
                name=game_data["name"],
                description=game_data.get("description", ""),
                status=game_data.get("status", "active"),
                is_active=game_data.get("status", "active") == "active",
                project_id=user.project_id,
                changelog=game_data.get("changelog", ""),
                notifications=game_data.get("notifications", ""),
                version=game_data.get("version", "1.0.0"),
                downloads=game_data.get("downloads", 0),
                active_users=game_data.get("activeUsers", 0),
                is_multi_app=game_data.get("is_multi_app", False),
            )

            db.session.add(new_game)
            db.session.flush()

            # Create prices if provided
            if game_data.get("prices"):
                prices_data = game_data["prices"]
                for period, price in prices_data.items():
                    if period in ["hour", "day", "week", "month"]:
                        if price is not None and price != "":
                            game_price = GameKeyPrice(
                                game_id=new_game.id,
                                period=period,
                                price=price,
                                project_id=user.project_id,
                            )
                            db.session.add(game_price)

            # Update project game counters
            if user.project_id:
                from ...utils.project_counters import increment_project_game_counters
                increment_project_game_counters(user.project_id)

            db.session.commit()

            # Invalidate game cache
            self.invalidate_game_cache(user.project_id, new_game.id)

            self.logger.info(f"Game created successfully: {new_game.id} by user {user.id}")
            return new_game, None

        except Exception as e:
            db.session.rollback()
            self.logger.error(f"Error creating game: {str(e)}")
            import traceback

            self.logger.error(f"Traceback: {traceback.format_exc()}")
            return None, f"Failed to create game: {str(e)}"

    def get_game(
        self, user: User, game_id: int
    ) -> Tuple[Optional[Game], Optional[str]]:
        """
        Get a single game by ID with access control

        Args:
            user: User requesting the game
            game_id: ID of the game to retrieve

        Returns:
            Tuple of (Game object or None, error message or None)
        """
        try:
            # Query game with project isolation
            game = Game.query.filter_by(id=game_id, project_id=user.project_id).first()

            if not game:
                return None, "Game not found or access denied"

            return game, None

        except Exception as e:
            self.logger.error(f"Error getting game {game_id}: {str(e)}")
            return None, f"Failed to get game: {str(e)}"


# Global instance
game_service = GameService()
