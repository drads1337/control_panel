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
    type = db.Column(db.String(32), default="info")  # info, warning, error
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # New fields for managing repetition and deletion
    repeat_count = db.Column(db.Integer, default=1)  # How many times to show the notification
    show_count = db.Column(db.Integer, default=0)  # How many times already shown
    is_deleted = db.Column(db.Boolean, default=False)  # Marked as deleted
    deleted_at = db.Column(db.DateTime, nullable=True)  # When deleted
    # Fields for scheduled notifications
    is_scheduled = db.Column(db.Boolean, default=False)  # Whether notification is scheduled
    scheduled_at = db.Column(db.DateTime, nullable=True)  # When to send
    sent_at = db.Column(db.DateTime, nullable=True)  # When it was sent
    user = db.relationship("User", backref="notifications")
    project = db.relationship("Project", backref="notifications")
