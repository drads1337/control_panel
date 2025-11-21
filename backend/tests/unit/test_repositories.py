"""
Unit tests for repositories
Tests the Repository pattern implementation with automatic project isolation
"""

import pytest
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

from backend.repositories import (
    UserRepository,
    KeyRepository,
    ProductRepository,
    ServerRepository,
    RoleRepository,
    PermissionRepository,
    UserRoleRepository,
    WebhookRepository,
    NotificationRepository,
    DeviceInfoRepository,
)
from backend.models.core import User, Project
from backend.models.keys import Key, DeviceInfo
from backend.models.products import Product
from backend.models.servers import Server
from backend.models.rbac import Role, Permission, UserRole
from backend.models.webhooks import Webhook
from backend.models.notifications import Notification


@pytest.mark.unit
class TestUserRepository:
    """Tests for UserRepository"""

    def test_get_by_id_with_project_isolation(self, db_session, test_project):
        """Test that get_by_id respects project isolation"""
        # Create users in different projects
        user1 = User(
            username="user1",
            email="user1@test.com",
            password=generate_password_hash("pass"),
            project_id=test_project.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user1)
        db_session.commit()

        # Create another project
        project2 = Project(name="project2", status="active")
        db_session.add(project2)
        db_session.commit()

        user2 = User(
            username="user2",
            email="user2@test.com",
            password=generate_password_hash("pass"),
            project_id=project2.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user2)
        db_session.commit()

        # Test isolation
        repo1 = UserRepository(project_id=test_project.id)
        found_user1 = repo1.get_by_id(user1.id)
        found_user2 = repo1.get_by_id(user2.id)

        assert found_user1 is not None
        assert found_user1.id == user1.id
        assert found_user2 is None  # Should not find user from different project

    def test_get_by_username(self, db_session, test_project):
        """Test get_by_username method"""
        user = User(
            username="testuser",
            email="test@test.com",
            password=generate_password_hash("pass"),
            project_id=test_project.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user)
        db_session.commit()

        repo = UserRepository(project_id=test_project.id)
        found = repo.get_by_username("testuser", project_id=test_project.id)

        assert found is not None
        assert found.username == "testuser"

    def test_get_active_users(self, db_session, test_project):
        """Test get_active_users method"""
        # Create active user (no expiration)
        user1 = User(
            username="active1",
            email="active1@test.com",
            password=generate_password_hash("pass"),
            project_id=test_project.id,
            expires_at=None,
            total_keys=0,
            active_keys=0,
        )
        # Create active user (future expiration)
        user2 = User(
            username="active2",
            email="active2@test.com",
            password=generate_password_hash("pass"),
            project_id=test_project.id,
            expires_at=datetime.utcnow() + timedelta(days=1),
            total_keys=0,
            active_keys=0,
        )
        # Create expired user
        user3 = User(
            username="expired",
            email="expired@test.com",
            password=generate_password_hash("pass"),
            project_id=test_project.id,
            expires_at=datetime.utcnow() - timedelta(days=1),
            total_keys=0,
            active_keys=0,
        )
        db_session.add_all([user1, user2, user3])
        db_session.commit()

        repo = UserRepository(project_id=test_project.id)
        active_users = repo.get_active_users()

        assert len(active_users) == 2
        usernames = {u.username for u in active_users}
        assert "active1" in usernames
        assert "active2" in usernames
        assert "expired" not in usernames

    def test_create_user(self, db_session, test_project):
        """Test create method automatically sets project_id"""
        repo = UserRepository(project_id=test_project.id)
        user = repo.create(
            username="newuser",
            email="new@test.com",
            password=generate_password_hash("pass"),
            total_keys=0,
            active_keys=0,
        )

        assert user is not None
        assert user.project_id == test_project.id
        assert user.username == "newuser"

    def test_update_user(self, db_session, test_project):
        """Test update method"""
        user = User(
            username="updateuser",
            email="update@test.com",
            password=generate_password_hash("pass"),
            project_id=test_project.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user)
        db_session.commit()

        repo = UserRepository(project_id=test_project.id)
        updated = repo.update(user.id, email="updated@test.com")

        assert updated is not None
        assert updated.email == "updated@test.com"

    def test_delete_user(self, db_session, test_project):
        """Test delete method"""
        user = User(
            username="deleteuser",
            email="delete@test.com",
            password=generate_password_hash("pass"),
            project_id=test_project.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add(user)
        db_session.commit()

        repo = UserRepository(project_id=test_project.id)
        result = repo.delete(user.id)

        assert result is True
        assert repo.get_by_id(user.id) is None


@pytest.mark.unit
class TestKeyRepository:
    """Tests for KeyRepository"""

    def test_get_by_key_value(self, db_session, test_project):
        """Test get_by_key_value method"""
        key = Key(
            key="TEST-KEY-12345",
            project_id=test_project.id,
            status=1,
            max_devices=1,
        )
        db_session.add(key)
        db_session.commit()

        repo = KeyRepository(project_id=test_project.id)
        found = repo.get_by_key_value("TEST-KEY-12345", project_id=test_project.id)

        assert found is not None
        assert found.key == "TEST-KEY-12345"

    def test_get_active_keys(self, db_session, test_project):
        """Test get_active_keys method"""
        active_key = Key(
            key="active-key",
            project_id=test_project.id,
            status=1,
            max_devices=1,
        )
        inactive_key = Key(
            key="inactive-key",
            project_id=test_project.id,
            status=0,
            max_devices=1,
        )
        db_session.add_all([active_key, inactive_key])
        db_session.commit()

        repo = KeyRepository(project_id=test_project.id)
        active_keys = repo.get_active_keys()

        assert len(active_keys) == 1
        assert active_keys[0].status == 1

    def test_get_by_user_id(self, db_session, test_project, test_user):
        """Test get_by_user_id method"""
        key1 = Key(
            key="key1",
            project_id=test_project.id,
            user_id=test_user.id,
            status=1,
            max_devices=1,
        )
        key2 = Key(
            key="key2",
            project_id=test_project.id,
            user_id=test_user.id,
            status=1,
            max_devices=1,
        )
        db_session.add_all([key1, key2])
        db_session.commit()

        repo = KeyRepository(project_id=test_project.id)
        user_keys = repo.get_by_user_id(test_user.id)

        assert len(user_keys) == 2
        assert all(k.user_id == test_user.id for k in user_keys)


@pytest.mark.unit
class TestProductRepository:
    """Tests for ProductRepository"""

    def test_get_by_unique_id(self, db_session, test_project):
        """Test get_by_unique_id method"""
        product = Product(
            unique_id="1234567",
            name="Test Product",
            project_id=test_project.id,
            is_active=True,
        )
        db_session.add(product)
        db_session.commit()

        repo = ProductRepository(project_id=test_project.id)
        found = repo.get_by_unique_id("1234567", project_id=test_project.id)

        assert found is not None
        assert found.unique_id == "1234567"

    def test_get_active_products(self, db_session, test_project):
        """Test get_active_products method"""
        active_product = Product(
            unique_id="1111111",
            name="Active Product",
            project_id=test_project.id,
            is_active=True,
        )
        inactive_product = Product(
            unique_id="2222222",
            name="Inactive Product",
            project_id=test_project.id,
            is_active=False,
        )
        db_session.add_all([active_product, inactive_product])
        db_session.commit()

        repo = ProductRepository(project_id=test_project.id)
        active_products = repo.get_active_products()

        assert len(active_products) == 1
        assert active_products[0].is_active is True

    def test_get_multi_app_products(self, db_session, test_project):
        """Test get_multi_app_products method"""
        multi_app = Product(
            unique_id="3333333",
            name="Multi App",
            project_id=test_project.id,
            is_multi_app=True,
        )
        regular = Product(
            unique_id="4444444",
            name="Regular Product",
            project_id=test_project.id,
            is_multi_app=False,
        )
        db_session.add_all([multi_app, regular])
        db_session.commit()

        repo = ProductRepository(project_id=test_project.id)
        multi_apps = repo.get_multi_app_products()

        assert len(multi_apps) == 1
        assert multi_apps[0].is_multi_app is True


@pytest.mark.unit
class TestServerRepository:
    """Tests for ServerRepository"""

    def test_get_by_name(self, db_session, test_project):
        """Test get_by_name method"""
        server = Server(
            name="Test Server",
            ip_address="192.168.1.1",
            username="admin",
            password="encrypted_pass",
            project_id=test_project.id,
            is_active=True,
        )
        db_session.add(server)
        db_session.commit()

        repo = ServerRepository(project_id=test_project.id)
        found = repo.get_by_name("Test Server", project_id=test_project.id)

        assert found is not None
        assert found.name == "Test Server"

    def test_get_active_servers(self, db_session, test_project):
        """Test get_active_servers method"""
        active_server = Server(
            name="Active Server",
            ip_address="192.168.1.1",
            username="admin",
            password="pass",
            project_id=test_project.id,
            is_active=True,
        )
        inactive_server = Server(
            name="Inactive Server",
            ip_address="192.168.1.2",
            username="admin",
            password="pass",
            project_id=test_project.id,
            is_active=False,
        )
        db_session.add_all([active_server, inactive_server])
        db_session.commit()

        repo = ServerRepository(project_id=test_project.id)
        active_servers = repo.get_active_servers()

        assert len(active_servers) == 1
        assert active_servers[0].is_active is True


@pytest.mark.unit
class TestRoleRepository:
    """Tests for RoleRepository"""

    def test_get_by_name(self, db_session, test_project):
        """Test get_by_name method"""
        role = Role(
            name="test_role",
            description="Test role",
            project_id=test_project.id,
            is_system_role=False,
        )
        db_session.add(role)
        db_session.commit()

        repo = RoleRepository(project_id=test_project.id)
        found = repo.get_by_name("test_role", project_id=test_project.id)

        assert found is not None
        assert found.name == "test_role"

    def test_get_system_roles(self, db_session, test_project):
        """Test get_system_roles method"""
        system_role = Role(
            name="system_role",
            description="System role",
            project_id=test_project.id,
            is_system_role=True,
        )
        custom_role = Role(
            name="custom_role",
            description="Custom role",
            project_id=test_project.id,
            is_system_role=False,
        )
        db_session.add_all([system_role, custom_role])
        db_session.commit()

        repo = RoleRepository(project_id=test_project.id)
        system_roles = repo.get_system_roles()

        assert len(system_roles) == 1
        assert system_roles[0].is_system_role is True


@pytest.mark.unit
class TestUserRoleRepository:
    """Tests for UserRoleRepository"""

    def test_get_by_user_id(self, db_session, test_project, test_user):
        """Test get_by_user_id method"""
        role = Role(
            name="test_role",
            description="Test",
            project_id=test_project.id,
            is_system_role=False,
        )
        db_session.add(role)
        db_session.commit()

        user_role = UserRole(user_id=test_user.id, role_id=role.id)
        db_session.add(user_role)
        db_session.commit()

        repo = UserRoleRepository()
        user_roles = repo.get_by_user_id(test_user.id)

        assert len(user_roles) == 1
        assert user_roles[0].user_id == test_user.id

    def test_get_by_role_id(self, db_session, test_project, test_user):
        """Test get_by_role_id method"""
        role = Role(
            name="test_role",
            description="Test",
            project_id=test_project.id,
            is_system_role=False,
        )
        db_session.add(role)
        db_session.commit()

        user_role = UserRole(user_id=test_user.id, role_id=role.id)
        db_session.add(user_role)
        db_session.commit()

        repo = UserRoleRepository()
        role_users = repo.get_by_role_id(role.id)

        assert len(role_users) == 1
        assert role_users[0].role_id == role.id


@pytest.mark.unit
class TestWebhookRepository:
    """Tests for WebhookRepository"""

    def test_get_active_webhooks(self, db_session, test_project):
        """Test get_active_webhooks method"""
        active_webhook = Webhook(
            name="Active Webhook",
            webhook_type="custom",
            url="https://example.com/webhook",
            events='["key.created"]',
            project_id=test_project.id,
            is_active=True,
        )
        inactive_webhook = Webhook(
            name="Inactive Webhook",
            webhook_type="custom",
            url="https://example.com/webhook2",
            events='["key.created"]',
            project_id=test_project.id,
            is_active=False,
        )
        db_session.add_all([active_webhook, inactive_webhook])
        db_session.commit()

        repo = WebhookRepository(project_id=test_project.id)
        active_webhooks = repo.get_active_webhooks()

        assert len(active_webhooks) == 1
        assert active_webhooks[0].is_active is True


@pytest.mark.unit
class TestNotificationRepository:
    """Tests for NotificationRepository"""

    def test_get_by_user_id(self, db_session, test_project, test_user):
        """Test get_by_user_id method"""
        notification1 = Notification(
            message="Test notification 1",
            type="info",
            user_id=test_user.id,
            project_id=test_project.id,
            is_read=False,
        )
        notification2 = Notification(
            message="Test notification 2",
            type="info",
            user_id=test_user.id,
            project_id=test_project.id,
            is_read=True,
        )
        db_session.add_all([notification1, notification2])
        db_session.commit()

        repo = NotificationRepository(project_id=test_project.id)
        notifications = repo.get_by_user_id(test_user.id)

        assert len(notifications) == 2

    def test_get_unread_count(self, db_session, test_project, test_user):
        """Test get_unread_count method"""
        read_notification = Notification(
            message="Read",
            type="info",
            user_id=test_user.id,
            project_id=test_project.id,
            is_read=True,
        )
        unread_notification = Notification(
            message="Unread",
            type="info",
            user_id=test_user.id,
            project_id=test_project.id,
            is_read=False,
        )
        db_session.add_all([read_notification, unread_notification])
        db_session.commit()

        repo = NotificationRepository(project_id=test_project.id)
        unread_count = repo.get_unread_count(test_user.id)

        assert unread_count == 1


@pytest.mark.unit
class TestDeviceInfoRepository:
    """Tests for DeviceInfoRepository"""

    def test_get_by_key_id(self, db_session, test_project, test_key):
        """Test get_by_key_id method"""
        device1 = DeviceInfo(
            key_id=test_key.id,
            device_id="device1",
            serial="serial1",
        )
        device2 = DeviceInfo(
            key_id=test_key.id,
            device_id="device2",
            serial="serial2",
        )
        db_session.add_all([device1, device2])
        db_session.commit()

        repo = DeviceInfoRepository()
        devices = repo.get_by_key_id(test_key.id)

        assert len(devices) == 2
        assert all(d.key_id == test_key.id for d in devices)

    def test_count_by_key_id(self, db_session, test_project, test_key):
        """Test count_by_key_id method"""
        device1 = DeviceInfo(key_id=test_key.id, device_id="device1")
        device2 = DeviceInfo(key_id=test_key.id, device_id="device2")
        db_session.add_all([device1, device2])
        db_session.commit()

        repo = DeviceInfoRepository()
        count = repo.count_by_key_id(test_key.id)

        assert count == 2


@pytest.mark.unit
class TestRepositoryProjectIsolation:
    """Tests for automatic project isolation across all repositories"""

    def test_cross_project_isolation(self, db_session):
        """Test that repositories properly isolate data between projects"""
        import time
        # Create two projects with unique names
        timestamp = int(time.time() * 1000)
        project1 = Project(name=f"project1_{timestamp}", status="active")
        project2 = Project(name=f"project2_{timestamp}", status="active")
        db_session.add_all([project1, project2])
        db_session.commit()

        # Create users in different projects with unique names
        user1 = User(
            username=f"user1_{timestamp}",
            email=f"user1_{timestamp}@test.com",
            password=generate_password_hash("pass"),
            project_id=project1.id,
            total_keys=0,
            active_keys=0,
        )
        user2 = User(
            username=f"user2_{timestamp}",
            email=f"user2_{timestamp}@test.com",
            password=generate_password_hash("pass"),
            project_id=project2.id,
            total_keys=0,
            active_keys=0,
        )
        db_session.add_all([user1, user2])
        db_session.commit()

        # Create keys in different projects with unique keys
        key1 = Key(
            key=f"key1_{timestamp}",
            project_id=project1.id,
            user_id=user1.id,
            status=1,
            max_devices=1,
        )
        key2 = Key(
            key=f"key2_{timestamp}",
            project_id=project2.id,
            user_id=user2.id,
            status=1,
            max_devices=1,
        )
        db_session.add_all([key1, key2])
        db_session.commit()

        # Test UserRepository isolation
        repo1 = UserRepository(project_id=project1.id)
        users1 = repo1.get_all()
        assert len(users1) == 1
        assert users1[0].id == user1.id

        # Test KeyRepository isolation
        key_repo1 = KeyRepository(project_id=project1.id)
        keys1 = key_repo1.get_all()
        assert len(keys1) == 1
        assert keys1[0].id == key1.id

