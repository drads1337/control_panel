"""
RBAC (Role-Based Access Control) models
"""

from datetime import datetime

from ..core.extensions import db


class Role(db.Model):
    """Model for storing custom roles"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="roles")

    # Role configuration
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_system_role = db.Column(db.Boolean, default=False)  # System roles cannot be deleted

    # Role hierarchy
    parent_role_id = db.Column(
        db.Integer, db.ForeignKey("role.id", ondelete="SET NULL"), nullable=True
    )
    parent_role = db.relationship("Role", remote_side=[id], backref="child_roles")
    hierarchy_level = db.Column(db.Integer, default=0)  # 0 = root level

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = db.relationship(
        "UserRole", backref="role", lazy="dynamic", cascade="all, delete-orphan"
    )
    permissions = db.relationship(
        "RolePermission", backref="role", lazy="dynamic", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Role id={self.id} name={self.name} project_id={self.project_id}>"

    def get_all_permissions(self):
        """Get all permissions including inherited ones"""
        permissions = set()

        # Get direct permissions
        for role_permission in self.permissions:
            permissions.add(role_permission.permission.name)

        # Get inherited permissions from parent roles
        if self.parent_role:
            parent_permissions = self.parent_role.get_all_permissions()
            permissions.update(parent_permissions)

        return permissions

    def get_inheritance_chain(self):
        """Get the full inheritance chain from root to this role"""
        chain = []
        current_role = self

        while current_role:
            chain.insert(0, current_role)
            current_role = current_role.parent_role

        return chain


class Permission(db.Model):
    """Model for storing permissions"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="permissions")

    # Permission configuration
    name = db.Column(db.String(100), nullable=False)  # e.g., 'users.create'
    description = db.Column(db.Text, nullable=True)
    resource = db.Column(db.String(50), nullable=False)  # e.g., 'users'
    action = db.Column(db.String(50), nullable=False)  # e.g., 'create'

    # Resource-specific permissions
    resource_type = db.Column(db.String(50), nullable=True)  # e.g., 'key', 'file', 'server'
    resource_id = db.Column(db.Integer, nullable=True)  # ID of specific resource
    game_id = db.Column(
        db.Integer, db.ForeignKey("game.id", ondelete="CASCADE"), nullable=True
    )  # Specific game access

    # Permission scope
    scope = db.Column(db.String(20), default="global")  # 'global', 'resource', 'instance'

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    roles = db.relationship(
        "RolePermission", backref="permission", lazy="dynamic", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Permission id={self.id} name={self.name} project_id={self.project_id}>"

    def get_resource_identifier(self):
        """Get a unique identifier for the resource this permission applies to"""
        if self.scope == "global":
            return None
        elif self.scope == "resource":
            return f"{self.resource_type}"
        elif self.scope == "instance":
            return f"{self.resource_type}:{self.resource_id}"
        return None


class UserRole(db.Model):
    """Model for storing user-role assignments"""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    user = db.relationship("User", backref="user_roles")
    role_id = db.Column(db.Integer, db.ForeignKey("role.id", ondelete="CASCADE"), nullable=False)

    # Timestamps
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<UserRole user_id={self.user_id} role_id={self.role_id}>"


class RolePermission(db.Model):
    """Model for storing role-permission assignments"""

    id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("role.id", ondelete="CASCADE"), nullable=False)
    permission_id = db.Column(
        db.Integer, db.ForeignKey("permission.id", ondelete="CASCADE"), nullable=False
    )

    # Permission type: 'allow' or 'deny'
    permission_type = db.Column(db.String(10), default="allow")  # 'allow' or 'deny'

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<RolePermission role_id={self.role_id} permission_id={self.permission_id} type={self.permission_type}>"


class AttributeRule(db.Model):
    """Model for storing ABAC attribute-based rules"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="attribute_rules")

    # Rule configuration
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    rule_type = db.Column(db.String(50), nullable=False)  # 'allow', 'deny', 'condition'

    # Rule conditions (JSON format)
    conditions = db.Column(db.Text, nullable=False)  # JSON string with conditions

    # Target configuration
    target_resource = db.Column(db.String(50), nullable=True)  # e.g., 'keys', 'users'
    target_action = db.Column(db.String(50), nullable=True)  # e.g., 'edit', 'delete'

    # Priority and status
    priority = db.Column(db.Integer, default=100)  # Lower number = higher priority
    is_active = db.Column(db.Boolean, default=True)

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AttributeRule id={self.id} name={self.name} type={self.rule_type}>"

    def get_conditions(self):
        """Parse conditions JSON"""
        import json

        try:
            return json.loads(self.conditions) if self.conditions else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    def set_conditions(self, conditions_dict):
        """Set conditions from dictionary"""
        import json

        self.conditions = json.dumps(conditions_dict)


class UserAttribute(db.Model):
    """Model for storing user attributes for ABAC"""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    user = db.relationship("User", backref="attributes")

    # Attribute configuration
    attribute_name = db.Column(db.String(100), nullable=False)  # e.g., 'department', 'location'
    attribute_value = db.Column(db.Text, nullable=False)  # e.g., 'IT', 'New York'
    attribute_type = db.Column(
        db.String(20), default="string"
    )  # 'string', 'number', 'boolean', 'date'

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<UserAttribute user_id={self.user_id} name={self.attribute_name} value={self.attribute_value}>"


class ResourceAttribute(db.Model):
    """Model for storing resource attributes for ABAC"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="resource_attributes")

    # Resource identification
    resource_type = db.Column(db.String(50), nullable=False)  # e.g., 'key', 'game', 'file'
    resource_id = db.Column(db.Integer, nullable=False)  # ID of the specific resource

    # Attribute configuration
    attribute_name = db.Column(db.String(100), nullable=False)  # e.g., 'owner_id', 'created_by'
    attribute_value = db.Column(db.Text, nullable=False)  # e.g., '123', 'admin'
    attribute_type = db.Column(
        db.String(20), default="string"
    )  # 'string', 'number', 'boolean', 'date'

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ResourceAttribute resource_type={self.resource_type} resource_id={self.resource_id} name={self.attribute_name}>"
