"""
Project-User relationship models

These models use string references in SQLAlchemy relationships (e.g., "Project", "User")
to avoid circular import issues. This allows core.py to import ProjectAdmin directly
without creating circular dependencies.
"""

from datetime import datetime

from ..core.extensions import db

class ProjectUserRole(db.Model):
    """Model for storing project-user relationships with roles"""

    __tablename__ = "project_user_role"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    role = db.Column(db.String(32), nullable=False, default="member")
    is_primary_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("Project", backref="project_user_roles")
    user = db.relationship("User", backref="user_project_roles")

    __table_args__ = (db.UniqueConstraint("project_id", "user_id", name="uq_project_user_role"),)

    def __repr__(self):
        return f"<ProjectUserRole project_id={self.project_id} user_id={self.user_id} role={self.role}>"

class ProjectAdmin(db.Model):
    """Model for storing project administrators (replaces admin_id field)"""

    __tablename__ = "project_admin"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    admin_user_id = db.Column(
        db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("Project", backref="project_admin", uselist=False)
    admin_user = db.relationship("User", backref="administered_projects")

    def __repr__(self):
        return f"<ProjectAdmin project_id={self.project_id} admin_user_id={self.admin_user_id}>"
