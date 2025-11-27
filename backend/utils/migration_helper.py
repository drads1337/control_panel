"""
Migration Helper
Utilities to help identify any remaining usages of removed counter functions.

NOTE: Deprecated increment/decrement counter functions have been removed.
All code should now use CachedStatisticsService.invalidate_on_*_change() methods.

This helper can still be used to verify no legacy code remains.
"""

import re
from typing import List, Tuple, Optional
from pathlib import Path


def find_deprecated_counter_usage(codebase_path: str = "backend") -> List[Tuple[str, int, str]]:
    """
    Find any remaining usages of removed counter functions in the codebase.
    
    These functions have been removed due to race conditions. If any are found,
    they should be replaced with CachedStatisticsService.invalidate_on_*_change().
    
    Args:
        codebase_path: Root path of the codebase to search
    
    Returns:
        List of tuples: (file_path, line_number, function_name)
    """
    # These functions have been REMOVED - any usage is an error
    removed_functions = [
        "increment_project_user_counters",
        "decrement_project_user_counters",
        "increment_project_key_counters",
        "decrement_project_key_counters",
        "increment_project_product_counters",
        "decrement_project_product_counters",
        "increment_project_server_counters",
        "decrement_project_server_counters",
        "increment_user_key_counters",
        "decrement_user_key_counters",
    ]
    
    results = []
    codebase = Path(codebase_path)
    
    # Pattern to match function calls (but not definitions)
    call_patterns = {
        func: re.compile(rf"\b{func}\s*\(")
        for func in removed_functions
    }
    
    # Search Python files
    for py_file in codebase.rglob("*.py"):
        # Skip test files and migrations for now
        if "test" in str(py_file) or "migration" in str(py_file):
            continue
        
        try:
            with open(py_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    for func_name, pattern in call_patterns.items():
                        if pattern.search(line) and "def " not in line:
                            results.append((str(py_file), line_num, func_name))
        except Exception as e:
            print(f"Error reading {py_file}: {e}")
    
    return results


def generate_migration_suggestions(usage: List[Tuple[str, int, str]]) -> str:
    """
    Generate migration suggestions based on found usages.
    
    Args:
        usage: List of deprecated function usages
    
    Returns:
        Formatted string with migration suggestions
    """
    if not usage:
        return "✅ No removed counter functions found in the codebase! Migration complete."
    
    suggestions = ["\n⚠️  ERROR: Found usages of REMOVED counter functions:\n"]
    
    # Group by file
    by_file = {}
    for file_path, line_num, func_name in usage:
        if file_path not in by_file:
            by_file[file_path] = []
        by_file[file_path].append((line_num, func_name))
    
    for file_path, usages in by_file.items():
        suggestions.append(f"\n📄 {file_path}:")
        for line_num, func_name in usages:
            replacement = _get_replacement_function(func_name)
            suggestions.append(
                f"  Line {line_num}: {func_name}()"
                f" → Use {replacement} instead"
            )
    
    suggestions.append("\n📝 Fix guide:")
    suggestions.append("  1. Import: from backend.services.statistics import cached_statistics_service")
    suggestions.append("  2. Replace increment_* with: cached_statistics_service.invalidate_on_*_change()")
    suggestions.append("  3. Replace decrement_* with: cached_statistics_service.invalidate_on_*_change()")
    suggestions.append("  4. The cache invalidation triggers recalculation on next access")
    suggestions.append("\n⚠️  These functions have been REMOVED due to race conditions.")
    
    return "\n".join(suggestions)


def _get_replacement_function(deprecated_func: str) -> str:
    """Get the replacement function name for a deprecated function."""
    mapping = {
        "increment_project_user_counters": "CachedStatisticsService.invalidate_on_user_change(project_id)",
        "decrement_project_user_counters": "CachedStatisticsService.invalidate_on_user_change(project_id)",
        "increment_project_key_counters": "CachedStatisticsService.invalidate_on_key_change(user_id, project_id)",
        "decrement_project_key_counters": "CachedStatisticsService.invalidate_on_key_change(user_id, project_id)",
        "increment_project_product_counters": "CachedStatisticsService.invalidate_on_product_change(project_id)",
        "decrement_project_product_counters": "CachedStatisticsService.invalidate_on_product_change(project_id)",
        "increment_project_server_counters": "CachedStatisticsService.invalidate_on_server_change(project_id)",
        "decrement_project_server_counters": "CachedStatisticsService.invalidate_on_server_change(project_id)",
        "increment_user_key_counters": "CachedStatisticsService.invalidate_on_key_change(user_id, project_id)",
        "decrement_user_key_counters": "CachedStatisticsService.invalidate_on_key_change(user_id, project_id)",
    }
    return mapping.get(deprecated_func, "See CachedStatisticsService documentation")


if __name__ == "__main__":
    """Run migration helper to find any remaining usages of removed functions."""
    print("🔍 Scanning codebase for removed counter functions...")
    usages = find_deprecated_counter_usage()
    result = generate_migration_suggestions(usages)
    print(result)
    if usages:
        exit(1)  # Exit with error if any found

