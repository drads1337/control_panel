"""
Utility functions for generating unique IDs
"""

import random
import string

from ..core.extensions import db
from .products import Product, ProductFileConfig

def generate_config_id():
    """Generate a unique 8-character config ID with letters and numbers"""
    characters = string.ascii_uppercase + string.digits
    while True:
        config_id = "".join(random.choice(characters) for _ in range(8))

        existing_config = ProductFileConfig.query.filter_by(config_id=config_id).first()
        if not existing_config:
            return config_id

def generate_unique_project_id():
    """Generate a unique 7-digit project ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(7)])

        from .core import Project

        existing_project = Project.query.filter_by(unique_id=unique_id).first()
        if not existing_project:
            return unique_id

def generate_unique_product_id():
    """Generate a unique 7-digit product ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(7)])

        existing_product = Product.query.filter_by(unique_id=unique_id).first()
        if not existing_product:
            return unique_id
