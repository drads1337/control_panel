"""
Integration tests for project isolation (IDOR prevention)

These tests verify that users from one project cannot access data from another project.
This is critical for multi-tenant security.
"""

import pytest
from flask import Flask
from flask_jwt_extended import create_access_token

from backend.models.core import Project, User
from backend.models.products import Product
from backend.models.keys import Key

@pytest.fixture
def project1(db_session) -> Project:
    """Create first test project"""
    from datetime import datetime
    project = Project(
        name="Test Project 1",
        status="active",
        created_at=datetime.utcnow(),
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project

@pytest.fixture
def project2(db_session) -> Project:
    """Create second test project"""
    from datetime import datetime
    project = Project(
        name="Test Project 2",
        status="active",
        created_at=datetime.utcnow(),
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project

@pytest.fixture
def user1(db_session, project1: Project) -> User:
    """Create user in project 1"""
    from werkzeug.security import generate_password_hash
    from datetime import datetime

    user = User(
        username="user1",
        email="user1@test.com",
        password=generate_password_hash("password123"),
        project_id=project1.id,
        created_at=datetime.utcnow(),
        total_keys=0,
        active_keys=0,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def user2(db_session, project2: Project) -> User:
    """Create user in project 2"""
    from werkzeug.security import generate_password_hash
    from datetime import datetime

    user = User(
        username="user2",
        email="user2@test.com",
        password=generate_password_hash("password123"),
        project_id=project2.id,
        created_at=datetime.utcnow(),
        total_keys=0,
        active_keys=0,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def product1(db_session, project1: Project) -> Product:
    """Create product in project 1"""
    from datetime import datetime
    product = Product(
        name="Product 1",
        project_id=project1.id,
        status="active",
        created_at=datetime.utcnow(),
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product

@pytest.fixture
def product2(db_session, project2: Project) -> Product:
    """Create product in project 2"""
    from datetime import datetime
    product = Product(
        name="Product 2",
        project_id=project2.id,
        status="active",
        created_at=datetime.utcnow(),
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product

@pytest.fixture
def key1(db_session, project1: Project, product1: Product) -> Key:
    """Create key in project 1"""
    from datetime import datetime
    key = Key(
        key="TEST-KEY-1-12345678901234567890",
        project_id=project1.id,
        product_id=product1.id,
        status=1,
        created_at=datetime.utcnow(),
        max_devices=1,
    )
    db_session.add(key)
    db_session.commit()
    db_session.refresh(key)
    return key

@pytest.fixture
def key2(db_session, project2: Project, product2: Product) -> Key:
    """Create key in project 2"""
    from datetime import datetime
    key = Key(
        key="TEST-KEY-2-12345678901234567890",
        project_id=project2.id,
        product_id=product2.id,
        status=1,
        created_at=datetime.utcnow(),
        max_devices=1,
    )
    db_session.add(key)
    db_session.commit()
    db_session.refresh(key)
    return key

@pytest.fixture
def auth_headers_user1(user1: User, app: Flask):
    """Create auth headers for user1"""
    with app.app_context():
        access_token = create_access_token(identity=str(user1.id))
        return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def auth_headers_user2(user2: User, app: Flask):
    """Create auth headers for user2"""
    with app.app_context():
        access_token = create_access_token(identity=str(user2.id))
        return {"Authorization": f"Bearer {access_token}"}

class TestProjectIsolation:
    """Test project isolation for various endpoints"""

    def test_user_cannot_access_other_project(self, client, auth_headers_user1, project2: Project):
        """Test that user from project1 cannot access project2"""
        response = client.get(
            f"/api/projects/{project2.id}",
            headers=auth_headers_user1
        )

        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}. Response: {response.get_json()}"

    def test_user_cannot_update_other_project(self, client, auth_headers_user1, project2: Project):
        """Test that user from project1 cannot update project2"""
        response = client.put(
            f"/api/projects/{project2.id}",
            headers=auth_headers_user1,
            json={"name": "Hacked Project"}
        )

        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}. Response: {response.get_json()}"

    def test_user_cannot_access_other_project_product(self, client, auth_headers_user1, product2: Product):
        """Test that user from project1 cannot access product from project2"""
        response = client.get(
            f"/api/products/{product2.id}",
            headers=auth_headers_user1
        )

        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}. Response: {response.get_json()}"

    def test_user_cannot_update_other_project_product(self, client, auth_headers_user1, product2: Product):
        """Test that user from project1 cannot update product from project2"""
        response = client.put(
            f"/api/products/{product2.id}",
            headers=auth_headers_user1,
            json={"name": "Hacked Product"}
        )

        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}. Response: {response.get_json()}"

    def test_user_cannot_access_other_project_key(self, client, auth_headers_user1, key2: Key):
        """Test that user from project1 cannot access key from project2"""
        response = client.get(
            f"/api/keys/{key2.id}",
            headers=auth_headers_user1
        )

        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}. Response: {response.get_json()}"

    def test_user_cannot_update_other_project_key(self, client, auth_headers_user1, key2: Key):
        """Test that user from project1 cannot update key from project2"""
        response = client.put(
            f"/api/keys/{key2.id}",
            headers=auth_headers_user1,
            json={"status": 0}
        )

        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}. Response: {response.get_json()}"

    def test_user_cannot_delete_other_project_key(self, client, auth_headers_user1, key2: Key):
        """Test that user from project1 cannot delete key from project2"""
        response = client.delete(
            f"/api/keys/{key2.id}",
            headers=auth_headers_user1
        )

        assert response.status_code in [403, 404], \
            f"Expected 403 or 404, got {response.status_code}. Response: {response.get_json()}"

    def test_user_can_access_own_project(self, client, auth_headers_user1, project1: Project):
        """Test that user can access their own project"""
        response = client.get(
            f"/api/projects/{project1.id}",
            headers=auth_headers_user1
        )
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}. Response: {response.get_json()}"

    def test_user_can_access_own_project_product(self, client, auth_headers_user1, product1: Product):
        """Test that user can access product from their own project"""
        response = client.get(
            f"/api/products/{product1.id}",
            headers=auth_headers_user1
        )
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}. Response: {response.get_json()}"

    def test_user_can_access_own_project_key(self, client, auth_headers_user1, key1: Key):
        """Test that user can access key from their own project"""
        response = client.get(
            f"/api/keys/{key1.id}",
            headers=auth_headers_user1
        )
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}. Response: {response.get_json()}"

    def test_keys_list_filtered_by_project(self, client, auth_headers_user1, key1: Key, key2: Key):
        """Test that keys list only shows keys from user's project"""
        response = client.get(
            "/api/keys",
            headers=auth_headers_user1
        )
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}. Response: {response.get_json()}"

        data = response.get_json()
        keys = data.get("keys", [])
        key_ids = [k.get("id") for k in keys]

        assert key1.id in key_ids, "User's own key should be in the list"

        assert key2.id not in key_ids, "Other project's key should NOT be in the list"

    def test_products_list_filtered_by_project(self, client, auth_headers_user1, product1: Product, product2: Product):
        """Test that products list only shows products from user's project"""
        response = client.get(
            "/api/products",
            headers=auth_headers_user1
        )
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}. Response: {response.get_json()}"

        data = response.get_json()
        products = data.get("products", [])
        product_ids = [g.get("id") for g in products]

        assert product1.id in product_ids, "User's own product should be in the list"

        assert product2.id not in product_ids, "Other project's product should NOT be in the list"
