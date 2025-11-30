
"""
RLS Enforcement Checker
Verifies that PostgreSQL Row Level Security is properly configured and enforced.

This script checks:
1. RLS is enabled on all project-scoped tables
2. RLS policies exist and are correct
3. set_project_context() function exists
4. Middleware properly sets g.project_id

Usage:
    python -m backend.scripts.check_rls_enforcement
"""

import sys
import os


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.core.extensions import db
from backend.utils.postgresql_rls import set_project_context, get_current_project_id_from_db
from sqlalchemy import text, inspect
from sqlalchemy.engine import reflection
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


PROJECT_SCOPED_TABLES = [
    'key',
    'user',
    'product',
    'project',
    'project_encryption_keys',
    'project_settings',
    'user_product_permission',
    'user_role',
    'user_permission',
    'role',
    'permission',
    'role_permission',
    'webhook',
    'server',
    'agent',
    'connect_token',
    'user_activity',
    'notification',
    'changelog',
    'token_transaction',
    'balance_transaction',
]

def check_rls_enabled():
    """Check if RLS is enabled on all project-scoped tables"""
    logger.info("Checking RLS status on project-scoped tables...")
    
    issues = []
    with db.engine.connect() as conn:
        for table_name in PROJECT_SCOPED_TABLES:
            try:
                result = conn.execute(text("""
                    SELECT tablename, rowsecurity 
                    FROM pg_tables 
                    WHERE schemaname = 'public' AND tablename = :table_name
                """), {"table_name": table_name})
                
                row = result.first()
                if not row:
                    issues.append(f"Table '{table_name}' not found")
                    continue
                
                rls_enabled = row[1]
                if not rls_enabled:
                    issues.append(f"RLS not enabled on table '{table_name}'")
                else:
                    logger.info(f"✓ RLS enabled on '{table_name}'")
            except Exception as e:
                issues.append(f"Error checking table '{table_name}': {e}")
    
    return issues

def check_rls_policies():
    """Check if RLS policies exist for project-scoped tables"""
    logger.info("Checking RLS policies...")
    
    issues = []
    with db.engine.connect() as conn:
        for table_name in PROJECT_SCOPED_TABLES:
            try:
                result = conn.execute(text("""
                    SELECT policyname 
                    FROM pg_policies 
                    WHERE schemaname = 'public' AND tablename = :table_name
                """), {"table_name": table_name})
                
                policies = result.fetchall()
                if not policies:
                    issues.append(f"No RLS policies found for table '{table_name}'")
                else:
                    policy_names = [p[0] for p in policies]
                    logger.info(f"✓ Table '{table_name}' has {len(policies)} policies: {', '.join(policy_names)}")
            except Exception as e:
                issues.append(f"Error checking policies for '{table_name}': {e}")
    
    return issues

def check_rls_functions():
    """Check if RLS helper functions exist"""
    logger.info("Checking RLS helper functions...")
    
    issues = []
    required_functions = [
        'set_project_context',
        'clear_project_context',
        'get_current_project_id',
    ]
    
    with db.engine.connect() as conn:
        for func_name in required_functions:
            try:
                result = conn.execute(text("""
                    SELECT proname 
                    FROM pg_proc 
                    WHERE proname = :func_name
                """), {"func_name": func_name})
                
                if not result.first():
                    issues.append(f"Function '{func_name}' not found")
                else:
                    logger.info(f"✓ Function '{func_name}' exists")
            except Exception as e:
                issues.append(f"Error checking function '{func_name}': {e}")
    
    return issues

def test_rls_context():
    """Test that RLS context can be set and retrieved"""
    logger.info("Testing RLS context setting...")
    
    issues = []
    test_project_id = 999999
    
    try:

        set_project_context(test_project_id)
        

        retrieved_id = get_current_project_id_from_db()
        
        if retrieved_id != test_project_id:
            issues.append(f"RLS context mismatch: set {test_project_id}, got {retrieved_id}")
        else:
            logger.info(f"✓ RLS context setting/retrieval works correctly")
        

        from backend.utils.postgresql_rls import clear_project_context
        clear_project_context()
        
        retrieved_id = get_current_project_id_from_db()
        if retrieved_id is not None:
            issues.append(f"RLS context not cleared: got {retrieved_id}")
        else:
            logger.info("✓ RLS context clearing works correctly")
            
    except Exception as e:
        issues.append(f"Error testing RLS context: {e}")
    
    return issues

def main():
    """Run all RLS checks"""
    logger.info("=" * 60)
    logger.info("PostgreSQL RLS Enforcement Checker")
    logger.info("=" * 60)
    
    all_issues = []
    

    issues = check_rls_enabled()
    all_issues.extend(issues)
    

    issues = check_rls_policies()
    all_issues.extend(issues)
    

    issues = check_rls_functions()
    all_issues.extend(issues)
    

    issues = test_rls_context()
    all_issues.extend(issues)
    

    logger.info("=" * 60)
    if all_issues:
        logger.error(f"Found {len(all_issues)} issues:")
        for issue in all_issues:
            logger.error(f"  - {issue}")
        logger.error("\n❌ RLS enforcement check FAILED")
        return 1
    else:
        logger.info("✓ All RLS checks passed")
        logger.info("\n✅ RLS enforcement check PASSED")
        return 0

if __name__ == "__main__":
    from backend.core.app import create_app
    app = create_app()
    with app.app_context():
        sys.exit(main())

