#!/usr/bin/env python3
"""
Simple security check script
Verifies that security rules are properly initialized and working

Usage:
    python scripts/check_security.py
    or
    cd backend && python scripts/check_security.py
"""

import sys
import os

# Get paths
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)

# Add project root to path for absolute imports
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Change to backend directory for proper imports
os.chdir(backend_dir)

def check_security_rules():
    """Check if security rules are properly set up"""
    try:
        from backend.core.extensions import db
        from backend.models.security import SecurityRule
        from backend.models.core import Project
        
        # Get all projects
        projects = Project.query.all()
        
        if not projects:
            print("⚠️  No projects found in database")
            return False
        
        print(f"Found {len(projects)} project(s)")
        print("=" * 60)
        
        all_ok = True
        for project in projects:
            print(f"\n📋 Project: {project.name} (ID: {project.id})")
            
            rules = SecurityRule.query.filter_by(project_id=project.id).all()
            
            if not rules:
                print("  ⚠️  No security rules found - rules need to be initialized")
                all_ok = False
                continue
            
            print(f"  ✓ Found {len(rules)} security rule(s)")
            
            expected_rules = [
                "Auto-block Suspicious IPs",
                "Rate Limiting Protection",
                "Failed Login Protection",
                "HWID Blacklist",
                "Geo-blocking",
                "VPN Detection",
                "Brute Force Protection",
                "Suspicious Activity Monitor",
            ]
            
            found_rules = {rule.name for rule in rules}
            missing_rules = set(expected_rules) - found_rules
            
            if missing_rules:
                print(f"  ⚠️  Missing rules: {', '.join(missing_rules)}")
                all_ok = False
            else:
                print("  ✓ All expected rules are present")
            
            # Check active rules
            active_rules = [r for r in rules if r.is_active]
            print(f"  📊 Active rules: {len(active_rules)}/{len(rules)}")
            
            # Check triggers
            rules_with_triggers = [r for r in rules if r.trigger_count and r.trigger_count > 0]
            if rules_with_triggers:
                print(f"  📈 Rules with triggers: {len(rules_with_triggers)}")
                for rule in rules_with_triggers:
                    last_triggered = rule.last_triggered.strftime("%Y-%m-%d %H:%M:%S") if rule.last_triggered else "Never"
                    print(f"     - {rule.name}: {rule.trigger_count} triggers (last: {last_triggered})")
            else:
                print("  ℹ️  No triggers yet (this is normal if no threats detected)")
            
            # Show rule details
            print("\n  📋 Rule details:")
            for rule in sorted(rules, key=lambda x: x.priority, reverse=True):
                status_icon = "✓" if rule.is_active else "○"
                trigger_info = f"{rule.trigger_count or 0} triggers"
                if rule.last_triggered:
                    trigger_info += f" (last: {rule.last_triggered.strftime('%Y-%m-%d %H:%M')})"
                print(f"     {status_icon} {rule.name} - {trigger_info}")
        
        print("\n" + "=" * 60)
        if all_ok:
            print("✅ Security rules check: PASSED")
        else:
            print("⚠️  Security rules check: NEEDS ATTENTION")
        
        return all_ok
        
    except Exception as e:
        print(f"❌ Error checking security rules: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Try to import Flask app
    try:
        from backend.core.app import create_app
        app = create_app()
        with app.app_context():
            success = check_security_rules()
            sys.exit(0 if success else 1)
    except ImportError as e:
        print(f"⚠️  Cannot import Flask app: {e}")
        print("   Make sure you're running from the backend directory:")
        print("   cd backend && python scripts/check_security.py")
        print("   or install dependencies: pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error running security check: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

