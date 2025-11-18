"""
Webhook-related models
"""

from datetime import datetime

from ..core.extensions import db

class Webhook(db.Model):
    """Model for storing webhook configurations"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(
        db.Integer, db.ForeignKey("project.id", ondelete="CASCADE"), nullable=False
    )
    project = db.relationship("Project", backref="webhooks")

    name = db.Column(db.String(255), nullable=False)
    webhook_type = db.Column(
        db.String(50), nullable=False, default="custom"
    )
    url = db.Column(db.String(512), nullable=True)
    events = db.Column(db.Text, nullable=False)
    secret = db.Column(db.String(64), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    headers = db.Column(db.Text, nullable=True)

    telegram_bot_token = db.Column(db.String(255), nullable=True)
    telegram_chat_id = db.Column(db.String(100), nullable=True)

    discord_webhook_url = db.Column(db.String(512), nullable=True)
    discord_bot_token = db.Column(db.String(255), nullable=True)
    discord_channel_id = db.Column(db.String(100), nullable=True)

    message_template = db.Column(db.Text, nullable=True)

    success_count = db.Column(db.Integer, default=0)
    failure_count = db.Column(db.Integer, default=0)
    last_triggered = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Webhook id={self.id} name={self.name} url={self.url}>"

class WebhookLog(db.Model):
    """Model for storing webhook execution logs"""

    id = db.Column(db.Integer, primary_key=True)
    webhook_id = db.Column(
        db.Integer, db.ForeignKey("webhook.id", ondelete="CASCADE"), nullable=False
    )
    webhook = db.relationship("Webhook", backref="logs")

    event = db.Column(db.String(100), nullable=False)
    success = db.Column(db.Boolean, nullable=False)
    error_message = db.Column(db.Text, nullable=True)
    payload = db.Column(db.Text, nullable=False)

    response_status = db.Column(db.Integer, nullable=True)
    response_body = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return (
            f"<WebhookLog webhook_id={self.webhook_id} event={self.event} success={self.success}>"
        )
