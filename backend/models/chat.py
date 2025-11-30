"""
Chat-related models
"""

from datetime import datetime

from ..core.extensions import db
from ..utils.rbac_utils import RBACManager
from ..utils.role_constants import UserRoles

class TelegramBot(db.Model):
    """Model for Telegram bots"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    bot_token = db.Column(db.String(128), unique=True, nullable=False)
    bot_username = db.Column(db.String(128), nullable=True)
    chat_id = db.Column(db.String(128), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("Project", backref="telegram_bots")

    def __repr__(self):
        return f"<TelegramBot {self.bot_username} for project {self.project_id}>"

class DiscordWebhook(db.Model):
    """Model for Discord webhooks"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    webhook_url = db.Column(db.String(512), unique=True, nullable=False)
    name = db.Column(db.String(128), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("Project", backref="discord_webhooks")

    def __repr__(self):
        return f"<DiscordWebhook {self.name or self.webhook_url} for project {self.project_id}>"

class ChatMessage(db.Model):
    """Model for chat messages"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    sender_type = db.Column(db.String(32), nullable=False)
    sender_id = db.Column(
        db.Integer, db.ForeignKey("user.id"), nullable=True
    )
    sender_key = db.Column(db.String(64), nullable=True)
    message = db.Column(db.Text, nullable=False)
    telegram_message_id = db.Column(db.String(128), nullable=True)
    is_sent_to_telegram = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("agent.id"), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey("chat_group.id"), nullable=True)

    project = db.relationship("Project", backref="chat_messages")
    sender = db.relationship("User", backref="sent_messages")
    product = db.relationship("Product", backref="chat_messages", foreign_keys=[product_id])
    agent = db.relationship("Agent", backref="chat_messages", foreign_keys=[agent_id])

    def __repr__(self):
        return f"<ChatMessage {self.sender_type}:{self.message[:50]}...>"

    @property
    def sender_display_name(self):
        """Get the display name of the sender"""
        if self.sender_type == UserRoles.CLIENT.value and self.sender_key:
            return f"Client ({self.sender_key[-4:]})"
        elif self.sender:

            user_roles = RBACManager.get_user_role_names(self.sender)
            role_name = user_roles[0] if user_roles else UserRoles.CLIENT.value
            return f"{role_name.title()} ({self.sender.username})"
        else:
            return self.sender_type.title()

class ChatGroup(db.Model):
    """Group chats: allow combining multiple products (and optionally agents) into one channel"""

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = db.relationship("Project", backref="chat_groups")

    def __repr__(self):
        return f"<ChatGroup {self.name} (project {self.project_id})>"

class ChatGroupProduct(db.Model):
    """Relationship between products and chat groups (many-to-many through explicit table)"""

    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(
        db.Integer, db.ForeignKey("chat_group.id", ondelete="CASCADE"), nullable=False
    )
    product_id = db.Column(db.Integer, db.ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    group = db.relationship("ChatGroup", backref="group_products")
    product = db.relationship("Product", backref="product_groups")
    project = db.relationship("Project", backref="chat_group_products")

    __table_args__ = (db.UniqueConstraint("group_id", "product_id", name="uq_group_product"),)
