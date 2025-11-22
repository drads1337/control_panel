#!/usr/bin/env python3
"""
Analyze key_service usage across the codebase

This script finds all places where key_service (facade) is used
and helps plan migration to specialized services.
"""

import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple

# Color codes
BLUE = "\033[94m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"


def find_key_service_usage(root_dir: Path) -> Dict[str, List[Tuple[int, str]]]:
    """Find all usages of key_service in the codebase"""
    usages = defaultdict(list)
    
    backend_dir = root_dir / "backend"
    
    for file_path in backend_dir.rglob("*.py"):
        if "venv" in str(file_path) or "__pycache__" in str(file_path):
            continue
        if "key_service_facade" in str(file_path):
            continue  # Skip the facade itself
        
        try:
            content = file_path.read_text(encoding="utf-8")
            lines = content.split("\n")
            
            # Check for imports
            for i, line in enumerate(lines, 1):
                if "key_service" in line and ("import" in line or "from" in line):
                    usages[str(file_path.relative_to(root_dir))].append(
                        (i, line.strip())
                    )
            
            # Check for method calls
            for i, line in enumerate(lines, 1):
                if "key_service." in line and not line.strip().startswith("#"):
                    # Extract method name
                    match = re.search(r"key_service\.(\w+)", line)
                    if match:
                        method = match.group(1)
                        usages[str(file_path.relative_to(root_dir))].append(
                            (i, f"{method}() - {line.strip()[:80]}")
                        )
        
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    return usages


def map_method_to_service(method: str) -> str:
    """Map facade method to specialized service"""
    mapping = {
        # CRUD operations
        "create_key": "key_crud_service",
        "get_keys": "key_crud_service",
        "get_key_details": "key_crud_service",
        "update_key": "key_crud_service",
        "delete_key": "key_crud_service",
        
        # Bulk operations
        "bulk_create_keys": "key_bulk_operations_service",
        "bulk_delete_keys": "key_bulk_operations_service",
        "bulk_reset_keys": "key_bulk_operations_service",
        "bulk_pause_keys": "key_bulk_operations_service",
        "bulk_resume_keys": "key_bulk_operations_service",
        "bulk_extend_keys": "key_bulk_operations_service",
        "bulk_pause_keys_by_product": "key_bulk_operations_service",
        "bulk_resume_keys_by_product": "key_bulk_operations_service",
        "bulk_reset_keys_by_product": "key_bulk_operations_service",
        "bulk_add_hours_by_product": "key_bulk_operations_service",
        "bulk_delete_unused_loader_keys": "key_bulk_operations_service",
        "bulk_delete_expired_loader_keys": "key_bulk_operations_service",
        
        # Status operations
        "pause_key": "key_status_service",
        "resume_key": "key_status_service",
        "reset_key": "key_status_service",
        "extend_key": "key_status_service",
        
        # Export operations
        "export_key": "key_export_service",
        "download_key": "key_export_service",
        "reveal_key": "key_export_service",
        
        # Statistics
        "get_key_stats": "key_statistics_service",
        
        # Utility
        "generate_key_string": "key_crud_service",  # Check if this exists
    }
    
    return mapping.get(method, "❓ UNKNOWN")


def print_report(usages: Dict[str, List[Tuple[int, str]]]):
    """Print a formatted report"""
    print(f"\n{BOLD}{'='*80}{RESET}")
    print(f"{BOLD}Key Service Usage Analysis{RESET}")
    print(f"{BOLD}{'='*80}{RESET}\n")
    
    total_files = len(usages)
    total_usages = sum(len(items) for items in usages.values())
    
    print(f"{BLUE}Summary:{RESET}")
    print(f"  Files using key_service: {total_files}")
    print(f"  Total usages: {total_usages}")
    print()
    
    # Group by file type
    routes_files = [f for f in usages.keys() if "routes" in f]
    tasks_files = [f for f in usages.keys() if "tasks" in f]
    other_files = [f for f in usages.keys() if f not in routes_files and f not in tasks_files]
    
    print(f"{BOLD}By Category:{RESET}")
    print(f"  {YELLOW}Routes:{RESET} {len(routes_files)} files")
    print(f"  {YELLOW}Tasks:{RESET} {len(tasks_files)} files")
    print(f"  {YELLOW}Other:{RESET} {len(other_files)} files")
    print()
    
    # Detailed report
    print(f"{BOLD}Detailed Usage:{RESET}\n")
    
    for file_path, items in sorted(usages.items()):
        print(f"{GREEN}{file_path}{RESET}")
        
        # Group by method
        methods = defaultdict(list)
        imports = []
        
        for line_num, content in items:
            if "import" in content or "from" in content:
                imports.append((line_num, content))
            else:
                # Extract method name
                match = re.search(r"(\w+)\(\)", content)
                if match:
                    method = match.group(1)
                    methods[method].append((line_num, content))
        
        if imports:
            print(f"  {BLUE}Imports:{RESET}")
            for line_num, content in imports:
                print(f"    Line {line_num}: {content}")
        
        if methods:
            print(f"  {BLUE}Method Calls:{RESET}")
            for method, calls in sorted(methods.items()):
                service = map_method_to_service(method)
                print(f"    {BOLD}{method}(){RESET} → {service} ({len(calls)} calls)")
                for line_num, content in calls[:3]:  # Show first 3
                    print(f"      Line {line_num}: {content[:70]}")
                if len(calls) > 3:
                    print(f"      ... and {len(calls) - 3} more")
        
        print()
    
    # Migration recommendations
    print(f"{BOLD}{'='*80}{RESET}")
    print(f"{BOLD}Migration Recommendations:{RESET}\n")
    
    print(f"{YELLOW}Priority 1 - Routes (High Impact):{RESET}")
    for file_path in sorted(routes_files):
        count = len(usages[file_path])
        print(f"  - {file_path} ({count} usages)")
    
    print(f"\n{YELLOW}Priority 2 - Tasks (Medium Impact):{RESET}")
    for file_path in sorted(tasks_files):
        count = len(usages[file_path])
        print(f"  - {file_path} ({count} usages)")
    
    print(f"\n{YELLOW}Priority 3 - Other:{RESET}")
    for file_path in sorted(other_files):
        count = len(usages[file_path])
        print(f"  - {file_path} ({count} usages)")
    
    print()


def main():
    """Main entry point"""
    import sys
    
    root_dir = Path(__file__).parent.parent.parent
    
    print(f"{BLUE}Analyzing key_service usage...{RESET}")
    
    usages = find_key_service_usage(root_dir)
    print_report(usages)
    
    # Exit with error code if usages found (to indicate migration needed)
    if usages:
        print(f"{YELLOW}⚠️  Migration needed: {len(usages)} files use key_service facade{RESET}\n")
        sys.exit(1)
    else:
        print(f"{GREEN}✓ No key_service usages found. Facade can be removed!{RESET}\n")
        sys.exit(0)


if __name__ == "__main__":
    main()

