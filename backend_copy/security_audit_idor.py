
"""
Security Audit Script for IDOR (Insecure Direct Object Reference) / Multi-tenancy Isolation

This script audits all endpoints to ensure they have proper project isolation protection.
It checks:
1. Presence of security decorators (@require_project_isolation, @enforce_project_scope)
2. Database queries accessing models with project_id field
3. Potential IDOR vulnerabilities where project_id filtering is missing

Usage:
    python -m backend.scripts.security_audit_idor
"""

import ast
import importlib.util
import os
import re
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict

@dataclass
class EndpointInfo:
    """Information about an endpoint"""
    file_path: str
    route_path: str
    function_name: str
    line_number: int
    decorators: List[str] = field(default_factory=list)
    has_isolation: bool = False
    has_project_scope: bool = False
    has_jwt_required: bool = False
    models_used: Set[str] = field(default_factory=set)
    potential_vulnerabilities: List[str] = field(default_factory=list)

@dataclass
class AuditResult:
    """Results of security audit"""
    endpoints_checked: int = 0
    endpoints_with_protection: int = 0
    endpoints_without_protection: int = 0
    vulnerable_endpoints: List[EndpointInfo] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    models_with_project_id: Set[str] = field(default_factory=set)

MODELS_WITH_PROJECT_ID = {

    'ProjectEncryptionKeys', 'ProjectSettings', 'User', 'UserActivity', 'ProjectInviteCode',

    'Key', 'DeviceInfo', 'ConnectToken',

    'Game', 'GameKeyPrice', 'Announcement', 'GameConfig', 'GameExtraFile', 'FileDownloadLog', 'FileMeta',

    'Server', 'ServerTask', 'ServerSession',

    'ChatMessage', 'ChatRoom', 'ChatRoomMember', 'ChatMessageReaction', 'ChatNotification',

    'Notification',

    'Webhook',

    'RemoteControlSession', 'RemoteControlCommand', 'RemoteControlFileTransfer',

    'Role', 'Permission', 'RolePermission', 'UserRole',

    'Loader', 'LoaderConfig', 'LoaderVersion', 'LoaderFile', 'LoaderLog', 'LoaderSession',

    'BlockedIP', 'BlockedHWID', 'SecurityEvent', 'LoginAttempt', 'Session', 'Fingerprint', 'SecurityRule', 'SecurityPolicy',

    'ProjectUserRole', 'ProjectAdmin',
}

ISOLATION_DECORATORS = {
    'require_project_isolation',
    'enforce_project_scope',
}

ADMIN_DECORATORS = {
    'require_owner',
    'require_auth',
}

PUBLIC_ENDPOINT_PATTERNS = [
    r'/auth/',
    r'/health',
    r'/health-check',
    r'/api/health',
    r'/connect/challenge',
    r'/test-',
]

class SecurityAuditor:
    """Audits codebase for IDOR vulnerabilities"""

    def __init__(self, routes_dir: str):
        self.routes_dir = Path(routes_dir)
        self.endpoints: List[EndpointInfo] = []
        self.models_with_project_id = MODELS_WITH_PROJECT_ID.copy()

    def is_public_endpoint(self, route_path: str) -> bool:
        """Check if endpoint is public and doesn't need project isolation"""
        for pattern in PUBLIC_ENDPOINT_PATTERNS:
            if re.search(pattern, route_path, re.IGNORECASE):
                return True
        return False

    def parse_file(self, file_path: Path) -> List[EndpointInfo]:
        """Parse a Python file and extract endpoint information"""
        endpoints = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                tree = ast.parse(content, filename=str(file_path))
        except Exception as e:
            print(f"Warning: Could not parse {file_path}: {e}")
            return []

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):

                route_info = self._extract_route_info(node, file_path, content)
                if route_info:
                    endpoints.append(route_info)

        return endpoints

    def _extract_route_info(self, node: ast.FunctionDef, file_path: Path, content: str) -> Optional[EndpointInfo]:
        """Extract route information from a function node"""
        decorators = []
        route_path = None
        methods = []

        for decorator in node.decorator_list:
            decorator_str = self._decorator_to_string(decorator)
            decorators.append(decorator_str)

            if '@' in decorator_str and 'route' in decorator_str.lower():

                if isinstance(decorator, ast.Call):
                    if isinstance(decorator.func, ast.Attribute) and decorator.func.attr == 'route':
                        if decorator.args:
                            route_path = self._get_string_value(decorator.args[0])
                        if len(decorator.args) > 1:
                            methods_arg = decorator.args[1]
                            if isinstance(methods_arg, ast.List):
                                methods = [self._get_string_value(elem) for elem in methods_arg.elts]

        if not route_path:
            return None

        decorators_str = ' '.join(decorators)
        has_isolation = any(d in decorators_str for d in ISOLATION_DECORATORS)
        has_project_scope = 'enforce_project_scope' in decorators_str
        has_jwt_required = 'jwt_required' in decorators_str

        models_used = self._find_models_in_function(node, content)

        line_number = node.lineno

        return EndpointInfo(
            file_path=str(file_path.relative_to(self.routes_dir.parent)),
            route_path=route_path or "unknown",
            function_name=node.name,
            line_number=line_number,
            decorators=decorators,
            has_isolation=has_isolation or has_project_scope,
            has_project_scope=has_project_scope,
            has_jwt_required=has_jwt_required,
            models_used=models_used,
        )

    def _decorator_to_string(self, decorator: ast.expr) -> str:
        """Convert AST decorator to string representation"""
        if isinstance(decorator, ast.Name):
            return f"@{decorator.id}"
        elif isinstance(decorator, ast.Attribute):
            return f"@{decorator.attr}"
        elif isinstance(decorator, ast.Call):
            if isinstance(decorator.func, ast.Name):
                return f"@{decorator.func.id}"
            elif isinstance(decorator.func, ast.Attribute):
                return f"@{decorator.func.attr}"
        return "@unknown"

    def _get_string_value(self, node: ast.expr) -> Optional[str]:
        """Extract string value from AST node"""
        if isinstance(node, ast.Str):
            return node.s
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            return node.value
        return None

    def _find_models_in_function(self, node: ast.FunctionDef, content: str) -> Set[str]:
        """Find model classes used in function (simplified)"""
        models = set()
        func_content = ast.get_source_segment(content, node) or ""

        for model_name in self.models_with_project_id:

            patterns = [
                f"{model_name}.query",
                f"db.session.query({model_name})",
                f"query({model_name}",
            ]
            for pattern in patterns:
                if pattern in func_content:
                    models.add(model_name)
                    break

        return models

    def audit_endpoint(self, endpoint: EndpointInfo) -> List[str]:
        """Audit a single endpoint for vulnerabilities"""
        vulnerabilities = []

        if self.is_public_endpoint(endpoint.route_path):
            return vulnerabilities

        if endpoint.models_used and not endpoint.has_isolation and endpoint.has_jwt_required:
            vulnerable_models = endpoint.models_used & self.models_with_project_id
            if vulnerable_models:
                vulnerabilities.append(
                    f"Accesses models with project_id ({', '.join(vulnerable_models)}) "
                    f"without project isolation decorator"
                )

        if endpoint.has_jwt_required and not endpoint.has_isolation:

            decorators_str = ' '.join(endpoint.decorators)
            has_admin_decorator = 'require_owner' in decorators_str or 'require_auth' in decorators_str

            is_project_endpoint = 'project' in endpoint.route_path.lower() or 'project' in endpoint.function_name.lower()

            if endpoint.models_used & self.models_with_project_id and not has_admin_decorator:
                vulnerabilities.append(
                    "Has @jwt_required but no project isolation decorator"
                )

        return vulnerabilities

    def scan_routes(self) -> AuditResult:
        """Scan all route files"""
        result = AuditResult()
        result.models_with_project_id = self.models_with_project_id.copy()

        route_files = list(self.routes_dir.rglob("*.py"))
        route_files = [f for f in route_files if not f.name.startswith('__')]

        print(f"Scanning {len(route_files)} route files...")

        for route_file in route_files:
            endpoints = self.parse_file(route_file)
            self.endpoints.extend(endpoints)

        for endpoint in self.endpoints:
            result.endpoints_checked += 1

            if endpoint.has_isolation:
                result.endpoints_with_protection += 1
            else:
                if not self.is_public_endpoint(endpoint.route_path):
                    result.endpoints_without_protection += 1

            vulnerabilities = self.audit_endpoint(endpoint)
            if vulnerabilities:
                endpoint.potential_vulnerabilities = vulnerabilities
                result.vulnerable_endpoints.append(endpoint)

        return result

    def generate_report(self, result: AuditResult) -> str:
        """Generate a detailed audit report"""
        report = []
        report.append("=" * 80)
        report.append("SECURITY AUDIT REPORT: IDOR / Multi-tenancy Isolation")
        report.append("=" * 80)
        report.append("")

        report.append("SUMMARY")
        report.append("-" * 80)
        report.append(f"Total endpoints checked: {result.endpoints_checked}")
        report.append(f"Endpoints with protection: {result.endpoints_with_protection}")
        report.append(f"Endpoints without protection: {result.endpoints_without_protection}")
        report.append(f"Potentially vulnerable endpoints: {len(result.vulnerable_endpoints)}")
        report.append("")

        if result.vulnerable_endpoints:
            report.append("POTENTIALLY VULNERABLE ENDPOINTS")
            report.append("-" * 80)
            report.append("")

            for endpoint in sorted(result.vulnerable_endpoints, key=lambda x: (x.file_path, x.line_number)):
                report.append(f"File: {endpoint.file_path}")
                report.append(f"Route: {endpoint.route_path}")
                report.append(f"Function: {endpoint.function_name} (line {endpoint.line_number})")
                report.append(f"Decorators: {', '.join(endpoint.decorators)}")
                if endpoint.models_used:
                    report.append(f"Models used: {', '.join(endpoint.models_used)}")
                report.append("Vulnerabilities:")
                for vuln in endpoint.potential_vulnerabilities:
                    report.append(f"  - {vuln}")
                report.append("")
                report.append("Recommendation:")
                if endpoint.models_used & self.models_with_project_id:
                    report.append(f"  Add @require_project_isolation or @enforce_project_scope decorator")
                    report.append(f"  Ensure all queries filter by project_id using g.project_id")
                report.append("")
                report.append("-" * 80)
                report.append("")
        else:
            report.append("✓ No vulnerable endpoints found!")
            report.append("")

        unprotected = [
            e for e in self.endpoints
            if not e.has_isolation
            and not self.is_public_endpoint(e.route_path)
            and e.has_jwt_required
        ]

        if unprotected:
            report.append("ENDPOINTS WITHOUT PROJECT ISOLATION (FOR REVIEW)")
            report.append("-" * 80)
            report.append("These endpoints require authentication but don't use project isolation decorators.")
            report.append("Verify they don't access project-scoped data or are admin-only endpoints.")
            report.append("")
            for endpoint in sorted(unprotected, key=lambda x: (x.file_path, x.line_number)):
                if endpoint not in result.vulnerable_endpoints:
                    report.append(f"  {endpoint.file_path}:{endpoint.line_number} - {endpoint.route_path} ({endpoint.function_name})")
            report.append("")

        report.append("RECOMMENDATIONS")
        report.append("-" * 80)
        report.append("1. Add @require_project_isolation to all endpoints that access project-scoped data")
        report.append("2. Use @enforce_project_scope for endpoints where owners can access multiple projects")
        report.append("3. Always filter database queries by project_id using g.project_id from decorators")
        report.append("4. Use ensure_project_isolation() utility function for manual query filtering")
        report.append("5. Add integration tests to verify project isolation for all endpoints")
        report.append("6. Consider using a base service class that automatically filters by project_id")
        report.append("")
        report.append("=" * 80)

        return "\n".join(report)

def main():
    """Main entry point"""

    script_dir = Path(__file__).parent
    backend_dir = script_dir.parent
    routes_dir = backend_dir / "routes"

    if not routes_dir.exists():
        print(f"Error: Routes directory not found: {routes_dir}")
        return 1

    print("Starting security audit...")
    auditor = SecurityAuditor(routes_dir)
    result = auditor.scan_routes()
    report = auditor.generate_report(result)

    print(report)

    report_file = backend_dir / "docs" / "SECURITY_AUDIT_IDOR.md"
    report_file.parent.mkdir(parents=True, exist_ok=True)
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report)

    print(f"\nReport saved to: {report_file}")

    return 1 if result.vulnerable_endpoints else 0

if __name__ == "__main__":
    exit(main())
