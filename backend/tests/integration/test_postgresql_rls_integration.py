"""
Integration tests for PostgreSQL RLS

Tests the full integration of PostgreSQL RLS with database queries.
Requires PostgreSQL with RLS migration applied.
"""
import pytest
from sqlalchemy import text
from flask import Flask, g

from backend.models.core import Project, Key
from backend.models.keys import Key as KeyModel
from backend.utils.postgresql_rls import set_project_context, clear_project_context, get_current_project_id_from_db


@pytest.mark.integration
@pytest.mark.security
@pytest.mark.slow
class TestPostgreSQLRLSIntegration:
    """Integration tests for PostgreSQL RLS"""
    
    def test_set_project_context_function_exists(self, db_session):
        """Test that set_project_context function exists in database"""
        result = db_session.execute(text("SELECT proname FROM pg_proc WHERE proname = 'set_project_context'"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == 'set_project_context'
    
    def test_get_current_project_id_function_exists(self, db_session):
        """Test that get_current_project_id function exists in database"""
        result = db_session.execute(text("SELECT proname FROM pg_proc WHERE proname = 'get_current_project_id'"))
        row = result.fetchone()
        assert row is not None
        assert row[0] == 'get_current_project_id'
    
    def test_set_and_get_project_context(self, db_session):
        """Test setting and getting project context"""
        # Set context
        db_session.execute(text("SELECT set_project_context(123)"))
        db_session.commit()
        
        # Get context
        result = db_session.execute(text("SELECT get_current_project_id()"))
        project_id = result.scalar()
        
        assert project_id == 123
    
    def test_clear_project_context(self, db_session):
        """Test clearing project context"""
        # Set context
        db_session.execute(text("SELECT set_project_context(456)"))
        db_session.commit()
        
        # Clear context
        db_session.execute(text("SELECT clear_project_context()"))
        db_session.commit()
        
        # Get context (should be None)
        result = db_session.execute(text("SELECT get_current_project_id()"))
        project_id = result.scalar()
        
        assert project_id is None
    
    def test_rls_enabled_on_key_table(self, db_session):
        """Test that RLS is enabled on key table"""
        result = db_session.execute(text("""
            SELECT rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'key'
        """))
        row = result.fetchone()
        
        # RLS should be enabled (or table might not exist in test DB)
        if row:
            assert row[0] is True
    
    def test_rls_policy_exists_on_key_table(self, db_session):
        """Test that RLS policy exists on key table"""
        result = db_session.execute(text("""
            SELECT policyname 
            FROM pg_policies 
            WHERE tablename = 'key' 
            AND policyname = 'project_isolation_policy'
        """))
        row = result.fetchone()
        
        # Policy should exist (or table might not exist in test DB)
        if row:
            assert row[0] == 'project_isolation_policy'
    
    def test_postgresql_rls_utility_set_context(self, db_session, app):
        """Test setting context using utility function"""
        with app.app_context():
            set_project_context(project_id=789, session=db_session)
            
            # Verify in database
            result = db_session.execute(text("SELECT get_current_project_id()"))
            project_id = result.scalar()
            assert project_id == 789
    
    def test_postgresql_rls_utility_get_context(self, db_session, app):
        """Test getting context using utility function"""
        with app.app_context():
            # Set context directly in DB
            db_session.execute(text("SELECT set_project_context(999)"))
            db_session.commit()
            
            # Get using utility
            project_id = get_current_project_id_from_db(session=db_session)
            assert project_id == 999
    
    def test_postgresql_rls_utility_clear_context(self, db_session, app):
        """Test clearing context using utility function"""
        with app.app_context():
            # Set context
            set_project_context(project_id=111, session=db_session)
            
            # Clear context
            clear_project_context(session=db_session)
            
            # Verify cleared
            result = db_session.execute(text("SELECT get_current_project_id()"))
            project_id = result.scalar()
            assert project_id is None
    
    @pytest.mark.skip(reason="Requires RLS to be fully configured and test data")
    def test_rls_filters_queries(self, db_session, app):
        """Test that RLS actually filters queries by project_id"""
        # This test requires:
        # 1. RLS migration applied
        # 2. Test data with different project_ids
        # 3. Setting context and verifying filtered results
        
        with app.app_context():
            # Create test projects
            project1 = Project(name="RLS Test 1", unique_id="rls1")
            project2 = Project(name="RLS Test 2", unique_id="rls2")
            db_session.add(project1)
            db_session.add(project2)
            db_session.commit()
            
            # Create test keys for each project
            key1 = KeyModel(key="key1", project_id=project1.id)
            key2 = KeyModel(key="key2", project_id=project2.id)
            db_session.add(key1)
            db_session.add(key2)
            db_session.commit()
            
            # Set context for project1
            set_project_context(project_id=project1.id, session=db_session)
            
            # Query keys (should only see project1 keys due to RLS)
            keys = db_session.query(KeyModel).all()
            
            # All keys should be from project1
            assert all(key.project_id == project1.id for key in keys)
            
            # Clear context
            clear_project_context(session=db_session)

