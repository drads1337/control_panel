#!/usr/bin/env python3
"""
Script to migrate from global service instances to Dependency Injection pattern.

This script:
1. Finds all global service instances (e.g., `cache_service = CacheService()`)
2. Finds all imports of these services
3. Replaces imports with `get_service()` calls
4. Updates usage in code

Usage:
    python backend/scripts/migrate_to_di.py --dry-run  # Preview changes
    python backend/scripts/migrate_to_di.py --apply   # Apply changes
"""

import ast
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict

# Service name mappings: global_instance_name -> service_container_name
SERVICE_MAPPINGS = {
    'cache_service': 'cache_service',
    'product_service': 'product_service',
    'connect_service': 'connect_service',
    'auth_service': 'auth_service',
    'user_service': 'user_crud_service',
    'rbac_service': 'rbac_service',
    'security_service': 'security_service',
    'settings_service': 'settings_service',
    'session_service': 'session_service',
    'analytics_service': 'analytics_service',
    'key_service': 'key_crud_service',
    'file_service': 'file_service',
    'balance_service': 'balance_service',
    'project_service': 'project_service',
    'server_service': 'server_service',
    'log_service': 'log_cleanup_service',
    'notification_service': 'notification_service',
    'heartbeat_service': 'heartbeat_service',
    'task_service': 'task_service',
    'dynamic_config_service': 'dynamic_config_service',
    'admin_service': 'admin_service',
    'activity_service': 'activity_service',
    'email_service': 'email_service',
    'password_reset_service': 'password_reset_service',
    'challenge_service': 'challenge_service',
    'webhook_service': 'webhook_service',
    'webhook_validation_service': 'webhook_validation_service',
    'webhook_execution_service': 'webhook_execution_service',
    'webhook_management_service': 'webhook_management_service',
    'webhook_testing_service': 'webhook_testing_service',
    'webhook_formatting_service': 'webhook_formatting_service',
    'webhook_pending_task_service': 'webhook_pending_task_service',
    'webhook_logging_service': 'webhook_logging_service',
    'webhook_crypto_service': 'webhook_crypto_service',
    'key_crud_service': 'key_crud_service',
    'key_bulk_operations_service': 'key_bulk_operations_service',
    'key_validation_service': 'key_validation_service',
    'key_status_service': 'key_status_service',
    'key_statistics_service': 'key_statistics_service',
    'key_export_service': 'key_export_service',
    'key_generation_service': 'key_generation_service',
    'key_validator': 'key_validator',
    'user_role_service': 'user_role_service',
    'user_profile_service': 'user_profile_service',
    'user_statistics_service': 'user_statistics_service',
    'user_invite_service': 'user_invite_service',
    'user_permission_service': 'user_permission_service',
    'two_factor_service': 'two_factor_service',
    'invite_service': 'invite_service',
    'project_crud_service': 'project_crud_service',
    'project_cache_service': 'project_cache_service',
    'project_invite_service': 'project_invite_service',
    'project_relationships_service': 'project_relationships_service',
    'security_monitoring_service': 'security_monitoring_service',
    'security_audit_service': 'security_audit_service',
    'security_rules_service': 'security_rules_service',
    'price_calculation_service': 'price_calculation_service',
    'cached_statistics_service': 'cached_statistics_service',
    'authorization_audit_service': 'authorization_audit_service',
    'abac_service': 'abac_service',
    'role_service': 'role_service',
    'permission_service': 'permission_service',
    'policy_engine': 'policy_engine',
    'user_relationships_service': 'user_relationships_service',
    'login_service': 'login_service',
    'auth_token_service': 'auth_token_service',
    'prometheus_metrics_reader': 'prometheus_metrics_reader',
    'request_validation_pipeline': 'request_validation_pipeline',
}

# Patterns to find global instances
GLOBAL_INSTANCE_PATTERN = re.compile(
    r'^([a-z_]+_service)\s*=\s*([A-Z][a-zA-Z0-9_]*Service)\(\)',
    re.MULTILINE
)

# Patterns to find imports
IMPORT_PATTERN = re.compile(
    r'from\s+\.\.\.services\.([a-z_]+)\s+import\s+([a-z_]+_service)',
    re.MULTILINE
)

IMPORT_PATTERN_ALT = re.compile(
    r'from\s+\.\.\.services\.([a-z_]+)\.([a-z_]+_service)\s+import\s+([a-z_]+_service)',
    re.MULTILINE
)

IMPORT_PATTERN_DIRECT = re.compile(
    r'from\s+\.\.\.services\.([a-z_]+)\s+import\s+([a-z_]+_service)',
    re.MULTILINE
)


class ServiceMigration:
    def __init__(self, backend_path: Path):
        self.backend_path = backend_path
        self.services_path = backend_path / 'services'
        self.routes_path = backend_path / 'routes'
        self.changes: List[Dict] = []
        
    def find_global_instances(self) -> Dict[str, List[Tuple[Path, int, str]]]:
        """Find all global service instances in service files."""
        instances = defaultdict(list)
        
        for service_file in self.services_path.rglob('*.py'):
            if service_file.name == '__init__.py':
                continue
                
            try:
                content = service_file.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                for i, line in enumerate(lines, 1):
                    match = GLOBAL_INSTANCE_PATTERN.match(line.strip())
                    if match:
                        service_name = match.group(1)
                        class_name = match.group(2)
                        instances[service_name].append((service_file, i, line))
            except Exception as e:
                print(f"Error reading {service_file}: {e}")
                
        return dict(instances)
    
    def find_imports(self, service_name: str) -> List[Tuple[Path, int, str]]:
        """Find all imports of a service."""
        imports = []
        
        for py_file in self.backend_path.rglob('*.py'):
            if 'scripts' in str(py_file) or '__pycache__' in str(py_file):
                continue
                
            try:
                content = py_file.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                for i, line in enumerate(lines, 1):
                    # Check various import patterns
                    if f'import {service_name}' in line or f'from' in line and service_name in line:
                        # More specific check
                        if re.search(rf'from\s+[\.\w]+\s+import\s+{service_name}\b', line):
                            imports.append((py_file, i, line))
            except Exception as e:
                print(f"Error reading {py_file}: {e}")
                
        return imports
    
    def find_usages(self, service_name: str) -> List[Tuple[Path, int, str]]:
        """Find all usages of a service (service_name.method())."""
        usages = []
        
        for py_file in self.backend_path.rglob('*.py'):
            if 'scripts' in str(py_file) or '__pycache__' in str(py_file):
                continue
                
            try:
                content = py_file.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                for i, line in enumerate(lines, 1):
                    # Pattern: service_name.method() or service_name.attribute
                    if re.search(rf'\b{service_name}\.[a-zA-Z_]', line):
                        usages.append((py_file, i, line))
            except Exception as e:
                print(f"Error reading {py_file}: {e}")
                
        return usages
    
    def remove_global_instance(self, file_path: Path, line_num: int, line: str) -> str:
        """Generate replacement for global instance line."""
        service_name = re.match(r'^([a-z_]+_service)', line.strip()).group(1)
        di_name = SERVICE_MAPPINGS.get(service_name, service_name)
        
        replacement = f"""# DEPRECATED: Global instance removed for DI pattern
# Use ServiceContainer instead:
#   from ...utils.service_helpers import get_service
#   {service_name} = get_service('{di_name}')"""
        
        return replacement
    
    def replace_import(self, file_path: Path, line: str, service_name: str) -> Tuple[str, bool]:
        """Replace import statement with get_service usage."""
        di_name = SERVICE_MAPPINGS.get(service_name, service_name)
        
        # Check if get_service is already imported
        try:
            content = file_path.read_text(encoding='utf-8')
            has_get_service = 'from ...utils.service_helpers import get_service' in content
        except:
            has_get_service = False
        
        # Remove the import line
        new_line = None  # Will be removed
        
        # Add get_service import if needed
        import_line = None
        if not has_get_service:
            import_line = 'from ...utils.service_helpers import get_service'
        
        return new_line, import_line
    
    def analyze(self) -> Dict:
        """Analyze codebase and return migration plan."""
        print("🔍 Analyzing codebase...")
        
        global_instances = self.find_global_instances()
        print(f"\n📦 Found {len(global_instances)} services with global instances:")
        
        analysis = {
            'global_instances': {},
            'imports': {},
            'usages': {},
        }
        
        for service_name, instances in global_instances.items():
            print(f"  - {service_name}: {len(instances)} instance(s)")
            analysis['global_instances'][service_name] = instances
            
            imports = self.find_imports(service_name)
            if imports:
                print(f"    → {len(imports)} import(s)")
                analysis['imports'][service_name] = imports
            
            usages = self.find_usages(service_name)
            if usages:
                print(f"    → {len(usages)} usage(s)")
                analysis['usages'][service_name] = usages
        
        return analysis
    
    def generate_migration_plan(self, analysis: Dict) -> List[Dict]:
        """Generate detailed migration plan."""
        plan = []
        
        for service_name, instances in analysis['global_instances'].items():
            di_name = SERVICE_MAPPINGS.get(service_name, service_name)
            
            # Step 1: Remove global instances
            for file_path, line_num, line in instances:
                plan.append({
                    'type': 'remove_global_instance',
                    'file': file_path,
                    'line': line_num,
                    'old': line,
                    'service': service_name,
                    'di_name': di_name,
                })
            
            # Step 2: Replace imports
            if service_name in analysis['imports']:
                for file_path, line_num, line in analysis['imports'][service_name]:
                    plan.append({
                        'type': 'remove_import',
                        'file': file_path,
                        'line': line_num,
                        'old': line,
                        'service': service_name,
                        'di_name': di_name,
                    })
            
            # Step 3: Add get_service() calls where service is used
            if service_name in analysis['usages']:
                # Group by file
                files_with_usage = defaultdict(list)
                for file_path, line_num, line in analysis['usages'][service_name]:
                    files_with_usage[file_path].append((line_num, line))
                
                for file_path, usages in files_with_usage.items():
                    # Check if service is used at module level (needs to be moved to function)
                    # For now, we'll add get_service() call before first usage
                    first_usage_line = min(usages, key=lambda x: x[0])[0]
                    plan.append({
                        'type': 'add_get_service',
                        'file': file_path,
                        'line': first_usage_line,
                        'service': service_name,
                        'di_name': di_name,
                        'usages': usages,
                    })
        
        return plan
    
    def apply_changes(self, plan: List[Dict], dry_run: bool = True):
        """Apply migration plan."""
        if dry_run:
            print("\n🔍 DRY RUN - Preview of changes:\n")
        else:
            print("\n✏️  Applying changes...\n")
        
        # Group changes by file
        file_changes = defaultdict(list)
        for change in plan:
            file_changes[change['file']].append(change)
        
        files_processed = 0
        for file_path, changes in file_changes.items():
            try:
                content = file_path.read_text(encoding='utf-8')
                lines = content.split('\n')
                new_lines = lines.copy()
                
                # Track which services need get_service() calls in this file
                services_needed = set()
                lines_to_remove = set()
                lines_to_replace = {}
                
                # First pass: collect all changes
                for change in changes:
                    change_type = change['type']
                    line_num = change.get('line', 0)
                    
                    if change_type == 'remove_global_instance':
                        if dry_run:
                            rel_path = file_path.relative_to(self.backend_path.parent)
                            print(f"  {rel_path}:{line_num}")
                            print(f"    - {change['old'].strip()}")
                            print(f"    + # [REMOVED - use get_service('{change['di_name']}')]")
                        else:
                            # Replace with comment
                            replacement = self.remove_global_instance(
                                file_path, line_num, change['old']
                            )
                            lines_to_replace[line_num - 1] = replacement
                    
                    elif change_type == 'remove_import':
                        if dry_run:
                            rel_path = file_path.relative_to(self.backend_path.parent)
                            print(f"  {rel_path}:{line_num}")
                            print(f"    - {change['old'].strip()}")
                            print(f"    + [REMOVED]")
                        else:
                            lines_to_remove.add(line_num - 1)
                            services_needed.add(change['di_name'])
                    
                    elif change_type == 'add_get_service':
                        if dry_run:
                            rel_path = file_path.relative_to(self.backend_path.parent)
                            print(f"  {rel_path}:{line_num}")
                            print(f"    + {change['service']} = get_service('{change['di_name']}')")
                            print(f"    → Before first usage")
                        else:
                            services_needed.add((change['service'], change['di_name'], line_num - 1))
                
                # Apply changes (in reverse order to preserve line numbers)
                if not dry_run:
                    # Remove lines
                    for line_idx in sorted(lines_to_remove, reverse=True):
                        del new_lines[line_idx]
                    
                    # Replace lines
                    for line_idx, replacement in lines_to_replace.items():
                        new_lines[line_idx] = replacement
                    
                    # Add get_service() calls before first usage
                    for service_info in sorted(services_needed, key=lambda x: x[2] if isinstance(x, tuple) else 0):
                        if isinstance(service_info, tuple):
                            service_var, di_name, line_idx = service_info
                            # Get indentation from the line where service is used
                            if line_idx < len(new_lines):
                                indent = len(new_lines[line_idx]) - len(new_lines[line_idx].lstrip())
                                # But if it's at module level, use 0 indent
                                if indent == 0 and not new_lines[line_idx].strip().startswith('def ') and not new_lines[line_idx].strip().startswith('class '):
                                    # Module level - add at top of file after imports
                                    insert_pos = 0
                                    for i, line in enumerate(new_lines):
                                        if line.strip().startswith('def ') or line.strip().startswith('class '):
                                            insert_pos = i
                                            break
                                    new_lines.insert(insert_pos, f"{service_var} = get_service('{di_name}')")
                                else:
                                    # Function level - add before usage
                                    new_lines.insert(line_idx, ' ' * indent + f"{service_var} = get_service('{di_name}')")
                    
                    # Add get_service import if needed
                    if services_needed:
                        has_import = any('from ...utils.service_helpers import get_service' in line for line in new_lines)
                        if not has_import:
                            # Find insertion point (after other imports)
                            insert_pos = 0
                            for i, line in enumerate(new_lines):
                                if line.strip().startswith('from ') or line.strip().startswith('import '):
                                    insert_pos = i + 1
                                elif line.strip() and not line.strip().startswith('#') and insert_pos > 0:
                                    break
                            new_lines.insert(insert_pos, 'from ...utils.service_helpers import get_service')
                    
                    file_path.write_text('\n'.join(new_lines), encoding='utf-8')
                    files_processed += 1
                    rel_path = file_path.relative_to(self.backend_path.parent)
                    print(f"  ✓ Updated {rel_path}")
            
            except Exception as e:
                rel_path = file_path.relative_to(self.backend_path.parent)
                print(f"  ✗ Error processing {rel_path}: {e}")
        
        if not dry_run:
            print(f"\n✅ Processed {files_processed} files")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate from global service instances to DI pattern')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying')
    parser.add_argument('--apply', action='store_true', help='Apply changes')
    parser.add_argument('--backend-path', type=str, default='backend', help='Path to backend directory')
    
    args = parser.parse_args()
    
    if not args.dry_run and not args.apply:
        print("❌ Please specify --dry-run or --apply")
        sys.exit(1)
    
    backend_path = Path(args.backend_path)
    if not backend_path.exists():
        print(f"❌ Backend path not found: {backend_path}")
        sys.exit(1)
    
    migrator = ServiceMigration(backend_path)
    
    # Analyze
    analysis = migrator.analyze()
    
    # Generate plan
    print("\n📋 Generating migration plan...")
    plan = migrator.generate_migration_plan(analysis)
    print(f"   {len(plan)} changes planned")
    
    # Apply
    migrator.apply_changes(plan, dry_run=args.dry_run)
    
    if args.dry_run:
        print("\n✅ Dry run complete. Use --apply to make changes.")
    else:
        print("\n✅ Migration complete!")


if __name__ == '__main__':
    main()

