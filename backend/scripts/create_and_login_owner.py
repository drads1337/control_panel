#!/usr/bin/env python3
"""
Скрипт для автоматического создания владельца и выполнения входа
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv
import requests

script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)

sys.path.insert(0, project_root)

env_path = os.path.join(project_root, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    backend_env = os.path.join(backend_dir, '.env')
    if os.path.exists(backend_env):
        load_dotenv(backend_env)
    else:
        load_dotenv()

from flask import Flask
from backend.config.config import Config
from backend.core.extensions import db
from backend.models.core import User, Project
from backend.utils.rbac_utils import RBACManager
from backend.models.rbac import Role, UserRole
from backend.services.rbac import rbac_service
from werkzeug.security import generate_password_hash

def create_app():
    """Create Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Увеличиваем таймауты для скрипта
    if 'SQLALCHEMY_ENGINE_OPTIONS' in app.config:
        engine_options = app.config['SQLALCHEMY_ENGINE_OPTIONS'].copy()
        if 'connect_args' in engine_options:
            connect_args = engine_options['connect_args'].copy()
            connect_args['options'] = (
                "-c timezone=utc "
                "-c statement_timeout=30000 "
                "-c idle_in_transaction_session_timeout=30000"
            )
            engine_options['connect_args'] = connect_args
        else:
            engine_options['connect_args'] = {
                "client_encoding": "utf8",
                "options": (
                    "-c timezone=utc "
                    "-c statement_timeout=30000 "
                    "-c idle_in_transaction_session_timeout=30000"
                ),
            }
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = engine_options
    
    db.init_app(app)
    return app

def create_owner_auto(username="owner", password="owner123", email=None):
    """Создает владельца автоматически с заданными параметрами"""
    
    app = create_app()
    with app.app_context():
        try:
            print(f"🔍 Проверяем существующих владельцев...")
            
            potential_owners = User.query.filter_by(project_id=None).all()
            owners = [user for user in potential_owners if RBACManager.is_owner(user)]
            owner_count = len(owners)
            
            if owner_count > 0:
                print(f"⚠️  В системе уже есть {owner_count} владельцев.")
                print("📋 Существующие владельцы:")
                for owner in owners:
                    print(f"  - ID: {owner.id}, Username: {owner.username}, Email: {owner.email or 'Не указан'}")
                
                # Проверяем, есть ли уже пользователь с таким именем
                existing_user = User.query.filter_by(username=username).first()
                if existing_user:
                    if RBACManager.is_owner(existing_user):
                        print(f"\n✅ Владелец с именем '{username}' уже существует!")
                        print(f"   ID: {existing_user.id}")
                        print(f"   Username: {existing_user.username}")
                        return existing_user.username, password if hasattr(existing_user, '_temp_password') else None
                    else:
                        print(f"❌ Пользователь '{username}' существует, но не является владельцем")
                        return None, None
                
                # Создаем дополнительного владельца
                print(f"\n📝 Создаем дополнительного владельца '{username}'...")
            else:
                print(f"\n👤 Создание первого владельца '{username}'...")
            
            # Проверяем, существует ли пользователь
            if User.query.filter_by(username=username).first():
                print(f"❌ Пользователь с именем '{username}' уже существует.")
                return None, None
            
            if email:
                email = email.lower()
                if User.query.filter_by(email=email).first():
                    print(f"❌ Пользователь с email '{email}' уже существует.")
                    return None, None
            
            hashed_password = generate_password_hash(password)
            
            print(f"\n📊 Создание владельца...")
            
            owner = User(
                username=username,
                password=hashed_password,
                email=email,
                first_name=None,
                last_name=None,
                token_balance=0,
                project_id=None
            )
            
            db.session.add(owner)
            db.session.commit()
            db.session.refresh(owner)
            
            print(f"   ✅ Пользователь создан (ID: {owner.id})")
            
            # Назначаем роль owner
            print(f"\n🔐 Назначение роли владельца через RBAC...")
            
            try:
                # Находим или создаем системный проект
                system_project = Project.query.filter_by(name="__SYSTEM_OWNER_ROLES__").first()
                
                if not system_project:
                    print("   ⚠️  Создаем системный проект для глобальных ролей...")
                    system_project = Project(
                        name="__SYSTEM_OWNER_ROLES__",
                        description="System project for global owner roles (do not use for regular operations)",
                        status="active"
                    )
                    db.session.add(system_project)
                    db.session.commit()
                    db.session.refresh(system_project)
                    print(f"   ✅ Создан системный проект (ID: {system_project.id})")
                
                # Инициализируем RBAC если нужно
                existing_roles = Role.query.filter_by(project_id=system_project.id).count()
                if existing_roles == 0:
                    print(f"   ⚠️  Инициализируем RBAC для системного проекта...")
                    success = rbac_service.initialize_default_data(system_project.id)
                    if not success:
                        raise Exception("Failed to initialize RBAC")
                    print("   ✅ RBAC инициализирован")
                
                # Находим роль owner
                owner_role = Role.query.filter_by(
                    name='owner',
                    project_id=system_project.id,
                    is_system_role=True
                ).first()
                
                if not owner_role:
                    owner_role = Role.query.filter_by(
                        name='owner',
                        project_id=system_project.id
                    ).first()
                
                if not owner_role:
                    print("   ⚠️  Создаем роль owner...")
                    rbac_service.initialize_default_data(system_project.id)
                    owner_role = Role.query.filter_by(
                        name='owner',
                        project_id=system_project.id
                    ).first()
                
                if owner_role:
                    # Проверяем, нет ли уже такой роли
                    existing_assignment = UserRole.query.filter_by(
                        user_id=owner.id,
                        role_id=owner_role.id
                    ).first()
                    
                    if not existing_assignment:
                        user_role = UserRole(
                            user_id=owner.id,
                            role_id=owner_role.id
                        )
                        db.session.add(user_role)
                        db.session.commit()
                        print("   ✅ Роль 'owner' назначена")
                    else:
                        print("   ℹ️  Роль 'owner' уже назначена")
                    
                    # Проверяем, что владелец правильно распознается
                    db.session.refresh(owner)
                    is_owner_check = RBACManager.is_owner(owner)
                    
                    if is_owner_check:
                        print(f"\n✅ Владелец успешно создан!")
                        print(f"   ID: {owner.id}")
                        print(f"   Username: {owner.username}")
                        print(f"   Email: {email if email else 'Не указан'}")
                        print(f"   Project ID: None (глобальный владелец)")
                        print(f"\n✅ Права владельца:")
                        print(f"   • Может создавать проекты")
                        print(f"   • Может удалять любые проекты")
                        print(f"   • Может управлять всеми проектами в системе")
                        
                        return username, password
                    else:
                        print(f"\n⚠️  Владелец создан, но не распознается системой RBAC")
                        return None, None
                else:
                    print("   ❌ Не удалось найти или создать роль 'owner'")
                    return None, None
                    
            except Exception as rbac_error:
                print(f"   ⚠️  Ошибка при назначении роли: {str(rbac_error)}")
                import traceback
                traceback.print_exc()
                return None, None
                
        except Exception as e:
            print(f"❌ Ошибка при создании владельца: {str(e)}")
            import traceback
            traceback.print_exc()
            return None, None
        finally:
            try:
                db.session.close()
            except:
                pass

def login_owner(username, password, base_url="http://localhost:5001"):
    """Выполняет вход в систему от имени владельца"""
    
    login_url = f"{base_url}/api/auth/login"
    
    print(f"\n🔐 Попытка входа в систему...")
    print(f"   URL: {login_url}")
    print(f"   Username: {username}")
    
    try:
        response = requests.post(
            login_url,
            json={
                "username": username,
                "password": password
            },
            headers={"Content-Type": "application/json"},
            timeout=10,
            verify=False  # Отключаем проверку SSL для локального тестирования
        )
        
        print(f"\n📊 Ответ сервера:")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Вход выполнен успешно!")
            
            if "access_token" in data:
                token = data["access_token"]
                print(f"   Access Token: {token[:50]}...")
            
            print(f"\n📋 Информация о пользователе:")
            if "user_id" in data:
                print(f"   User ID: {data['user_id']}")
            if "username" in data:
                print(f"   Username: {data['username']}")
            if "roles" in data:
                print(f"   Roles: {', '.join(data['roles']) if isinstance(data['roles'], list) else data['roles']}")
            if "rbac_roles" in data:
                print(f"   RBAC Roles: {', '.join(data['rbac_roles']) if isinstance(data['rbac_roles'], list) else data['rbac_roles']}")
            if "project_id" in data:
                print(f"   Project ID: {data['project_id']}")
            
            return True, data
        else:
            print(f"\n❌ Ошибка входа:")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
                print(f"   Message: {error_data.get('message', 'No message')}")
            except:
                print(f"   Response: {response.text}")
            return False, None
            
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Не удалось подключиться к серверу")
        print(f"   Убедитесь, что сервер запущен на {base_url}")
        return False, None
    except Exception as e:
        print(f"\n❌ Ошибка при входе: {str(e)}")
        import traceback
        traceback.print_exc()
        return False, None

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Создать владельца и войти в систему')
    parser.add_argument('--username', default='owner', help='Имя пользователя (по умолчанию: owner)')
    parser.add_argument('--password', default='owner123', help='Пароль (по умолчанию: owner123)')
    parser.add_argument('--email', default=None, help='Email (опционально)')
    parser.add_argument('--no-login', action='store_true', help='Не выполнять вход после создания')
    parser.add_argument('--url', default='http://localhost:5001', help='URL сервера (по умолчанию: http://localhost:5001)')
    
    args = parser.parse_args()
    
    print("🛠️  Автоматическое создание владельца и вход в систему")
    print("=" * 60)
    
    username, password = create_owner_auto(
        username=args.username,
        password=args.password,
        email=args.email
    )
    
    if username and password:
        if not args.no_login:
            login_owner(username, password, base_url=args.url)
        else:
            print(f"\n✅ Владелец создан. Пропускаем вход (--no-login)")
    else:
        print(f"\n❌ Не удалось создать владельца или получить учетные данные")
        sys.exit(1)

