"""
Script to analyze flask.g usage in the codebase.
Helps identify where flask.g is used and needs to be migrated to explicit parameter passing.
"""

import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Set

def analyze_flask_g_usage():
    """Analyze all flask.g usage in the codebase."""
    backend_dir = Path(__file__).parent.parent
    
    # Patterns to find
    g_import_pattern = re.compile(r'from flask import.*\bg\b')
    g_usage_pattern = re.compile(r'\bg\.(\w+)')
    g_assign_pattern = re.compile(r'\bg\.(\w+)\s*=')
    
    results = {
        'imports': defaultdict(list),
        'read_access': defaultdict(list),
        'write_access': defaultdict(list),
        'files_with_g': set(),
    }
    
    # Directories to analyze
    dirs_to_analyze = [
        backend_dir / "routes",
        backend_dir / "services",
        backend_dir / "middleware",
        backend_dir / "utils",
    ]
    
    for directory in dirs_to_analyze:
        if not directory.exists():
            continue
            
        for py_file in directory.rglob("*.py"):
            if py_file.name == "__init__.py":
                continue
            
            try:
                with open(py_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                
                file_path = str(py_file.relative_to(backend_dir))
                has_g_usage = False
                
                # Check for imports
                for i, line in enumerate(lines, 1):
                    if g_import_pattern.search(line):
                        results['imports'][file_path].append(i)
                        has_g_usage = True
                
                # Check for g.attribute usage
                for i, line in enumerate(lines, 1):
                    # Skip comments
                    if line.strip().startswith('#'):
                        continue
                    
                    # Find read access (g.attribute)
                    for match in g_usage_pattern.finditer(line):
                        attr = match.group(1)
                        # Skip if it's an assignment
                        if '=' in line and line.find('g.' + attr) < line.find('='):
                            results['write_access'][f"{file_path}:{attr}"].append(i)
                        else:
                            results['read_access'][f"{file_path}:{attr}"].append(i)
                        has_g_usage = True
                
                if has_g_usage:
                    results['files_with_g'].add(file_path)
                    
            except Exception as e:
                print(f"Error analyzing {py_file}: {e}")
    
    return results

def generate_report():
    """Generate a report of flask.g usage."""
    results = analyze_flask_g_usage()
    
    print("=" * 80)
    print("FLASK.G USAGE ANALYSIS REPORT")
    print("=" * 80)
    print()
    
    # Files using flask.g
    print(f"FILES USING FLASK.G: {len(results['files_with_g'])}")
    print("-" * 80)
    for file_path in sorted(results['files_with_g']):
        print(f"  - {file_path}")
    print()
    
    # Most common attributes
    print("MOST COMMON G.ATTRIBUTE ACCESS:")
    print("-" * 80)
    
    # Combine read and write access
    all_attributes = defaultdict(lambda: {'read': 0, 'write': 0, 'files': set()})
    
    for key, lines in results['read_access'].items():
        file_attr = key.split(':')
        if len(file_attr) == 2:
            file_path, attr = file_attr
            all_attributes[attr]['read'] += len(lines)
            all_attributes[attr]['files'].add(file_path)
    
    for key, lines in results['write_access'].items():
        file_attr = key.split(':')
        if len(file_attr) == 2:
            file_path, attr = file_attr
            all_attributes[attr]['write'] += len(lines)
            all_attributes[attr]['files'].add(file_path)
    
    # Sort by total usage
    sorted_attrs = sorted(
        all_attributes.items(),
        key=lambda x: x[1]['read'] + x[1]['write'],
        reverse=True
    )
    
    for attr, stats in sorted_attrs[:20]:  # Top 20
        total = stats['read'] + stats['write']
        print(f"g.{attr}:")
        print(f"  Total: {total} (read: {stats['read']}, write: {stats['write']})")
        print(f"  Files: {len(stats['files'])}")
        print()
    
    # Summary
    print("SUMMARY:")
    print("-" * 80)
    total_read = sum(len(lines) for lines in results['read_access'].values())
    total_write = sum(len(lines) for lines in results['write_access'].values())
    print(f"Total files using flask.g: {len(results['files_with_g'])}")
    print(f"Total read accesses: {total_read}")
    print(f"Total write accesses: {total_write}")
    print(f"Total accesses: {total_read + total_write}")
    print()
    
    # Save detailed report
    backend_dir = Path(__file__).parent.parent
    report_file = backend_dir / "flask_g_usage_report.txt"
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("FLASK.G USAGE ANALYSIS REPORT\n")
        f.write("=" * 80 + "\n\n")
        
        f.write(f"FILES USING FLASK.G: {len(results['files_with_g'])}\n")
        f.write("-" * 80 + "\n")
        for file_path in sorted(results['files_with_g']):
            f.write(f"  - {file_path}\n")
        f.write("\n")
        
        f.write("ATTRIBUTE USAGE DETAILS:\n")
        f.write("-" * 80 + "\n")
        for attr, stats in sorted_attrs:
            total = stats['read'] + stats['write']
            f.write(f"\ng.{attr}:\n")
            f.write(f"  Total: {total} (read: {stats['read']}, write: {stats['write']})\n")
            f.write(f"  Files: {len(stats['files'])}\n")
            f.write(f"  File list:\n")
            for file_path in sorted(stats['files']):
                f.write(f"    - {file_path}\n")
    
    print(f"Detailed report saved to: {report_file}")

if __name__ == "__main__":
    generate_report()

