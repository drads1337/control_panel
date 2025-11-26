"""
Test script to verify security rules are working correctly
Run this to test if security rules are properly initialized and triggers are updating

Usage:
    python scripts/test_security_rules.py [project_id]
    or
    cd backend && python scripts/test_security_rules.py [project_id]
"""

import sys
import os

# Get the backend directory
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)

# Add backend directory to path
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Change to backend directory for proper imports
os.chdir(backend_dir)

from core.app import create_app
from core.extensions import db
from models.security import SecurityRule
from services.security.security_rules_init import security_rules_init_service

app = create_app()

with app.app_context():
    print("=" * 60)
    print("Security Rules Test")
    print("=" * 60)
    
    # Get project ID from command line or use default
    project_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    
    print(f"\nTesting security rules for project ID: {project_id}")
    
    # Ensure rules are initialized
    print("\n1. Ensuring default rules are initialized...")
    rules = security_rules_init_service.ensure_default_rules(project_id)
    print(f"   ✓ Found {len(rules)} security rules")
    
    # List all rules
    print("\n2. Current security rules:")
    for rule in rules:
        status = "ACTIVE" if rule.is_active else "INACTIVE"
        print(f"   [{status}] {rule.name}")
        print(f"      Type: {rule.rule_type}")
        print(f"      Triggers: {rule.trigger_count or 0}")
        if rule.last_triggered:
            print(f"      Last triggered: {rule.last_triggered}")
        else:
            print(f"      Last triggered: Never")
        print()
    
    # Test trigger update
    print("\n3. Testing trigger update...")
    from services.security import security_service
    
    test_rule_name = "Rate Limiting Protection"
    test_rule = SecurityRule.query.filter_by(
        name=test_rule_name,
        project_id=project_id
    ).first()
    
    if test_rule:
        old_count = test_rule.trigger_count or 0
        print(f"   Current trigger count: {old_count}")
        
        # Update trigger
        security_service._update_rule_trigger(test_rule_name, project_id)
        db.session.refresh(test_rule)
        new_count = test_rule.trigger_count or 0
        
        if new_count > old_count:
            print(f"   ✓ Trigger updated successfully for '{test_rule_name}'")
            print(f"     Count: {old_count} -> {new_count}")
            if test_rule.last_triggered:
                print(f"     Last triggered: {test_rule.last_triggered}")
        else:
            print(f"   ✗ Trigger update failed for '{test_rule_name}'")
            print(f"     Count remained: {old_count}")
    else:
        print(f"   ✗ Rule '{test_rule_name}' not found")
        print("   Make sure rules are initialized for this project")
    
    # Summary
    print("\n" + "=" * 60)
    active_count = len([r for r in rules if r.is_active])
    total_triggers = sum(r.trigger_count or 0 for r in rules)
    print(f"Summary:")
    print(f"  - Total rules: {len(rules)}")
    print(f"  - Active rules: {active_count}")
    print(f"  - Total triggers: {total_triggers}")
    print("=" * 60)
    print("Test completed!")
    print("=" * 60)

