
"""
Celery worker startup script
Run this script to start Celery workers for processing async tasks

IMPORTANT: Celery workers MUST run separately from the Flask API server.
- Do NOT start workers in the same process as Gunicorn/Flask
- Run workers in separate processes, containers, or systemd services
- Each worker should handle specific queues for better resource management

Usage:

    python -m backend.scripts.celery_worker server_tasks
    python -m backend.scripts.celery_worker key_tasks
    python -m backend.scripts.celery_worker default

    python -m backend.scripts.celery_worker

    celery -A backend.core.celery_app.celery_app worker --loglevel=info --concurrency=4 --queues=server_tasks

Production Deployment:
- Use systemd services (see *.service files in this directory)
- Or run in separate Docker containers
- Ensure workers have access to the same Redis, PostgreSQL, and file storage as the API
"""

import os
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.core.app import create_app
from backend.utils.structured_logging import get_logger
from backend.config.config import Config

app = create_app()
logger = get_logger(__name__)

from backend.core.celery_app import celery_app, CELERY_AVAILABLE

if __name__ == "__main__":
    if not CELERY_AVAILABLE or celery_app is None:
        logger.error("Celery is not available. Please install Celery to use async task processing.", component="celery_worker")
        sys.exit(1)

    queue_name = None
    custom_args = False

    if len(sys.argv) > 1:
        first_arg = sys.argv[1]

        if first_arg in Config.CELERY_WORKER_CONFIG:
            queue_name = first_arg
            custom_args = False
        else:

            custom_args = True

    if custom_args:

        worker_args = sys.argv[1:]
        if not worker_args or worker_args[0] != "worker":
            worker_args.insert(0, "worker")
        logger.info(f"Starting Celery worker with custom arguments: {' '.join(worker_args)}", component="celery_worker")
    elif queue_name:

        queue_config = Config.CELERY_WORKER_CONFIG[queue_name]
        worker_args = [
            "worker",
            "--loglevel=info",
            f"--concurrency={queue_config['concurrency']}",
            f"--queues={','.join(queue_config['queues'])}",
            f"--max-tasks-per-child={queue_config.get('max_tasks_per_child', 1000)}",
        ]

        worker_name = f"worker_{queue_name}@%h"
        worker_args.append(f"--hostname={worker_name}")

        logger.info(
            f"Starting Celery worker for queue '{queue_name}': "
            f"concurrency={queue_config['concurrency']}, "
            f"queues={','.join(queue_config['queues'])}, "
            f"priority={queue_config['priority']}, "
            f"description={queue_config['description']}",
            component="celery_worker"
        )
    else:

        all_queues = []
        total_concurrency = 0

        for queue_name, queue_config in Config.CELERY_WORKER_CONFIG.items():
            all_queues.extend(queue_config['queues'])
            total_concurrency += queue_config['concurrency']

        worker_args = [
            "worker",
            "--loglevel=info",
            f"--concurrency={min(total_concurrency, 8)}",
            f"--queues={','.join(set(all_queues))}",
        ]

        logger.warning(
            "Starting Celery worker in development mode (all queues). "
            "For production, use: python -m backend.scripts.celery_worker <queue_name>",
            component="celery_worker"
        )

    celery_app.start(worker_args)
