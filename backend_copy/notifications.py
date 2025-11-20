"""
Notification-related models
"""

from datetime import datetime

from ..core.extensions import db

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    message = db.Column(db.String(256), nullable=False)
    type = db.Column(db.String(32), default="info")
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    repeat_count = db.Column(db.Integer, default=1)
    show_count = db.Column(db.Integer, default=0)
    is_deleted = db.Column(db.Boolean, default=False)
    deleted_at = db.Column(db.DateTime, nullable=True)

    is_scheduled = db.Column(db.Boolean, default=False)
    scheduled_at = db.Column(db.DateTime, nullable=True)
    sent_at = db.Column(db.DateTime, nullable=True)
    user = db.relationship("User", backref="notifications")
    project = db.relationship("Project", backref="notifications")
