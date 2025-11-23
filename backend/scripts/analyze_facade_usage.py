"""
Script to analyze facade usage in the codebase.
Helps identify where facades are used and need to be migrated to specialized services.
"""

import ast
import os
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set

class FacadeUsageAnalyzer(ast.NodeVisitor):
    """AST visitor to find facade usage."""
    
    def __init__(self):
        self.facade_imports: Dict[str, List[str]] = defaultdict(list)
        self.facade_calls: Dict[str, List[tuple]] = defaultdict(list)
        self.current_file: str = ""
        self.current_line: int = 0
        
    def visit_Import(self, node):
        """Track facade imports."""
        for alias in node.names:
            if 'facade' in alias.name.lower():
                self.facade_imports[alias.name].append(
                    f"{self.current_file}:{node.lineno}"
                )
        self.generic_visit(node)
    
    def visit_ImportFrom(self, node):
        """Track facade imports from modules."""
        if node.module and 'facade' in node.module.lower():
            for alias in node.names:
                self.facade_imports[f"{node.module}.{alias.name}"].append(
                    f"{self.current_file}:{node.lineno}"
                )
        self.generic_visit(node)
    
    def visit_Call(self, node):
        """Track facade method calls."""
        if isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name):
                var_name = node.func.value.id
                method_name = node.func.attr
                # Check if this looks like a facade call
                if var_name in ['key_service', 'user_management_service']:
                    self.facade_calls[var_name].append(
                        (method_name, self.current_file, node.lineno)
                    )
        self.generic_visit(node)
    
    def analyze_file(self, file_path: str):
        """Analyze a single Python file."""
        self.current_file = file_path
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            tree = ast.parse(content, filename=file_path)
            self.visit(tree)
        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")

def find_facade_usage():
    """Find all facade usage in the codebase."""
    backend_dir = Path(__file__).parent.parent
    analyzer = FacadeUsageAnalyzer()
    
    # Files to analyze
    routes_dir = backend_dir / "routes"
    services_dir = backend_dir / "services"
    
    # Analyze routes
    for py_file in routes_dir.rglob("*.py"):
        if py_file.name != "__init__.py":
            analyzer.analyze_file(str(py_file))
    
    # Analyze services (but skip facade files themselves)
    for py_file in services_dir.rglob("*.py"):
        if "facade" not in py_file.name.lower() and py_file.name != "__init__.py":
            analyzer.analyze_file(str(py_file))
    
    return analyzer

def generate_report():
    """Generate a report of facade usage."""
    analyzer = find_facade_usage()
    
    print("=" * 80)
    print("FACADE USAGE ANALYSIS REPORT")
    print("=" * 80)
    print()
    
    # Report facade imports
    print("FACADE IMPORTS:")
    print("-" * 80)
    if analyzer.facade_imports:
        for facade, locations in analyzer.facade_imports.items():
            print(f"\n{facade}:")
            for location in locations:
                print(f"  - {location}")
    else:
        print("No facade imports found.")
    print()
    
    # Report facade calls
    print("FACADE METHOD CALLS:")
    print("-" * 80)
    if analyzer.facade_calls:
        for facade_var, calls in analyzer.facade_calls.items():
            print(f"\n{facade_var}:")
            # Group by method
            methods = defaultdict(list)
            for method, file, line in calls:
                methods[method].append((file, line))
            
            for method, locations in sorted(methods.items()):
                print(f"  {method}():")
                for file, line in locations:
                    print(f"    - {file}:{line}")
    else:
        print("No facade method calls found.")
    print()
    
    # Summary
    print("SUMMARY:")
    print("-" * 80)
    total_imports = sum(len(locs) for locs in analyzer.facade_imports.values())
    total_calls = sum(len(calls) for calls in analyzer.facade_calls.values())
    print(f"Total facade imports: {total_imports}")
    print(f"Total facade method calls: {total_calls}")
    print()
    
    # Save detailed report to file
    report_file = backend_dir / "facade_usage_report.txt"
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("FACADE USAGE ANALYSIS REPORT\n")
        f.write("=" * 80 + "\n\n")
        
        f.write("FACADE IMPORTS:\n")
        f.write("-" * 80 + "\n")
        for facade, locations in analyzer.facade_imports.items():
            f.write(f"\n{facade}:\n")
            for location in locations:
                f.write(f"  - {location}\n")
        
        f.write("\n\nFACADE METHOD CALLS:\n")
        f.write("-" * 80 + "\n")
        for facade_var, calls in analyzer.facade_calls.items():
            f.write(f"\n{facade_var}:\n")
            methods = defaultdict(list)
            for method, file, line in calls:
                methods[method].append((file, line))
            
            for method, locations in sorted(methods.items()):
                f.write(f"  {method}():\n")
                for file, line in locations:
                    f.write(f"    - {file}:{line}\n")
    
    print(f"Detailed report saved to: {report_file}")

if __name__ == "__main__":
    backend_dir = Path(__file__).parent.parent
    generate_report()

