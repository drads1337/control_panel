#!/usr/bin/env python3
"""
Scheduled Tasks Processor
Handles automatic background tasks like log cleanup
"""

import logging
import os
import sys
import time
from datetime import datetime, timedelta

import schedule
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ..config.config import Config
from ..services.logs import log_cleanup_service
from ..utils.structured_logging import get_logger

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = get_logger("scheduled_tasks")


class ScheduledTaskProcessor:
    """Processor for scheduled background tasks"""

    def __init__(self):
        self.logger = get_logger("scheduled_tasks")
        self.db_engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
        self.Session = sessionmaker(bind=self.db_engine)

    def run_log_cleanup(self):
        """Run automatic log cleanup for all projects"""
        try:
            self.logger.info("Starting scheduled log cleanup")

            # Clean up logs for all projects
            result = log_cleanup_service.cleanup_all_projects()

            if result["success"]:
                self.logger.info(
                    f"Scheduled log cleanup completed successfully",
                    projects_processed=result["projects_processed"],
                    total_deleted=result["total_deleted"],
                )
            else:
                self.logger.error(
                    f"Scheduled log cleanup failed: {result.get('error', 'Unknown error')}"
                )

        except Exception as e:
            self.logger.error(f"Error during scheduled log cleanup: {e}")

    def run_health_check(self):
        """Run system health check"""
        try:
            self.logger.info("Running scheduled health check")

            # Check database connection
            session = self.Session()
            try:
                session.execute("SELECT 1")
                self.logger.info("Database health check: OK")
            except Exception as e:
                self.logger.error(f"Database health check failed: {e}")
            finally:
                session.close()

            # Check log cleanup service
            try:
                stats = log_cleanup_service.get_cleanup_stats()
                self.logger.info(
                    f"Log cleanup stats: {stats['total_old_logs']} old logs pending cleanup"
                )
            except Exception as e:
                self.logger.error(f"Log cleanup service health check failed: {e}")

        except Exception as e:
            self.logger.error(f"Error during health check: {e}")

    def run_key_expiration_check(self):
        """Check for expired keys and trigger webhooks"""
        try:
            self.logger.info("Running key expiration check")

            from datetime import datetime

            from ..models.core import User
            from ..models.games import Game
            from ..models.keys import Key
            from ..services.webhooks import get_webhook_service

            # Find keys that expired in the last hour (to avoid duplicate notifications)
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            now = datetime.utcnow()

            expired_keys = (
                session.query(Key)
                .filter(
                    Key.expires_at <= now,
                    Key.expires_at > one_hour_ago,
                    Key.status == 1,  # Only active keys
                )
                .all()
            )

            if expired_keys:
                self.logger.info(f"Found {len(expired_keys)} expired keys")

                webhook_service = get_webhook_service()

                for key in expired_keys:
                    try:
                        # Get game info
                        game = None
                        if key.game_id:
                            game = session.query(Game).get(key.game_id)

                        # Get user info
                        user = None
                        if key.user_id:
                            user = session.query(User).get(key.user_id)

                        # Prepare webhook data
                        webhook_data = {
                            "key_id": key.id,
                            "key_value": key.key,
                            "user_id": key.user_id,
                            "username": user.username if user else None,
                            "game_id": key.game_id,
                            "game_name": game.name if game else None,
                            "duration_hours": key.duration_hours,
                            "max_devices": key.max_devices,
                            "activated_at": (
                                key.activated_at.isoformat() if key.activated_at else None
                            ),
                            "expires_at": key.expires_at.isoformat() if key.expires_at else None,
                            "expired_at": now.isoformat(),
                        }

                        # Trigger webhook
                        webhook_service.trigger_webhook("key.expired", webhook_data, key.project_id)
                        self.logger.info(f"Triggered webhook for expired key: {key.id}")

                    except Exception as e:
                        self.logger.error(
                            f"Failed to trigger webhook for expired key {key.id}: {e}"
                        )
            else:
                self.logger.info("No expired keys found")

        except Exception as e:
            self.logger.error(f"Error during key expiration check: {e}")

    def setup_schedule(self):
        """Setup scheduled tasks"""
        # Run log cleanup daily at 2 AM
        schedule.every().day.at("02:00").do(self.run_log_cleanup)

        # Run health check every 6 hours
        schedule.every(6).hours.do(self.run_health_check)

        # Run key expiration check every hour
        schedule.every().hour.do(self.run_key_expiration_check)

        self.logger.info("Scheduled tasks configured:")
        self.logger.info("- Log cleanup: Daily at 02:00")
        self.logger.info("- Health check: Every 6 hours")
        self.logger.info("- Key expiration check: Every hour")

    def run(self):
        """Main loop for scheduled tasks"""
        self.logger.info("Starting scheduled task processor")
        self.setup_schedule()

        try:
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute

        except KeyboardInterrupt:
            self.logger.info("Scheduled task processor stopped by user")
        except Exception as e:
            self.logger.error(f"Scheduled task processor error: {e}")
            raise


def main():
    """Main entry point"""
    processor = ScheduledTaskProcessor()
    processor.run()


if __name__ == "__main__":
    main()
