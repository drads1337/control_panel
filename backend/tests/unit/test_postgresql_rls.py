"""
Unit tests for PostgreSQL RLS utilities

Tests the PostgreSQL RLS context management without database dependencies.
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
from flask import Flask, g, has_request_context

from backend.utils.postgresql_rls import (
    set_project_context,
    clear_project_context,
    get_current_project_id_from_db,
    init_postgresql_rls
)


@pytest.mark.unit
@pytest.mark.security
class TestPostgreSQLRLS:
    """Tests for PostgreSQL RLS utilities"""
    
    @pytest.fixture
    def mock_session(self):
        """Create a mock SQLAlchemy session"""
        session = MagicMock()
        session.execute = MagicMock()
        return session
    
    @pytest.fixture
    def app_context(self):
        """Create Flask application context"""
        app = Flask(__name__)
        with app.app_context():
            yield app
    
    def test_set_project_context_with_session(self, mock_session):
        """Test setting project context with explicit session"""
        set_project_context(project_id=123, session=mock_session)
        
        # Verify execute was called with correct SQL
        mock_session.execute.assert_called_once()
        call_args = mock_session.execute.call_args
        assert 'set_project_context' in str(call_args)
    
    def test_set_project_context_none(self, mock_session):
        """Test clearing project context"""
        clear_project_context(session=mock_session)
        
        # Verify execute was called with clear function
        mock_session.execute.assert_called_once()
        call_args = mock_session.execute.call_args
        assert 'clear_project_context' in str(call_args)
    
    @patch('backend.utils.postgresql_rls.db')
    def test_set_project_context_default_session(self, mock_db, app_context):
        """Test setting project context with default session"""
        mock_session = MagicMock()
        mock_db.session = mock_session
        
        set_project_context(project_id=456)
        
        # Verify execute was called
        mock_session.execute.assert_called_once()
    
    @patch('backend.utils.postgresql_rls.db')
    def test_clear_project_context_default_session(self, mock_db, app_context):
        """Test clearing project context with default session"""
        mock_session = MagicMock()
        mock_db.session = mock_session
        
        clear_project_context()
        
        # Verify execute was called
        mock_session.execute.assert_called_once()
    
    @patch('backend.utils.postgresql_rls.db')
    def test_get_current_project_id_from_db(self, mock_db, app_context):
        """Test getting current project ID from database"""
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 789
        mock_session.execute.return_value = mock_result
        mock_db.session = mock_session
        
        project_id = get_current_project_id_from_db()
        
        assert project_id == 789
        mock_session.execute.assert_called_once()
    
    @patch('backend.utils.postgresql_rls.db')
    def test_get_current_project_id_from_db_none(self, mock_db, app_context):
        """Test getting current project ID when it's None"""
        mock_session = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = None
        mock_session.execute.return_value = mock_result
        mock_db.session = mock_session
        
        project_id = get_current_project_id_from_db()
        
        assert project_id is None
    
    @patch('backend.utils.postgresql_rls.db')
    def test_get_current_project_id_from_db_error(self, mock_db, app_context):
        """Test getting current project ID when database error occurs"""
        mock_session = MagicMock()
        mock_session.execute.side_effect = Exception("Database error")
        mock_db.session = mock_session
        
        project_id = get_current_project_id_from_db()
        
        assert project_id is None
    
    def test_set_project_context_stores_in_g(self, app_context):
        """Test that set_project_context stores project_id in Flask g"""
        with patch('backend.utils.postgresql_rls.db') as mock_db:
            mock_session = MagicMock()
            mock_db.session = mock_session
            
            set_project_context(project_id=999)
            
            assert hasattr(g, 'postgresql_rls_project_id')
            assert g.postgresql_rls_project_id == 999
    
    def test_init_postgresql_rls(self, app_context):
        """Test initializing PostgreSQL RLS"""
        app = Flask(__name__)
        
        # Should not raise
        init_postgresql_rls(app)
    
    @patch('backend.utils.postgresql_rls.db')
    def test_set_project_context_handles_exception(self, mock_db, app_context):
        """Test that set_project_context handles exceptions gracefully"""
        mock_session = MagicMock()
        mock_session.execute.side_effect = Exception("Database error")
        mock_db.session = mock_session
        
        # Should not raise, just log warning
        set_project_context(project_id=123)
    
    def test_set_project_context_none_clears_g(self, app_context):
        """Test that setting context to None clears g"""
        with patch('backend.utils.postgresql_rls.db') as mock_db:
            mock_session = MagicMock()
            mock_db.session = mock_session
            
            # Set first
            set_project_context(project_id=111)
            assert g.postgresql_rls_project_id == 111
            
            # Clear
            set_project_context(project_id=None)
            assert g.postgresql_rls_project_id is None

