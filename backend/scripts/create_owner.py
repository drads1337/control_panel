
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
project_root = script_dir

sys.path.insert(0, project_root)

env_path = os.path.join(project_root, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:

    backend_env = os.path.join(project_root, 'backend', '.env')
    if os.path.exists(backend_env):
        load_dotenv(backend_env)
    else:

        load_dotenv()

from backend.core.app import create_app
from backend.core.extensions import db
from backend.models.core import User

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

            owner_count = User.query.filter_by(role='owner').count()

            if owner_count > 0:
                print(f"⚠️  В системе уже есть {owner_count} владельцев.")
                owners = User.query.filter_by(role='owner').all()

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

            owner = User(
                username=username,
                password=hashed_password,
                role='owner',
                is_admin=True,
                email=email,
                first_name=first_name,
                last_name=last_name,
                token_balance=0,
                project_id=None
            )

            db.session.add(owner)
            db.session.commit()

            print(f"✅ Владелец успешно создан!")
            print(f"   ID: {owner.id}")
            print(f"   Username: {owner.username}")
            print(f"   Email: {email if email else 'Не указан'}")
            print(f"   Role: owner")
            print(f"   Admin: true")
            print(f"   Created: {owner.created_at}")

            if auto_password != 'n':
                print(f"\n🔑 ВАЖНО: Сохраните пароль в безопасном месте!")
                print(f"   Пароль: {password}")

            print(f"\n🎉 Владелец готов к использованию!")

        except Exception as e:
            print(f"❌ Ошибка при создании владельца: {str(e)}")
            db.session.rollback()
            import traceback
            traceback.print_exc()
            raise

def list_owners():
    """Показывает список всех владельцев"""

    app = create_app()
    with app.app_context():
        try:
            print("👑 Список владельцев в системе")
            print("=" * 40)

            owners = User.query.filter_by(role='owner').order_by(User.created_at).all()

            if not owners:
                print("❌ Владельцы не найдены.")
                return

            for owner in owners:
                print(f"\n👤 ID: {owner.id}")
                print(f"   Username: {owner.username}")
                print(f"   Email: {owner.email if owner.email else 'Не указан'}")
                name = f"{owner.first_name or ''} {owner.last_name or ''}".strip()
                print(f"   Name: {name if name else 'Не указано'}")
                print(f"   Created: {owner.created_at}")
                print(f"   Last Login: {owner.last_login if owner.last_login else 'Никогда'}")
                print(f"   Token Balance: {owner.token_balance}")

        except Exception as e:
            print(f"❌ Ошибка при получении списка владельцев: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

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
