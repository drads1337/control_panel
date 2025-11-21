"""
Agent-related models
Universal terminology for B2B/SaaS applications - agents, launchers, auto-updaters
"""

import json
import random
from datetime import datetime

from ..core.extensions import db

def generate_unique_agent_id():
    """Generate a unique 8-digit agent ID"""
    while True:
        unique_id = "".join([str(random.randint(0, 9)) for _ in range(8)])
        
        existing_agent = Agent.query.filter_by(unique_id=unique_id).first()
        if not existing_agent:
            return unique_id

class Agent(db.Model):
    """Model for managing agents (launchers, auto-updaters, IoT devices)"""
    
    __tablename__ = "agent"

    id = db.Column(db.Integer, primary_key=True)
    unique_id = db.Column(db.String(8), unique=True, nullable=False)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(32), default="active")
    logo = db.Column(db.String(256), nullable=True)
    banner = db.Column(db.String(256), nullable=True)
    background = db.Column(db.String(256), nullable=True)
    file = db.Column(db.String(256), nullable=True)
    changelog = db.Column(db.Text, nullable=True)
    notifications = db.Column(db.Text, nullable=True)
    version = db.Column(db.String(32), default="1.0.0")
    downloads = db.Column(db.Integer, default=0)
    active_users = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

    login_type = db.Column(
        db.String(32), default="license_generation"
    )
    invite_code_required = db.Column(
        db.Boolean, default=False
    )

    custom_key_prefix = db.Column(db.String(64), nullable=True)
    key_prefix_format = db.Column(
        db.String(128), default="{name}-{duration}-{custom}"
    )

    creator = db.relationship("User", backref="created_agents")
    project = db.relationship("Project", backref="agents")

    def __init__(self, **kwargs):
        super(Agent, self).__init__(**kwargs)
        if not self.unique_id:
            self.unique_id = generate_unique_agent_id()

    def __repr__(self):
        return f"<Agent {self.name}>"

class AgentProductAssignment(db.Model):
    """Model for assigning products to agents"""
    
    __tablename__ = "agent_product_assignment"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(
        db.Integer, db.ForeignKey("agent.id", ondelete="CASCADE"), nullable=False
    )
    product_id = db.Column(db.Integer, db.ForeignKey("product.id", ondelete="CASCADE"), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

    agent = db.relationship("Agent", backref="product_assignments")
    product = db.relationship("Product", backref="agent_assignments")
    assigner = db.relationship("User", backref="assigned_products")
    project = db.relationship("Project", backref="agent_product_assignments")

    __table_args__ = (db.UniqueConstraint("agent_id", "product_id", name="uq_agent_product"),)

    def __repr__(self):
        return f"<AgentProductAssignment {self.agent_id}:{self.product_id}>"

class AgentChangelog(db.Model):
    """Model for agent changelog entries"""
    
    __tablename__ = "loaderchangelog"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(
        db.Integer, db.ForeignKey("agent.id", ondelete="CASCADE"), nullable=False
    )
    version = db.Column(db.String(32), nullable=False)
    title = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text, nullable=True)
    changes = db.Column(db.Text, nullable=False)
    change_type = db.Column(
        db.String(32), default="release"
    )
    custom_type_name = db.Column(db.String(64), nullable=True)
    release_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_public = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

    agent = db.relationship("Agent", backref="changelog_entries")
    creator = db.relationship("User", backref="created_agent_changelog_entries")
    project = db.relationship("Project", backref="agent_changelog_entries")

    @property
    def changes_list(self):
        """Get changes as a list"""
        try:
            return json.loads(self.changes) if self.changes else []
        except (json.JSONDecodeError, TypeError):
            return []

    @changes_list.setter
    def changes_list(self, value):
        """Set changes from a list"""
        self.changes = json.dumps(value) if value else "[]"

    def __repr__(self):
        return f"<AgentChangelog {self.agent_id}:{self.version}>"

class AgentNotification(db.Model):
    """Model for agent notifications"""
    
    __tablename__ = "loadernotification"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(
        db.Integer, db.ForeignKey("agent.id", ondelete="CASCADE"), nullable=False
    )
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(32), default="info")
    is_scheduled = db.Column(db.Boolean, default=False)
    scheduled_at = db.Column(db.DateTime, nullable=True)
    sent_at = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    agent = db.relationship("Agent", backref="agent_notifications")
    creator = db.relationship("User", backref="created_agent_notifications")
    project = db.relationship("Project", backref="agent_notifications")

    def __repr__(self):
        return f"<AgentNotification {self.agent_id}:{self.type}>"

class AgentDownloadLog(db.Model):
    """Model for tracking agent downloads"""
    
    __tablename__ = "loaderdownloadlog"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(
        db.Integer, db.ForeignKey("agent.id", ondelete="CASCADE"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    download_date = db.Column(db.DateTime, default=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)

    agent = db.relationship("Agent", backref="download_logs")
    user = db.relationship("User", backref="agent_downloads")
    project = db.relationship("Project", backref="agent_download_logs")

    def __repr__(self):
        return f"<AgentDownloadLog {self.agent_id}:{self.download_date}>"

class AgentConfiguration(db.Model):
    """Model for storing agent-specific configuration"""
    
    __tablename__ = "loaderconfiguration"

    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(
        db.Integer, db.ForeignKey("agent.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    agent = db.relationship("Agent", backref="configuration")

    version = db.Column(db.String(32), default="1.0.0")
    update_url = db.Column(db.String(256), nullable=True)
    auto_update = db.Column(db.Boolean, default=True)

    checksum_verification = db.Column(db.Boolean, default=True)
    signature_verification = db.Column(db.Boolean, default=True)
    anti_debug = db.Column(db.Boolean, default=True)
    anti_vm = db.Column(db.Boolean, default=True)

    memory_protection = db.Column(db.Boolean, default=True)
    process_isolation = db.Column(db.Boolean, default=True)

    config_data = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_id = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=True)
    project = db.relationship("Project", backref="agent_configurations")