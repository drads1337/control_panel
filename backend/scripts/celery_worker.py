#!/usr/bin/env python3
"""
Celery worker startup script
Run this script to start Celery workers for processing async tasks

Usage:
    # Start worker for specific queue using production configuration
    python -m backend.scripts.celery_worker server_tasks
    python -m backend.scripts.celery_worker key_tasks
    python -m backend.scripts.celery_worker default
    
    # Start all queues (development mode)
    python -m backend.scripts.celery_worker
    
    # Or with custom options (bypasses production config):
    celery -A backend.core.celery_app.celery_app worker --loglevel=info --concurrency=4 --queues=server_tasks
"""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Initialize Flask app for context
from backend.core.app import create_app
from backend.utils.structured_logging import get_logger
from backend.config.config import Config

app = create_app()
logger = get_logger(__name__)

# Import Celery app after Flask app is created
from backend.core.celery_app import celery_app, CELERY_AVAILABLE

if __name__ == "__main__":
    if not CELERY_AVAILABLE or celery_app is None:
        logger.error("Celery is not available. Please install Celery to use async task processing.", component="celery_worker")
        sys.exit(1)
    
    # Get queue name from command line arguments
    queue_name = None
    custom_args = False
    
    # Parse arguments
    if len(sys.argv) > 1:
        first_arg = sys.argv[1]
        # Check if first argument is a valid queue name
        if first_arg in Config.CELERY_WORKER_CONFIG:
            queue_name = first_arg
            custom_args = False
        else:
            # Custom arguments provided - use them as-is
            custom_args = True
    
    if custom_args:
        # Use provided arguments, but ensure "worker" command is present
        worker_args = sys.argv[1:]  # Skip script name
        if not worker_args or worker_args[0] != "worker":
            worker_args.insert(0, "worker")
        logger.info(f"Starting Celery worker with custom arguments: {' '.join(worker_args)}", component="celery_worker")
    elif queue_name:
        # Use production configuration for specific queue
        queue_config = Config.CELERY_WORKER_CONFIG[queue_name]
        worker_args = [
            "worker",
            "--loglevel=info",
            f"--concurrency={queue_config['concurrency']}",
            f"--queues={','.join(queue_config['queues'])}",
            f"--max-tasks-per-child={queue_config.get('max_tasks_per_child', 1000)}",
        ]
        
        # Add worker name for identification
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
        # Default: start worker for all queues (development mode)
        # This is useful for development, but not recommended for production
        # In production, run separate workers for each queue
        all_queues = []
        total_concurrency = 0
        
        for queue_name, queue_config in Config.CELERY_WORKER_CONFIG.items():
            all_queues.extend(queue_config['queues'])
            total_concurrency += queue_config['concurrency']
        
        worker_args = [
            "worker",
            "--loglevel=info",
            f"--concurrency={min(total_concurrency, 8)}",  # Cap at 8 for dev mode
            f"--queues={','.join(set(all_queues))}",  # Remove duplicates
        ]
        
        logger.warning(
            "Starting Celery worker in development mode (all queues). "
            "For production, use: python -m backend.scripts.celery_worker <queue_name>",
            component="celery_worker"
        )
    
    # Start Celery worker using start() method with explicit arguments
    # This bypasses sys.argv parsing issues
    celery_app.start(worker_args)
