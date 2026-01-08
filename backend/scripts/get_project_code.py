#!/usr/bin/env python3
"""
Скрипт для получения project invite code для пользователя
"""

import os
import sys
from dotenv import load_dotenv

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
from backend.models.project import ProjectInviteCode
from backend.services.projects.project_invite_service import ProjectInviteService
from backend.utils.rbac_utils import RBACManager
from sqlalchemy import desc
from datetime import datetime, timedelta

def create_app():
    """Create Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    return app

def get_project_code(username: str):
    """Получить или создать project invite code для пользователя"""
    app = create_app()
    with app.app_context():
        try:
            # Найти пользователя
            user = User.query.filter_by(username=username).first()
            if not user:
                print(f"❌ Пользователь '{username}' не найден")
                return
            
            print(f"✓ Найден пользователь: {user.username} (ID: {user.id})")
            
            # Проверить, есть ли у пользователя проект
            if not user.project_id:
                print(f"⚠️  У пользователя нет проекта (project_id: None)")
                print("   Создаю project invite code для owner...")
                project_id = None
            else:
                project = Project.query.get(user.project_id)
                if project:
                    print(f"✓ Проект: {project.name} (ID: {project.id})")
                project_id = user.project_id
            
            # Получить последний код
            if project_id:
                latest_code = (
                    ProjectInviteCode.query.filter_by(project_id=project_id)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .first()
                )
            else:
                # Для owner - ищем код без project_id
                latest_code = (
                    ProjectInviteCode.query.filter_by(project_id=None)
                    .order_by(desc(ProjectInviteCode.created_at))
                    .first()
                )
            
            # Если есть валидный код, показать его
            if latest_code and latest_code.is_valid and not latest_code.is_used:
                print(f"\n✅ Найден валидный project invite code:")
                print(f"   Code: {latest_code.code}")
                if latest_code.expires_at:
                    days_left = (latest_code.expires_at - datetime.utcnow()).days
                    print(f"   Действителен еще {days_left} дней")
                else:
                    print(f"   Без срока действия")
                return latest_code.code
            
            # Если нет валидного кода, создать новый
            print(f"\n📝 Создаю новый project invite code...")
            
            try:
                # Создать код напрямую через модель
                from datetime import datetime, timedelta
                import secrets
                import string
                from backend.models.keys import ReferralCode
                from backend.models.products import ProductInviteCode
                
                # Генерировать уникальный код
                def generate_unique_code(length=10):
                    while True:
                        characters = string.ascii_uppercase + string.digits
                        code = "".join(secrets.choice(characters) for _ in range(length))
                        
                        invite_exists = ProjectInviteCode.query.filter_by(code=code).first() is not None
                        referral_exists = ReferralCode.query.filter_by(code=code).first() is not None
                        product_invite_exists = ProductInviteCode.query.filter_by(code=code).first() is not None
                        
                        if not (invite_exists or referral_exists or product_invite_exists):
                            return code
                
                code = generate_unique_code()
                expires_at = datetime.utcnow() + timedelta(days=30)
                
                new_code = ProjectInviteCode(
                    code=code,
                    project_id=project_id,
                    created_by=user.id,
                    expires_at=expires_at,
                    is_used=False,
                    is_expired=False
                )
                
                db.session.add(new_code)
                db.session.commit()
                
                print(f"\n✅ Создан новый project invite code:")
                print(f"   Code: {code}")
                print(f"   Действителен 30 дней")
                return code
                
            except Exception as e:
                db.session.rollback()
                print(f"❌ Ошибка при создании кода: {str(e)}")
                import traceback
                traceback.print_exc()
                return None
                
        except Exception as e:
            print(f"❌ Ошибка: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = "drads123"
    
    print(f"🔍 Поиск project invite code для пользователя: {username}\n")
    code = get_project_code(username)
    
    if code:
        print(f"\n" + "="*50)
        print(f"📋 PROJECT INVITE CODE: {code}")
        print(f"="*50)
