"""
Project-User relationship models to handle circular dependencies properly
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
    role = db.Column(db.String(32), nullable=False, default="member")  # admin, member, viewer
    is_primary_admin = db.Column(db.Boolean, default=False)  # True for the main project admin
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = db.relationship("Project", backref="project_user_roles")
    user = db.relationship("User", backref="user_project_roles")

    # Unique constraint to prevent duplicate relationships
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

    # Relationships
    project = db.relationship("Project", backref="project_admin", uselist=False)
    admin_user = db.relationship("User", backref="administered_projects")

    def __repr__(self):
        return f"<ProjectAdmin project_id={self.project_id} admin_user_id={self.admin_user_id}>"
