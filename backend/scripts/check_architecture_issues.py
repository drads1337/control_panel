#!/usr/bin/env python3
"""
Architecture Issues Checker

This script scans the codebase for common architectural issues:
- Direct model imports in routes
- Direct .query calls in routes
- Usage of deprecated facade services
- Legacy imports
- Duplicated helper functions

Usage:
    python scripts/check_architecture_issues.py [--fix] [--verbose]
"""

import ast
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set, Tuple

# Color codes for terminal output
RED = "\033[91m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"


class ArchitectureChecker:
    """Checks for architectural issues in the codebase"""

    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.backend_dir = root_dir / "backend"
        self.routes_dir = self.backend_dir / "routes"
        self.services_dir = self.backend_dir / "services"
        
        self.issues = {
            "direct_model_imports": [],
            "direct_query_calls": [],
            "facade_usage": [],
            "legacy_imports": [],
            "duplicated_helpers": [],
            "missing_di_usage": [],
        }
        
        self.stats = {
            "files_scanned": 0,
            "routes_files": 0,
            "services_files": 0,
        }

    def check_direct_model_imports(self, file_path: Path, content: str) -> List[Dict]:
        """Check for direct model imports in routes"""
        issues = []
        
        if "routes" not in str(file_path):
            return issues
        
        # Pattern: from ..models. or from ...models.
        model_import_pattern = r"from\s+\.\.?\.?models\."
        matches = re.finditer(model_import_pattern, content)
        
        for match in matches:
            line_num = content[:match.start()].count("\n") + 1
            line_content = content.split("\n")[line_num - 1].strip()
            
            issues.append({
                "file": str(file_path.relative_to(self.root_dir)),
                "line": line_num,
                "type": "direct_model_import",
                "content": line_content,
                "severity": "high",
            })
        
        return issues

    def check_direct_query_calls(self, file_path: Path, content: str) -> List[Dict]:
        """Check for direct .query calls"""
        issues = []
        
        if "routes" not in str(file_path):
            return issues
        
        # Pattern: Model.query. or variable.query.
        query_patterns = [
            r"\w+\.query\.(get|filter|filter_by|all|first|count|paginate)",
            r"\w+\.query\.(get|filter|filter_by|all|first|count|paginate)",
        ]
        
        for pattern in query_patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                line_num = content[:match.start()].count("\n") + 1
                line_content = content.split("\n")[line_num - 1].strip()
                
                # Skip if it's in a comment or docstring
                if line_content.startswith("#") or '"""' in line_content:
                    continue
                
                issues.append({
                    "file": str(file_path.relative_to(self.root_dir)),
                    "line": line_num,
                    "type": "direct_query_call",
                    "content": line_content,
                    "severity": "high",
                })
        
        return issues

    def check_facade_usage(self, file_path: Path, content: str) -> List[Dict]:
        """Check for usage of facade services"""
        issues = []
        
        facade_patterns = [
            r"KeyServiceFacade",
            r"key_service\s*=",  # Old key_service singleton
            r"UserManagementServiceFacade",
            r"user_management_service\s*=",  # Old user_management_service singleton
        ]
        
        for pattern in facade_patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                line_num = content[:match.start()].count("\n") + 1
                line_content = content.split("\n")[line_num - 1].strip()
                
                issues.append({
                    "file": str(file_path.relative_to(self.root_dir)),
                    "line": line_num,
                    "type": "facade_usage",
                    "content": line_content,
                    "severity": "medium",
                })
        
        return issues

    def check_legacy_imports(self, file_path: Path, content: str) -> List[Dict]:
        """Check for legacy imports marked as deprecated"""
        issues = []
        
        # Check for imports from deprecated modules
        legacy_patterns = [
            r"from\s+\.\.?\.?services\.keys\.key_service\s+import",
            r"from\s+\.\.?\.?services\.users\.user_management_service\s+import",
            r"from\s+\.\.?\.?services\.users\.invite_service\s+import",
        ]
        
        for pattern in legacy_patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                line_num = content[:match.start()].count("\n") + 1
                line_content = content.split("\n")[line_num - 1].strip()
                
                issues.append({
                    "file": str(file_path.relative_to(self.root_dir)),
                    "line": line_num,
                    "type": "legacy_import",
                    "content": line_content,
                    "severity": "medium",
                })
        
        return issues

    def check_duplicated_helpers(self) -> List[Dict]:
        """Check for duplicated helper functions across files"""
        issues = []
        
        # Common duplicated functions
        duplicated_functions = {
            "find_product_by_id_or_unique_id": [],
            "find_user_by_id_or_unique_id": [],
        }
        
        for route_file in self.routes_dir.rglob("*.py"):
            if route_file.name == "__init__.py":
                continue
                
            try:
                content = route_file.read_text(encoding="utf-8")
                
                for func_name in duplicated_functions.keys():
                    if f"def {func_name}" in content:
                        duplicated_functions[func_name].append(
                            str(route_file.relative_to(self.root_dir))
                        )
            except Exception as e:
                print(f"Error reading {route_file}: {e}")
        
        for func_name, files in duplicated_functions.items():
            if len(files) > 1:
                issues.append({
                    "file": ", ".join(files),
                    "line": 0,
                    "type": "duplicated_helper",
                    "content": f"Function '{func_name}' found in {len(files)} files",
                    "severity": "low",
                })
        
        return issues

    def check_missing_di_usage(self, file_path: Path, content: str) -> List[Dict]:
        """Check if services are used without DI container"""
        issues = []
        
        if "routes" not in str(file_path):
            return issues
        
        # Check for direct service imports (old pattern)
        service_import_pattern = r"from\s+\.\.?\.?services\.\w+\s+import\s+(\w+_service)"
        matches = re.finditer(service_import_pattern, content)
        
        for match in matches:
            service_name = match.group(1)
            line_num = content[:match.start()].count("\n") + 1
            line_content = content.split("\n")[line_num - 1].strip()
            
            # Skip if it's using get_service helper
            if "get_service" in content:
                continue
            
            issues.append({
                "file": str(file_path.relative_to(self.root_dir)),
                "line": line_num,
                "type": "missing_di_usage",
                "content": line_content,
                "severity": "low",
            })
        
        return issues

    def scan_file(self, file_path: Path) -> None:
        """Scan a single file for issues"""
        if file_path.suffix != ".py":
            return
        
        try:
            content = file_path.read_text(encoding="utf-8")
            self.stats["files_scanned"] += 1
            
            if "routes" in str(file_path):
                self.stats["routes_files"] += 1
            if "services" in str(file_path):
                self.stats["services_files"] += 1
            
            # Run all checks
            self.issues["direct_model_imports"].extend(
                self.check_direct_model_imports(file_path, content)
            )
            self.issues["direct_query_calls"].extend(
                self.check_direct_query_calls(file_path, content)
            )
            self.issues["facade_usage"].extend(
                self.check_facade_usage(file_path, content)
            )
            self.issues["legacy_imports"].extend(
                self.check_legacy_imports(file_path, content)
            )
            self.issues["missing_di_usage"].extend(
                self.check_missing_di_usage(file_path, content)
            )
            
        except Exception as e:
            print(f"Error scanning {file_path}: {e}")

    def scan_directory(self, directory: Path) -> None:
        """Recursively scan directory for Python files"""
        for file_path in directory.rglob("*.py"):
            if "venv" in str(file_path) or "__pycache__" in str(file_path):
                continue
            self.scan_file(file_path)

    def run_checks(self) -> None:
        """Run all architecture checks"""
        print(f"{BLUE}Scanning codebase for architectural issues...{RESET}\n")
        
        # Scan routes directory
        if self.routes_dir.exists():
            self.scan_directory(self.routes_dir)
        
        # Scan services directory
        if self.services_dir.exists():
            self.scan_directory(self.services_dir)
        
        # Check for duplicated helpers
        self.issues["duplicated_helpers"].extend(self.check_duplicated_helpers())

    def print_report(self, verbose: bool = False) -> None:
        """Print a formatted report of all issues"""
        print(f"\n{BOLD}{'='*80}{RESET}")
        print(f"{BOLD}Architecture Issues Report{RESET}")
        print(f"{BOLD}{'='*80}{RESET}\n")
        
        # Print statistics
        print(f"{BLUE}Statistics:{RESET}")
        print(f"  Files scanned: {self.stats['files_scanned']}")
        print(f"  Routes files: {self.stats['routes_files']}")
        print(f"  Services files: {self.stats['services_files']}")
        print()
        
        # Print issues by category
        total_issues = sum(len(issues) for issues in self.issues.values())
        
        if total_issues == 0:
            print(f"{GREEN}✓ No architectural issues found!{RESET}\n")
            return
        
        print(f"{BOLD}Issues Found: {total_issues}{RESET}\n")
        
        # Group by severity
        severity_order = ["high", "medium", "low"]
        severity_colors = {"high": RED, "medium": YELLOW, "low": BLUE}
        
        for severity in severity_order:
            severity_issues = []
            for category, issues in self.issues.items():
                for issue in issues:
                    if issue["severity"] == severity:
                        severity_issues.append((category, issue))
            
            if severity_issues:
                color = severity_colors[severity]
                print(f"{color}{BOLD}{severity.upper()} Severity Issues:{RESET}")
                
                # Group by category
                by_category = defaultdict(list)
                for category, issue in severity_issues:
                    by_category[category].append(issue)
                
                for category, issues in by_category.items():
                    print(f"\n  {BOLD}{category.replace('_', ' ').title()}:{RESET} ({len(issues)} issues)")
                    
                    # Group by file
                    by_file = defaultdict(list)
                    for issue in issues:
                        by_file[issue["file"]].append(issue)
                    
                    for file_path, file_issues in sorted(by_file.items()):
                        print(f"\n    {file_path}:")
                        for issue in file_issues[:10] if not verbose else file_issues:
                            if issue["line"] > 0:
                                print(f"      Line {issue['line']}: {issue['content']}")
                            else:
                                print(f"      {issue['content']}")
                        
                        if len(file_issues) > 10 and not verbose:
                            print(f"      ... and {len(file_issues) - 10} more issues")
                
                print()
        
        # Summary by category
        print(f"{BOLD}Summary by Category:{RESET}")
        for category, issues in self.issues.items():
            if issues:
                count = len(issues)
                color = RED if count > 20 else YELLOW if count > 10 else BLUE
                print(f"  {color}{category.replace('_', ' ').title()}: {count}{RESET}")
        
        print(f"\n{BOLD}{'='*80}{RESET}\n")

    def generate_json_report(self, output_file: Path) -> None:
        """Generate a JSON report of all issues"""
        import json
        
        report = {
            "statistics": self.stats,
            "issues": {
                category: issues
                for category, issues in self.issues.items()
                if issues
            },
            "summary": {
                category: len(issues)
                for category, issues in self.issues.items()
            },
        }
        
        output_file.write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(f"{GREEN}JSON report saved to: {output_file}{RESET}")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Check codebase for architectural issues"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Show all issues in detail"
    )
    parser.add_argument(
        "--json", "-j", type=str, help="Output JSON report to file"
    )
    parser.add_argument(
        "--root", "-r", type=str, default=".", help="Root directory of project"
    )
    
    args = parser.parse_args()
    
    root_dir = Path(args.root).resolve()
    if not root_dir.exists():
        print(f"{RED}Error: Root directory does not exist: {root_dir}{RESET}")
        sys.exit(1)
    
    checker = ArchitectureChecker(root_dir)
    checker.run_checks()
    checker.print_report(verbose=args.verbose)
    
    if args.json:
        json_file = Path(args.json)
        checker.generate_json_report(json_file)
    
    # Exit with error code if issues found
    total_issues = sum(len(issues) for issues in checker.issues.values())
    if total_issues > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()

