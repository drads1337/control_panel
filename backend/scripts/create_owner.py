
"""
Скрипт для создания владельца (owner) в системе
"""

import os
import sys
from datetime import datetime
import secrets
import string
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
from backend.utils.rbac_utils import RBACManager
from backend.models.rbac import Role, UserRole
from backend.services.rbac import rbac_service

def create_app():
    """Create Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Увеличиваем таймауты для скрипта (30 секунд вместо 5)
    if 'SQLALCHEMY_ENGINE_OPTIONS' in app.config:
        engine_options = app.config['SQLALCHEMY_ENGINE_OPTIONS'].copy()
        # Увеличиваем таймауты для скрипта
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

def generate_password(length=12):
    """Генерирует безопасный пароль"""
    characters = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(characters) for _ in range(length))
    return password

def hash_password(password):
    """Хеширует пароль используя werkzeug (совместимо с системой)"""
    from werkzeug.security import generate_password_hash
    return generate_password_hash(password)

def create_owner():
    """Создает владельца (owner) в системе"""

    app = create_app()
    with app.app_context():
        try:
            print("🔍 Проверяем существующих владельцев...")

            # Find owners by checking users with project_id=None and checking RBAC
            # Note: This is a workaround since User model doesn't have a role field
            potential_owners = User.query.filter_by(project_id=None).all()
            owners = [user for user in potential_owners if RBACManager.is_owner(user)]
            owner_count = len(owners)

            if owner_count > 0:
                print(f"⚠️  В системе уже есть {owner_count} владельцев.")
                
                print("📋 Существующие владельцы:")
                for owner in owners:
                    print(f"  - ID: {owner.id}, Username: {owner.username}, Email: {owner.email or 'Не указан'}, Created: {owner.created_at}")

                choice = input("\nСоздать дополнительного владельца? (y/N): ").lower()
                if choice != 'y':
                    print("❌ Создание отменено.")
                    return

            print("\n👤 Создание нового владельца")
            print("=" * 40)

            username = input("Введите имя пользователя: ").strip()
            if not username:
                print("❌ Имя пользователя не может быть пустым.")
                return

            if User.query.filter_by(username=username).first():
                print("❌ Пользователь с таким именем уже существует.")
                return

            email = input("Введите email (необязательно): ").strip()
            if email:
                email = email.lower()

                if User.query.filter_by(email=email).first():
                    print("❌ Пользователь с таким email уже существует.")
                    return
            else:
                email = None

            first_name = input("Введите имя (необязательно): ").strip() or None
            last_name = input("Введите фамилию (необязательно): ").strip() or None

            auto_password = input("Сгенерировать пароль автоматически? (Y/n): ").lower()
            if auto_password != 'n':
                password = generate_password()
                print(f"🔑 Сгенерированный пароль: {password}")
            else:
                password = input("Введите пароль: ").strip()
                if not password:
                    print("❌ Пароль не может быть пустым.")
                    return

            hashed_password = hash_password(password)

            print("\n📊 Создание владельца...")

            # Create user without role and is_admin fields (they don't exist in User model)
            owner = User(
                username=username,
                password=hashed_password,
                email=email,
                first_name=first_name,
                last_name=last_name,
                token_balance=0,
                project_id=None  # Owners have project_id=None
            )

            db.session.add(owner)
            
            # Пытаемся закоммитить с обработкой ошибок соединения
            try:
                db.session.commit()
                db.session.refresh(owner)
            except Exception as commit_error:
                # Если ошибка соединения, пробуем переподключиться
                if 'connection' in str(commit_error).lower() or 'closed' in str(commit_error).lower():
                    print("⚠️  Проблема с соединением, пробуем переподключиться...")
                    db.session.rollback()
                    # Закрываем старое соединение
                    db.session.close()
                    # Пробуем снова
                    db.session.add(owner)
                    db.session.commit()
                    db.session.refresh(owner)
                else:
                    raise

            # Assign owner role through RBAC
            # Note: Owner role must be created in a project (project_id is required for Role model)
            # We'll find or create a system project specifically for global owner roles
            print("\n🔐 Назначение роли владельца через RBAC...")
            
            try:
                # Find or create a SYSTEM project for owner roles
                # This project is only used for storing global owner roles, not for regular operations
                system_project = Project.query.filter_by(name="__SYSTEM_OWNER_ROLES__").first()
                
                if not system_project:
                    print("   ⚠️  Системный проект не найден. Создаем системный проект для глобальных ролей владельцев...")
                    # Create a system project specifically for global owner roles
                    # Note: unique_id will be auto-generated by Project.__init__
                    system_project = Project(
                        name="__SYSTEM_OWNER_ROLES__",
                        description="System project for global owner roles (do not use for regular operations)",
                        status="active"
                    )
                    db.session.add(system_project)
                    db.session.commit()
                    db.session.refresh(system_project)
                    print(f"   ✅ Создан системный проект для глобальных ролей (ID: {system_project.id})")
                else:
                    print(f"   ℹ️  Найден системный проект для глобальных ролей (ID: {system_project.id})")
                
                # Initialize RBAC for the system project if not already initialized
                # Check if roles exist for this project
                existing_roles = Role.query.filter_by(project_id=system_project.id).count()
                if existing_roles == 0:
                    print(f"   ⚠️  RBAC не инициализирован для системного проекта. Инициализируем...")
                    success = rbac_service.initialize_default_data(system_project.id)
                    if not success:
                        print("   ⚠️  Ошибка при инициализации RBAC")
                        raise Exception("Failed to initialize RBAC")
                    print("   ✅ RBAC инициализирован для системного проекта")
                
                # Find owner role in the system project
                owner_role = Role.query.filter_by(
                    name='owner', 
                    project_id=system_project.id,
                    is_system_role=True
                ).first()
                
                if not owner_role:
                    # Try to find any owner role in system project
                    owner_role = Role.query.filter_by(
                        name='owner',
                        project_id=system_project.id
                    ).first()
                
                if not owner_role:
                    print("   ⚠️  Роль 'owner' не найдена в системном проекте. Создаем...")
                    # Re-initialize RBAC to ensure owner role is created
                    rbac_service.initialize_default_data(system_project.id)
                    owner_role = Role.query.filter_by(
                        name='owner',
                        project_id=system_project.id
                    ).first()
                
                if owner_role:
                    print(f"   ℹ️  Найдена роль 'owner' в системном проекте (ID: {owner_role.id})")
                    
                    # Check if user already has this role
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
                        print("   ✅ Роль 'owner' назначена через RBAC (глобальная роль)")
                        print("   ✅ Владелец может управлять всеми проектами в системе")
                    else:
                        print("   ℹ️  Роль 'owner' уже назначена")
                else:
                    print("   ⚠️  Не удалось найти или создать роль 'owner'")
                    print("   ⚠️  Владелец создан, но роль не назначена автоматически")
                    raise Exception("Owner role not found after initialization")
            except Exception as rbac_error:
                print(f"   ⚠️  Ошибка при назначении роли через RBAC: {str(rbac_error)}")
                print("   ⚠️  Владелец создан, но роль может быть не назначена")
                import traceback
                traceback.print_exc()

            print(f"\n✅ Владелец успешно создан!")
            print(f"   ID: {owner.id}")
            print(f"   Username: {owner.username}")
            print(f"   Email: {email if email else 'Не указан'}")
            print(f"   Project ID: None (глобальный владелец - может управлять всеми проектами)")
            print(f"   Created: {owner.created_at}")
            
            # Проверяем, что владелец правильно распознается системой RBAC
            db.session.refresh(owner)
            is_owner_check = RBACManager.is_owner(owner)
            user_roles = RBACManager.get_user_role_names(owner)
            
            print(f"\n🔍 Проверка RBAC:")
            print(f"   Распознан как владелец: {'✅ Да' if is_owner_check else '❌ Нет'}")
            print(f"   Роли в RBAC: {', '.join(user_roles) if user_roles else 'Нет ролей'}")
            
            if is_owner_check:
                print(f"\n✅ Права владельца:")
                print(f"   • Может создавать проекты")
                print(f"   • Может удалять любые проекты")
                print(f"   • Может управлять всеми проектами в системе")
                print(f"   • Имеет полный доступ ко всем ресурсам")
            
            if not is_owner_check:
                print(f"\n⚠️  ВНИМАНИЕ: Владелец создан, но не распознается системой RBAC!")
                print(f"   Это может быть связано с проблемами в настройке RBAC.")
                print(f"   Возможно, требуется дополнительная настройка системы RBAC для владельцев.")

            if auto_password != 'n':
                print(f"\n🔑 ВАЖНО: Сохраните пароль в безопасном месте!")
                print(f"   Пароль: {password}")

            print(f"\n🎉 Владелец готов к использованию!")

        except Exception as e:
            print(f"❌ Ошибка при создании владельца: {str(e)}")
            try:
                db.session.rollback()
            except:
                pass
            try:
                db.session.close()
            except:
                pass
            import traceback
            traceback.print_exc()
            raise
        finally:
            # Закрываем соединение явно
            try:
                db.session.close()
            except:
                pass

def list_owners():
    """Показывает список всех владельцев"""

    app = create_app()
    with app.app_context():
        try:
            print("👑 Список владельцев в системе")
            print("=" * 40)

            # Find owners by checking users with project_id=None and checking RBAC
            # Note: This is a workaround since User model doesn't have a role field
            potential_owners = User.query.filter_by(project_id=None).order_by(User.created_at).all()
            owners = [user for user in potential_owners if RBACManager.is_owner(user)]

            if not owners:
                print("❌ Владельцы не найдены.")
                print("   Примечание: Владельцы определяются через систему RBAC.")
                return

            for owner in owners:
                user_roles = RBACManager.get_user_role_names(owner)
                print(f"\n👤 ID: {owner.id}")
                print(f"   Username: {owner.username}")
                print(f"   Email: {owner.email if owner.email else 'Не указан'}")
                name = f"{owner.first_name or ''} {owner.last_name or ''}".strip()
                print(f"   Name: {name if name else 'Не указано'}")
                print(f"   Roles: {', '.join(user_roles) if user_roles else 'Нет ролей'}")
                print(f"   Created: {owner.created_at}")
                print(f"   Last Login: {owner.last_login if owner.last_login else 'Никогда'}")
                print(f"   Token Balance: {owner.token_balance}")

        except Exception as e:
            print(f"❌ Ошибка при получении списка владельцев: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            # Закрываем соединение явно
            try:
                db.session.close()
            except:
                pass

if __name__ == '__main__':
    print("🛠️  Управление владельцами системы")
    print("=" * 40)

    if len(sys.argv) > 1:
        if sys.argv[1] == '--list':
            list_owners()
        elif sys.argv[1] == '--create':
            create_owner()
        else:
            print("Использование:")
            print("  python create_owner.py --create  - создать владельца")
            print("  python create_owner.py --list    - показать список владельцев")
    else:
        print("Выберите действие:")
        print("1. Создать владельца")
        print("2. Показать список владельцев")

        choice = input("\nВведите номер (1-2): ").strip()

        if choice == '1':
            create_owner()
        elif choice == '2':
            list_owners()
        else:
            print("❌ Неверный выбор.")
