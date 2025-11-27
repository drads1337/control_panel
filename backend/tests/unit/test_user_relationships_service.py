"""
Unit tests for UserRelationshipsService
Tests the service that provides access to User relationships
"""

import pytest
from unittest.mock import Mock, patch

from backend.services.users.user_relationships_service import UserRelationshipsService
from backend.models.core import User, UserActivity, UserActionLog
from backend.models.keys import Key
from ...utils.service_helpers import get_service


class TestUserRelationshipsService:
    """Test suite for UserRelationshipsService"""

    @pytest.fixture
    def service(self):
        """Create service instance"""
        return UserRelationshipsService()

    @pytest.fixture
    def mock_user(self):
        """Create mock user"""
        user = Mock(spec=User)
        user.id = 1
        user.username = "testuser"
        return user

    @pytest.fixture
    def mock_activity(self):
        """Create mock activity"""
        activity = Mock(spec=UserActivity)
        activity.id = 1
        activity.user_id = 1
        activity.action = "test_action"
        return activity

    @pytest.fixture
    def mock_key(self):
        """Create mock key"""
        key = Mock(spec=Key)
        key.id = 1
        key.user_id = 1
        key.key = "test_key"
        return key

    def test_get_activities(self, service, mock_activity):
        """Test getting user activities"""
        user_relationships_service = get_service('user_relationships_service')
        with patch('backend.services.users.user_relationships_service.UserActivity') as mock_activity_model:
            mock_query = Mock()
            mock_query.order_by.return_value = mock_query
            mock_query.limit.return_value = mock_query
            mock_query.all.return_value = [mock_activity]
            mock_activity_model.query.filter_by.return_value = mock_query
            
            result = service.get_activities(1, limit=10)
            
            assert len(result) == 1
            assert result[0] == mock_activity
            mock_activity_model.query.filter_by.assert_called_once_with(user_id=1)

    def test_get_activities_no_limit(self, service, mock_activity):
        """Test getting user activities without limit"""
        with patch('backend.services.users.user_relationships_service.UserActivity') as mock_activity_model:
            mock_query = Mock()
            mock_query.order_by.return_value = mock_query
            mock_query.all.return_value = [mock_activity]
            mock_activity_model.query.filter_by.return_value = mock_query
            
            result = service.get_activities(1)
            
            assert len(result) == 1
            assert result[0] == mock_activity

    def test_get_keys(self, service, mock_key):
        """Test getting user keys"""
        with patch('backend.services.users.user_relationships_service.Key') as mock_key_model:
            mock_key_model.query.filter_by.return_value.all.return_value = [mock_key]
            
            result = service.get_keys(1)
            
            assert len(result) == 1
            assert result[0] == mock_key
            mock_key_model.query.filter_by.assert_called_once_with(user_id=1)

    def test_get_key_count(self, service):
        """Test getting key count for a user"""
        with patch('backend.services.users.user_relationships_service.Key') as mock_key_model:
            mock_key_model.query.filter_by.return_value.count.return_value = 3
            
            result = service.get_key_count(1)
            
            assert result == 3
            mock_key_model.query.filter_by.assert_called_once_with(user_id=1)

    def test_get_keys_empty(self, service):
        """Test getting keys when user has no keys"""
        with patch('backend.services.users.user_relationships_service.Key') as mock_key_model:
            mock_key_model.query.filter_by.return_value.all.return_value = []
            
            result = service.get_keys(1)
            
            assert result == []

    def test_get_activities_exception_handling(self, service):
        """Test exception handling in get_activities"""
        with patch('backend.services.users.user_relationships_service.UserActivity') as mock_activity_model:
            mock_activity_model.query.filter_by.side_effect = Exception("Database error")
            
            result = service.get_activities(1)
            
            assert result == []

    def test_get_keys_exception_handling(self, service):
        """Test exception handling in get_keys"""
        with patch('backend.services.users.user_relationships_service.Key') as mock_key_model:
            mock_key_model.query.filter_by.side_effect = Exception("Database error")
            
            result = service.get_keys(1)
            
            assert result == []

    def test_get_key_count_exception_handling(self, service):
        """Test exception handling in get_key_count"""
        with patch('backend.services.users.user_relationships_service.Key') as mock_key_model:
            mock_key_model.query.filter_by.side_effect = Exception("Database error")
            
            result = service.get_key_count(1)
            
            assert result == 0

