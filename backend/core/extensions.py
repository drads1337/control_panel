from flask import Flask
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine
import redis


class SensitiveDataMixin:
    """
    Mixin that strips predefined sensitive fields when exporting SQLAlchemy models to dicts.
    """

    __sensitive_fields__ = ["password", "password_hash", "salt", "secret_key", "totp_secret"]

    def to_dict(self):
        """
        Convert model columns to a dictionary while skipping sensitive fields.
        """
        data = {}
        table = getattr(self, "__table__", None)
        if table is None:
            return data

        for column in table.columns:
            if column.name in self.__sensitive_fields__:
                continue
            data[column.name] = getattr(self, column.name)
        return data


class Database(SQLAlchemy):
    """
    Custom SQLAlchemy extension that supports read replica with custom engine options.
    Uses native SQLAlchemy binds mechanism for read/write replica routing.
    """
    
    def get_engine(self, app=None, bind=None):
        """
        Override get_engine to apply custom engine options for read replica.
        Flask-SQLAlchemy caches engines, so we need to check the cache first.
        """
        if bind == 'read':
            app = app or self.get_app()
            read_uri = app.config.get("SQLALCHEMY_DATABASE_READ_URI")
            
            if not read_uri:

                return super().get_engine(app=app, bind=None)
            


            if 'sqlalchemy' in app.extensions:
                engines = app.extensions['sqlalchemy'].get('engines', {})
                if 'read' in engines:
                    return engines['read']
            

            read_options = app.config.get("SQLALCHEMY_READ_ENGINE_OPTIONS", {})
            engine = create_engine(read_uri, **read_options)
            

            if 'sqlalchemy' not in app.extensions:
                app.extensions['sqlalchemy'] = {}
            if 'engines' not in app.extensions['sqlalchemy']:
                app.extensions['sqlalchemy']['engines'] = {}
            app.extensions['sqlalchemy']['engines']['read'] = engine
            
            return engine
        

        return super().get_engine(app=app, bind=bind)

db = Database()
jwt = JWTManager()


class RedisExtension:
    """
    Flask extension for Redis client.
    Provides centralized Redis connection management using Flask's extension pattern.
    """

    def __init__(self, app: Flask = None):
        self.app = app
        self._client = None
        if app is not None:
            self.init_app(app)

    def init_app(self, app: Flask):
        """
        Initialize Redis extension with Flask app

        Args:
            app: Flask application instance
        """
        from ..config.config import Config


        redis_config = {
            "host": Config.REDIS_PERSISTENT_HOST,
            "port": Config.REDIS_PERSISTENT_PORT,
            "db": Config.REDIS_PERSISTENT_DB,
            "decode_responses": True,
            "socket_connect_timeout": 5,
            "socket_timeout": 5,
            "retry_on_timeout": True,
            "health_check_interval": 30,
            "max_connections": 20,
        }

        if Config.REDIS_PERSISTENT_PASSWORD:
            redis_config["password"] = Config.REDIS_PERSISTENT_PASSWORD

        self._client = redis.Redis(**redis_config)


        try:
            self._client.ping()
        except Exception as e:
            raise RuntimeError(f"Redis is required but connection failed: {e}")


        app.extensions["redis"] = self

    @property
    def client(self) -> redis.Redis:
        """
        Get Redis client instance

        Returns:
            Redis client instance
        """
        if self._client is None:
            raise RuntimeError("Redis extension not initialized. Call init_app() first.")
        return self._client



redis_ext = RedisExtension()
