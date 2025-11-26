#!/usr/bin/env python3
"""
Comprehensive Security Rules Verification Script
Checks if all security rules are properly implemented and being called

Usage:
    python scripts/verify_security_rules.py [project_id]
    or
    cd backend && python scripts/verify_security_rules.py [project_id]
"""

import sys
import os
import inspect

# Get paths
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)

# Add project root to path for absolute imports
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Change to backend directory for proper imports
os.chdir(backend_dir)

def check_rule_implementation():
    """Check if security rules are properly implemented in code"""
    print("=" * 80)
    print("Security Rules Implementation Verification")
    print("=" * 80)
    
    from backend.services.security import security_service
    
    # Expected rules and their evaluation methods
    expected_rules = {
        "HWID Blacklist": {
            "method": "_evaluate_hwid_block_conditions",
            "called_in": ["check_automated_rules"],
            "status": "✅"
        },
        "Failed Login Protection": {
            "method": "_check_and_block_ip_if_needed",
            "called_in": ["record_login_attempt"],
            "status": "✅"
        },
        "Brute Force Protection": {
            "method": "_evaluate_brute_force_conditions",
            "called_in": ["check_automated_rules", "record_login_attempt"],
            "status": "✅"
        },
        "Auto-block Suspicious IPs": {
            "method": "_evaluate_threat_score_conditions",
            "called_in": ["check_automated_rules"],
            "status": "✅"
        },
        "Geo-blocking": {
            "method": "_evaluate_geo_conditions",
            "called_in": ["check_automated_rules"],
            "status": "✅"
        },
        "Rate Limiting Protection": {
            "method": "_evaluate_rate_limit_conditions",
            "called_in": ["check_automated_rules", "connect_rate_limit (middleware)"],
            "status": "✅"
        },
        "VPN Detection": {
            "method": "_evaluate_vpn_conditions",
            "called_in": ["check_automated_rules"],
            "status": "✅"
        },
        "Suspicious Activity Monitor": {
            "method": "_evaluate_behavioral_conditions",
            "called_in": ["check_automated_rules"],
            "status": "✅"
        },
    }
    
    print("\n1. Checking rule evaluation methods...")
    all_ok = True
    for rule_name, rule_info in expected_rules.items():
        method_name = rule_info["method"]
        if hasattr(security_service, method_name):
            print(f"   ✅ {rule_name}: Method '{method_name}' exists")
        else:
            print(f"   ❌ {rule_name}: Method '{method_name}' NOT FOUND")
            all_ok = False
    
    print("\n2. Checking where rules are called...")
    
    # Check check_automated_rules
    if hasattr(security_service, "check_automated_rules"):
        print("   ✅ check_automated_rules() method exists")
        
        # Check if it's called in security_checker
        try:
            from backend.services.connect.security_checker import SecurityChecker
            checker = SecurityChecker()
            if hasattr(checker, "enhanced_fingerprint_security_check"):
                source = inspect.getsource(checker.enhanced_fingerprint_security_check)
                if "check_automated_rules" in source:
                    print("   ✅ check_automated_rules() called in enhanced_fingerprint_security_check()")
                else:
                    print("   ⚠️  check_automated_rules() NOT called in enhanced_fingerprint_security_check()")
                    all_ok = False
        except Exception as e:
            print(f"   ⚠️  Could not verify security_checker: {e}")
    else:
        print("   ❌ check_automated_rules() method NOT FOUND")
        all_ok = False
    
    # Check record_login_attempt
    if hasattr(security_service, "record_login_attempt"):
        print("   ✅ record_login_attempt() method exists")
        
        # Check if it's called in auth_service
        try:
            from backend.services.auth.auth_service import AuthService
            auth_service = AuthService()
            if hasattr(auth_service, "authenticate"):
                source = inspect.getsource(auth_service.authenticate)
                if "record_login_attempt" in source:
                    print("   ✅ record_login_attempt() called in authenticate()")
                else:
                    print("   ⚠️  record_login_attempt() NOT called in authenticate()")
        except Exception as e:
            print(f"   ⚠️  Could not verify auth_service: {e}")
    else:
        print("   ❌ record_login_attempt() method NOT FOUND")
        all_ok = False
    
    # Check rate limiting middleware
    try:
        from backend.middleware.rate_limiting import connect_rate_limit
        import inspect
        source = inspect.getsource(connect_rate_limit)
        if "_update_rule_trigger" in source and "Rate Limiting Protection" in source:
            print("   ✅ Rate Limiting Protection trigger update in middleware")
        else:
            print("   ⚠️  Rate Limiting Protection trigger update NOT in middleware")
    except Exception as e:
        print(f"   ⚠️  Could not verify rate limiting middleware: {e}")
    
    print("\n3. Checking rule trigger update method...")
    if hasattr(security_service, "_update_rule_trigger"):
        print("   ✅ _update_rule_trigger() method exists")
    else:
        print("   ❌ _update_rule_trigger() method NOT FOUND")
        all_ok = False
    
    return all_ok

def check_database_rules(project_id: int = 1):
    """Check security rules in database"""
    print("\n" + "=" * 80)
    print("Security Rules Database Check")
    print("=" * 80)
    
    try:
        from backend.core.app import create_app
        from backend.models.security import SecurityRule
        from backend.services.security.security_rules_init import security_rules_init_service
        
        app = create_app()
        with app.app_context():
            # Ensure rules are initialized
            print(f"\nChecking rules for project ID: {project_id}")
            rules = security_rules_init_service.ensure_default_rules(project_id)
            
            print(f"\nFound {len(rules)} security rule(s)")
            
            expected_rule_names = [
                "Auto-block Suspicious IPs",
                "Rate Limiting Protection",
                "Failed Login Protection",
                "HWID Blacklist",
                "Geo-blocking",
                "VPN Detection",
                "Brute Force Protection",
                "Suspicious Activity Monitor",
            ]
            
            found_names = {rule.name for rule in rules}
            missing = set(expected_rule_names) - found_names
            
            if missing:
                print(f"\n❌ Missing rules: {', '.join(missing)}")
                return False
            else:
                print("\n✅ All expected rules are present")
            
            print("\nRule Status:")
            print("-" * 80)
            for rule in sorted(rules, key=lambda x: x.priority, reverse=True):
                status = "ACTIVE" if rule.is_active else "INACTIVE"
                triggers = rule.trigger_count or 0
                last_triggered = rule.last_triggered.strftime("%Y-%m-%d %H:%M:%S") if rule.last_triggered else "Never"
                
                status_icon = "✅" if rule.is_active else "○"
                print(f"{status_icon} {rule.name}")
                print(f"   Status: {status}")
                print(f"   Type: {rule.rule_type}")
                print(f"   Priority: {rule.priority}")
                print(f"   Triggers: {triggers}")
                print(f"   Last triggered: {last_triggered}")
                print()
            
            active_count = len([r for r in rules if r.is_active])
            print(f"Summary: {active_count}/{len(rules)} rules active")
            
            return True
            
    except Exception as e:
        print(f"\n❌ Error checking database rules: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main verification function"""
    print("\n" + "=" * 80)
    print("COMPREHENSIVE SECURITY RULES VERIFICATION")
    print("=" * 80)
    
    # Check implementation
    impl_ok = check_rule_implementation()
    
    # Check database (if project_id provided)
    project_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    db_ok = check_database_rules(project_id)
    
    # Final summary
    print("\n" + "=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)
    
    if impl_ok and db_ok:
        print("✅ All security rules are properly implemented and configured")
        return 0
    else:
        print("⚠️  Some issues found:")
        if not impl_ok:
            print("   - Implementation issues detected")
        if not db_ok:
            print("   - Database configuration issues detected")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nVerification interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

