"""
Unit tests for ProjectRelationshipsService
Tests the service that provides access to Project relationships
"""

import pytest
from unittest.mock import Mock, patch

from backend.services.projects.project_relationships_service import ProjectRelationshipsService
from backend.models.core import Project, User
from backend.models.project_user import ProjectAdmin
from ...utils.service_helpers import get_service


class TestProjectRelationshipsService:
    """Test suite for ProjectRelationshipsService"""
    def __init__(self, project_relationships_service=None):
        """Initialize TestProjectRelationshipsService with dependencies"""
        self._project_relationships_service = project_relationships_service

    @pytest.fixture
    def service(self):
        """Create service instance"""
        return ProjectRelationshipsService()

    @pytest.fixture
    def mock_project(self):
        """Create mock project"""
        project = Mock(spec=Project)
        project.id = 1
        project.unique_id = "1234567890"
        project.name = "Test Project"
        return project

    @pytest.fixture
    def mock_user(self):
        """Create mock user"""
        user = Mock(spec=User)
        user.id = 1
        user.username = "testuser"
        user.project_id = 1
        return user

    @pytest.fixture
    def mock_admin_record(self):
        """Create mock admin record"""
        admin = Mock(spec=ProjectAdmin)
        admin.project_id = 1
        admin.admin_user_id = 1
        return admin

    def test_get_admin_user_success(self, service, mock_admin_record, mock_user):
        """Test getting admin user successfully"""
        project_relationships_service = get_service('project_relationships_service')
        with patch('backend.services.projects.project_relationships_service.ProjectAdmin') as mock_admin_model:
            mock_admin_model.query.filter_by.return_value.first.return_value = mock_admin_record
            
            with patch('backend.services.projects.project_relationships_service.User') as mock_user_model:
                mock_user_model.query.get.return_value = mock_user
                
                result = service.get_admin_user(1)
                
                assert result == mock_user
                mock_admin_model.query.filter_by.assert_called_once_with(project_id=1)
                mock_user_model.query.get.assert_called_once_with(1)

    def test_get_admin_user_not_found(self, service):
        """Test getting admin user when not found"""
        with patch('backend.services.projects.project_relationships_service.ProjectAdmin') as mock_admin_model:
            mock_admin_model.query.filter_by.return_value.first.return_value = None
            
            result = service.get_admin_user(1)
            
            assert result is None

    def test_get_admin_id_success(self, service, mock_admin_record):
        """Test getting admin ID successfully"""
        with patch('backend.services.projects.project_relationships_service.ProjectAdmin') as mock_admin_model:
            mock_admin_model.query.filter_by.return_value.first.return_value = mock_admin_record
            
            result = service.get_admin_id(1)
            
            assert result == 1
            mock_admin_model.query.filter_by.assert_called_once_with(project_id=1)

    def test_get_admin_id_not_found(self, service):
        """Test getting admin ID when not found"""
        with patch('backend.services.projects.project_relationships_service.ProjectAdmin') as mock_admin_model:
            mock_admin_model.query.filter_by.return_value.first.return_value = None
            
            result = service.get_admin_id(1)
            
            assert result is None

    def test_get_users(self, service, mock_user):
        """Test getting users for a project"""
        with patch('backend.services.projects.project_relationships_service.User') as mock_user_model:
            mock_user_model.query.filter_by.return_value.all.return_value = [mock_user]
            
            result = service.get_users(1)
            
            assert len(result) == 1
            assert result[0] == mock_user
            mock_user_model.query.filter_by.assert_called_once_with(project_id=1)

    def test_get_user_count(self, service):
        """Test getting user count for a project"""
        with patch('backend.services.projects.project_relationships_service.User') as mock_user_model:
            mock_user_model.query.filter_by.return_value.count.return_value = 5
            
            result = service.get_user_count(1)
            
            assert result == 5
            mock_user_model.query.filter_by.assert_called_once_with(project_id=1)

    def test_get_users_empty(self, service):
        """Test getting users when project has no users"""
        with patch('backend.services.projects.project_relationships_service.User') as mock_user_model:
            mock_user_model.query.filter_by.return_value.all.return_value = []
            
            result = service.get_users(1)
            
            assert result == []

    def test_get_admin_user_exception_handling(self, service):
        """Test exception handling in get_admin_user"""
        with patch('backend.services.projects.project_relationships_service.ProjectAdmin') as mock_admin_model:
            mock_admin_model.query.filter_by.side_effect = Exception("Database error")
            
            result = service.get_admin_user(1)
            
            assert result is None

    def test_get_users_exception_handling(self, service):
        """Test exception handling in get_users"""
        with patch('backend.services.projects.project_relationships_service.User') as mock_user_model:
            mock_user_model.query.filter_by.side_effect = Exception("Database error")
            
            result = service.get_users(1)
            
            assert result == []

