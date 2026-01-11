"""
Library Build Hash Models
Модели для хранения и проверки SHA-256 хэшей сборок библиотек для Product и Agent
"""

from datetime import datetime

from ..core.extensions import db


class ProductLibraryBuildHash(db.Model):
    """Модель для хранения разрешенных SHA-256 хэшей сборок библиотек для Product"""
    
    __tablename__ = "product_library_build_hashes"
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(
        db.Integer, 
        db.ForeignKey("product.id", ondelete="CASCADE"), 
        nullable=False
    )
    hash_sha256 = db.Column(db.String(64), nullable=False)  # SHA-256 в hex формате (64 символа)
    version = db.Column(db.String(50), nullable=True)  # Версия библиотеки
    description = db.Column(db.Text, nullable=True)  # Описание хэша
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    
    product = db.relationship("Product", backref="library_build_hashes")
    creator = db.relationship("User", backref="created_product_library_hashes")
    
    __table_args__ = (
        db.UniqueConstraint('product_id', 'hash_sha256', name='uq_product_hash'),
    )
    
    def __repr__(self):
        return f"<ProductLibraryBuildHash(product_id={self.product_id}, hash={self.hash_sha256[:16]}...)>"


class AgentLibraryBuildHash(db.Model):
    """Модель для хранения разрешенных SHA-256 хэшей сборок библиотек для Agent"""
    
    __tablename__ = "agent_library_build_hashes"
    
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(
        db.Integer, 
        db.ForeignKey("agent.id", ondelete="CASCADE"), 
        nullable=False
    )
    hash_sha256 = db.Column(db.String(64), nullable=False)  # SHA-256 в hex формате (64 символа)
    version = db.Column(db.String(50), nullable=True)  # Версия библиотеки
    description = db.Column(db.Text, nullable=True)  # Описание хэша
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    
    agent = db.relationship("Agent", backref="library_build_hashes")
    creator = db.relationship("User", backref="created_agent_library_hashes")
    
    __table_args__ = (
        db.UniqueConstraint('agent_id', 'hash_sha256', name='uq_agent_hash'),
    )
    
    def __repr__(self):
        return f"<AgentLibraryBuildHash(agent_id={self.agent_id}, hash={self.hash_sha256[:16]}...)>"


class ProductLibraryHashSettings(db.Model):
    """Настройки проверки SHA-256 хэшей библиотек для Product"""
    
    __tablename__ = "product_library_hash_settings"
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(
        db.Integer, 
        db.ForeignKey("product.id", ondelete="CASCADE"), 
        nullable=False,
        unique=True
    )
    library_hash_check_enabled = db.Column(db.Boolean, default=False, nullable=False)
    mismatch_action = db.Column(db.String(20), default='block', nullable=False)  # 'block' или 'warn'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    product = db.relationship("Product", backref="library_hash_settings")
    
    def __repr__(self):
        return f"<ProductLibraryHashSettings(product_id={self.product_id}, enabled={self.library_hash_check_enabled})>"


class AgentLibraryHashSettings(db.Model):
    """Настройки проверки SHA-256 хэшей библиотек для Agent"""
    
    __tablename__ = "agent_library_hash_settings"
    
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(
        db.Integer, 
        db.ForeignKey("agent.id", ondelete="CASCADE"), 
        nullable=False,
        unique=True
    )
    library_hash_check_enabled = db.Column(db.Boolean, default=False, nullable=False)
    mismatch_action = db.Column(db.String(20), default='block', nullable=False)  # 'block' или 'warn'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    agent = db.relationship("Agent", backref="library_hash_settings")
    
    def __repr__(self):
        return f"<AgentLibraryHashSettings(agent_id={self.agent_id}, enabled={self.library_hash_check_enabled})>"
