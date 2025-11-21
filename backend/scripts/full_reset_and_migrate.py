#!/usr/bin/env python3
"""
Полный сброс базы данных и создание миграций с нуля

Этот скрипт:
1. Удаляет ВСЕ таблицы из базы данных
2. Удаляет папку migrations
3. Создает миграции заново
4. Применяет миграции
5. Сохраняет список всех таблиц в файл tables_report.txt
"""

import os
import sys
import traceback
from datetime import datetime

# Добавляем корневую директорию проекта в путь
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

os.chdir(backend_dir)

from flask import Flask
from sqlalchemy import inspect, text
from flask_migrate import Migrate, init, migrate as create_migration, upgrade
from backend.config.config import Config
from backend.core.extensions import db
from backend.utils.structured_logging import get_logger

logger = get_logger(__name__)

def check_environment():
    """Проверка наличия необходимых переменных окружения"""
    required_vars = {
        "DATABASE_URL": "строка подключения к PostgreSQL",
        "SECRET_KEY": "секретный ключ для Flask",
        "JWT_SECRET_KEY": "секретный ключ для JWT",
        "PANEL_MASTER_KEY": "мастер-ключ (64 hex символа)"
    }
    
    missing = []
    for var, description in required_vars.items():
        if not os.environ.get(var):
            missing.append(f"  - {var}: {description}")
    
    if missing:
        print("❌ ОШИБКА: Отсутствуют необходимые переменные окружения:")
        print("\n".join(missing))
        print("\nПример установки:")
        print("  export DATABASE_URL='postgresql://user:password@localhost/dbname'")
        print("  export SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')")
        print("  export JWT_SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(32))')")
        print("  export PANEL_MASTER_KEY=$(python -c 'import secrets; print(secrets.token_hex(32))')")
        return False
    
    return True

def drop_all_tables(app):
    """Удаление всех таблиц из базы данных"""
    try:
        logger.info("Шаг 1: Удаление всех таблиц из базы данных...", component="full_reset")
        
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        if not tables:
            logger.info("База данных уже пуста", component="full_reset")
            return True
        
        logger.info(f"Найдено таблиц для удаления: {len(tables)}", component="full_reset")
        
        dropped_tables = []
        with db.engine.begin() as conn:
            # Удаляем все таблицы
            for table in tables:
                try:
                    conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE;'))
                    dropped_tables.append(table)
                    logger.debug(f"Удалена таблица: {table}", component="full_reset")
                except Exception as e:
                    logger.warning(f"Ошибка при удалении {table}: {e}", component="full_reset")
        
        logger.info(f"✅ Удалено таблиц: {len(dropped_tables)}", component="full_reset")
        return True
        
    except Exception as e:
        logger.error(
            "Ошибка при удалении таблиц",
            component="full_reset",
            error=str(e),
            traceback=traceback.format_exc()
        )
        return False

def remove_migrations_folder():
    """Удаление папки migrations"""
    try:
        migrations_dir = os.path.join(backend_dir, "migrations")
        if os.path.exists(migrations_dir):
            import shutil
            logger.info("Удаляем папку migrations...", component="full_reset")
            shutil.rmtree(migrations_dir)
            logger.info("✅ Папка migrations удалена", component="full_reset")
        return True
    except Exception as e:
        logger.error(f"Ошибка при удалении папки migrations: {e}", component="full_reset")
        return False

def create_and_apply_migrations(app, migrate):
    """Создание и применение миграций"""
    try:
        migrations_dir = os.path.join(backend_dir, "migrations")
        
        # Шаг 2: Инициализация миграций
        logger.info("Шаг 2: Инициализация миграций...", component="full_reset")
        if not os.path.exists(migrations_dir):
            init()
            logger.info("✅ Папка migrations успешно создана", component="full_reset")
            
            # Настраиваем env.py для импорта всех моделей
            env_py_path = os.path.join(migrations_dir, "env.py")
            if os.path.exists(env_py_path):
                logger.info("Настраиваем env.py для импорта моделей...", component="full_reset")
                with open(env_py_path, "r") as f:
                    env_content = f.read()
                
                # Добавляем импорт моделей
                import_section = '''# Импортируем все модели, чтобы Alembic их видел
from backend.models import (
    APIKey, Agent, AgentChangelog, AgentConfiguration, AgentDownloadLog,
    AgentNotification, AgentProductAssignment, Announcement, AttributeRule,
    Billing, BlockedDeviceFingerprint, BlockedFingerprint, BlockedHWID,
    BlockedIP, ChangelogEntry, ChatGroup, ChatGroupProduct, ChatMessage,
    ConnectToken, DeveloperProductPermission, DeviceInfo, DiscordWebhook,
    FileDownloadLog, FileMeta, Key, KeyAnalytics, LoginAttempt, Message,
    Notification, Permission, Product, ProductChatSettings, ProductExtraFile,
    ProductFileConfig, ProductFileDownload, ProductInviteCode, ProductKeyPrice,
    ProductSecurityLog, ProductStatus, Project, ProjectAdmin, ProjectAPIKey,
    ProjectEncryptionKeys, ProjectInviteCode, ProjectSettings, ProjectUserRole,
    ReferralCode, RemoteCategory, RemoteFeature, RemoteFeatureLog, RemoteConfig,
    ResourceAttribute, Role, RolePermission, SecurityAnalytics, SecurityEvent,
    SecurityRule, Server, SystemBackup, SystemSettings, TelegramBot,
    TokenTransaction, TwoFactorAuth, TwoFactorBackupCode, TwoFactorSession,
    User, UserActionLog, UserActivity, UserAttribute, UserProductPermission,
    UserRole, UserPermission, Webhook, WebhookLog
)
# Импортируем модели, чтобы они зарегистрировались в метаданных SQLAlchemy
_ = [APIKey, Agent, Product, User, Project]

'''
                
                # Вставляем импорт после импорта db
                if "from backend.core.extensions import db" in env_content:
                    env_content = env_content.replace(
                        "from backend.core.extensions import db",
                        "from backend.core.extensions import db\n" + import_section
                    )
                else:
                    # Если не нашли, добавляем в начало функции
                    env_content = env_content.replace(
                        "def run_migrations_online():",
                        import_section + "\ndef run_migrations_online():"
                    )
                
                with open(env_py_path, "w") as f:
                    f.write(env_content)
                logger.info("✅ env.py настроен для импорта моделей", component="full_reset")
        else:
            logger.info("Папка migrations уже существует", component="full_reset")
        
        # Импортируем все модели, чтобы Alembic их видел
        logger.info("Импортируем все модели для Alembic...", component="full_reset")
        from backend.models import (
            APIKey, Agent, AgentChangelog, AgentConfiguration, AgentDownloadLog,
            AgentNotification, AgentProductAssignment, Announcement, AttributeRule,
            Billing, BlockedDeviceFingerprint, BlockedFingerprint, BlockedHWID,
            BlockedIP, ChangelogEntry, ChatGroup, ChatGroupProduct, ChatMessage,
            ConnectToken, DeveloperProductPermission, DeviceInfo, DiscordWebhook,
            FileDownloadLog, FileMeta, Key, KeyAnalytics, LoginAttempt, Message,
            Notification, Permission, Product, ProductChatSettings, ProductExtraFile,
            ProductFileConfig, ProductFileDownload, ProductInviteCode, ProductKeyPrice,
            ProductSecurityLog, ProductStatus, Project, ProjectAdmin, ProjectAPIKey,
            ProjectEncryptionKeys, ProjectInviteCode, ProjectSettings, ProjectUserRole,
            ReferralCode, RemoteCategory, RemoteFeature, RemoteFeatureLog, RemoteConfig,
            ResourceAttribute, Role, RolePermission, SecurityAnalytics, SecurityEvent,
            SecurityRule, Server, SystemBackup, SystemSettings, TelegramBot,
            TokenTransaction, TwoFactorAuth, TwoFactorBackupCode, TwoFactorSession,
            User, UserActionLog, UserActivity, UserAttribute, UserProductPermission,
            UserRole, UserPermission, Webhook, WebhookLog
        )
        # Просто импортируем, чтобы модели зарегистрировались в метаданных SQLAlchemy
        _ = [APIKey, Agent, Product, User, Project]
        logger.info("✅ Все модели импортированы", component="full_reset")
        
        # Шаг 3: Создание миграции
        logger.info("Шаг 3: Создание миграции на основе моделей...", component="full_reset")
        create_migration(message="Initial migration - создание всех таблиц")
        logger.info("✅ Миграция успешно создана", component="full_reset")
        
        # Шаг 4: Применение миграций
        logger.info("Шаг 4: Применение миграций к базе данных...", component="full_reset")
        upgrade(revision="head")
        logger.info("✅ Миграции успешно применены! Таблицы созданы.", component="full_reset")
        
        return True
        
    except Exception as e:
        logger.error(
            "Ошибка при создании/применении миграций",
            component="full_reset",
            error=str(e),
            traceback=traceback.format_exc()
        )
        return False

def generate_tables_report(app):
    """Генерация отчета о таблицах в базе данных"""
    try:
        logger.info("Шаг 5: Генерация отчета о таблицах...", component="full_reset")
        
        inspector = inspect(db.engine)
        tables = sorted(inspector.get_table_names())
        
        report_path = os.path.join(backend_dir, "tables_report.txt")
        
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write("ОТЧЕТ О ТАБЛИЦАХ БАЗЫ ДАННЫХ\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"Дата создания отчета: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"База данных: {Config.SQLALCHEMY_DATABASE_URI.split('@')[-1] if '@' in Config.SQLALCHEMY_DATABASE_URI else 'N/A'}\n")
            f.write(f"Всего таблиц: {len(tables)}\n")
            f.write("\n" + "=" * 80 + "\n\n")
            
            # Группируем таблицы по категориям
            categories = {
                "Основные таблицы": ["user", "project", "product", "key", "agent"],
                "RBAC (Роли и права)": ["role", "permission", "user_role", "role_permission", "user_permission"],
                "Безопасность": ["two_factor", "login_attempt", "blocked", "security", "user_attribute"],
                "Продукты": ["product", "productchat", "productfile", "productinvite", "productkey", "productsecurity", "productstatus"],
                "Агенты": ["agent", "loader"],
                "Чат": ["chat", "message", "telegram", "discord"],
                "Вебхуки": ["webhook"],
                "Уведомления": ["notification", "announcement"],
                "Аналитика": ["analytics", "log"],
                "Настройки": ["settings", "config"],
                "Другое": []
            }
            
            categorized = {cat: [] for cat in categories.keys()}
            uncategorized = []
            
            for table in tables:
                categorized_flag = False
                for category, keywords in categories.items():
                    if any(keyword in table.lower() for keyword in keywords):
                        categorized[category].append(table)
                        categorized_flag = True
                        break
                if not categorized_flag:
                    uncategorized.append(table)
            
            categorized["Другое"] = uncategorized
            
            # Выводим категории
            for category, table_list in categorized.items():
                if table_list:
                    f.write(f"\n{category.upper()} ({len(table_list)} таблиц):\n")
                    f.write("-" * 80 + "\n")
                    for i, table in enumerate(sorted(table_list), 1):
                        # Получаем информацию о колонках
                        try:
                            columns = inspector.get_columns(table)
                            col_info = f" ({len(columns)} колонок)"
                        except:
                            col_info = ""
                        f.write(f"  {i:3d}. {table}{col_info}\n")
            
            # Полный список всех таблиц
            f.write("\n" + "=" * 80 + "\n")
            f.write("ПОЛНЫЙ СПИСОК ВСЕХ ТАБЛИЦ (в алфавитном порядке):\n")
            f.write("=" * 80 + "\n\n")
            for i, table in enumerate(tables, 1):
                try:
                    columns = inspector.get_columns(table)
                    indexes = inspector.get_indexes(table)
                    foreign_keys = inspector.get_foreign_keys(table)
                    f.write(f"{i:3d}. {table}\n")
                    f.write(f"     Колонок: {len(columns)}, Индексов: {len(indexes)}, Внешних ключей: {len(foreign_keys)}\n")
                except Exception as e:
                    f.write(f"{i:3d}. {table} (ошибка получения информации: {e})\n")
            
            f.write("\n" + "=" * 80 + "\n")
            f.write("КОНЕЦ ОТЧЕТА\n")
            f.write("=" * 80 + "\n")
        
        logger.info(f"✅ Отчет сохранен в: {report_path}", component="full_reset")
        print(f"\n📄 Отчет о таблицах сохранен в: {report_path}")
        return True
        
    except Exception as e:
        logger.error(
            "Ошибка при генерации отчета",
            component="full_reset",
            error=str(e),
            traceback=traceback.format_exc()
        )
        return False

def main():
    """Главная функция"""
    if not check_environment():
        return False
    
    logger.info("Начинаем полный сброс и миграцию базы данных", component="full_reset")
    
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)
    
    migrate = Migrate(app, db)
    
    with app.app_context():
        # Шаг 1: Удаление всех таблиц
        if not drop_all_tables(app):
            return False
        
        # Удаление папки migrations
        if not remove_migrations_folder():
            return False
        
        # Шаги 2-4: Создание и применение миграций
        if not create_and_apply_migrations(app, migrate):
            return False
        
        # Шаг 5: Генерация отчета
        if not generate_tables_report(app):
            return False
        
        logger.info("✅ Все шаги успешно завершены!", component="full_reset")
        return True

if __name__ == "__main__":
    print("=" * 80)
    print("🔄 ПОЛНЫЙ СБРОС И МИГРАЦИЯ БАЗЫ ДАННЫХ")
    print("=" * 80)
    print()
    print("⚠️  ВНИМАНИЕ: Этот скрипт удалит ВСЕ таблицы и данные!")
    print("Продолжить? (yes/no): ", end="")
    
    # В неинтерактивном режиме пропускаем подтверждение
    auto_confirm = os.environ.get("AUTO_CONFIRM", "").lower() in ["yes", "y", "1", "true"]
    
    if not auto_confirm:
        try:
            response = input().strip().lower()
            if response not in ["yes", "y", "да"]:
                print("❌ Операция отменена")
                sys.exit(0)
        except (EOFError, KeyboardInterrupt):
            print("\n❌ Операция отменена")
            sys.exit(0)
    else:
        print("Автоматическое подтверждение включено (AUTO_CONFIRM=yes)")
    
    print()
    success = main()
    
    print()
    print("=" * 80)
    if success:
        print("✅ Успешно завершено!")
        print("   - Все старые таблицы удалены")
        print("   - Миграции созданы заново")
        print("   - Все таблицы созданы")
        print("   - Отчет о таблицах сохранен в tables_report.txt")
    else:
        print("❌ Произошла ошибка.")
        print("   Проверьте логи выше для получения подробной информации.")
    print("=" * 80)
    
    sys.exit(0 if success else 1)

