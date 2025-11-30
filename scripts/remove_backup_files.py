#!/usr/bin/env python3
"""
Скрипт для удаления всех backup файлов с паттерном .backup_*
Находит все файлы вида *.backup_* в директории backend и удаляет их.
"""

import os
import sys
from pathlib import Path
from typing import List


def find_backup_files(root_dir: Path) -> List[Path]:
    """Находит все backup файлы с паттерном .backup_*"""
    backup_files = []
    
    for file_path in root_dir.rglob("*"):
        if file_path.is_file() and ".backup_" in file_path.name:
            backup_files.append(file_path)
    
    return sorted(backup_files)


def format_size(size_bytes: int) -> str:
    """Форматирует размер файла в читаемый вид"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Удаляет все backup файлы с паттерном .backup_*"
    )
    parser.add_argument(
        "--root",
        type=str,
        default="backend",
        help="Корневая директория для поиска (по умолчанию: backend)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Показать список файлов без удаления"
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Удалить файлы без подтверждения"
    )
    
    args = parser.parse_args()
    
    # Определяем корневую директорию
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    root_dir = project_root / args.root
    
    if not root_dir.exists():
        print(f"❌ Директория {root_dir} не существует")
        sys.exit(1)
    
    # Находим все backup файлы
    print(f"🔍 Поиск backup файлов в {root_dir}...")
    backup_files = find_backup_files(root_dir)
    
    if not backup_files:
        print("✅ Backup файлы не найдены")
        return
    
    # Показываем статистику
    total_size = sum(f.stat().st_size for f in backup_files)
    print(f"\n📊 Найдено backup файлов: {len(backup_files)}")
    print(f"📦 Общий размер: {format_size(total_size)}")
    
    # Показываем список файлов
    print("\n📋 Список файлов для удаления:")
    for i, file_path in enumerate(backup_files, 1):
        size = file_path.stat().st_size
        rel_path = file_path.relative_to(project_root)
        print(f"  {i:3d}. {rel_path} ({format_size(size)})")
    
    # Если dry-run, просто выходим
    if args.dry_run:
        print("\n🔍 [DRY RUN] Файлы не будут удалены")
        return
    
    # Запрашиваем подтверждение
    if not args.yes:
        print(f"\n⚠️  Вы уверены, что хотите удалить {len(backup_files)} файлов?")
        response = input("Введите 'yes' для подтверждения: ").strip().lower()
        if response != 'yes':
            print("❌ Операция отменена")
            return
    
    # Удаляем файлы
    print("\n🗑️  Удаление файлов...")
    deleted_count = 0
    failed_count = 0
    
    for file_path in backup_files:
        try:
            file_path.unlink()
            deleted_count += 1
            if deleted_count % 10 == 0:
                print(f"  Удалено: {deleted_count}/{len(backup_files)}")
        except Exception as e:
            print(f"  ❌ Ошибка при удалении {file_path}: {e}")
            failed_count += 1
    
    # Итоговая статистика
    print(f"\n✅ Успешно удалено: {deleted_count} файлов")
    if failed_count > 0:
        print(f"❌ Ошибок при удалении: {failed_count} файлов")
    
    freed_space = sum(f.stat().st_size for f in backup_files if not f.exists())
    print(f"💾 Освобождено места: {format_size(freed_space)}")


if __name__ == "__main__":
    main()

