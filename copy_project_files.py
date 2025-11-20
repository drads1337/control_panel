
"""
Скрипт для копирования файлов проекта в отдельные директории.
Копирует только .py файлы из frontend/src/ и backend/, исключая ненужные файлы.
"""

import os
import shutil
import sys
from pathlib import Path
from typing import Set, List

def should_ignore_backend(path: Path) -> bool:
    """Проверяет, нужно ли игнорировать файл/папку в бэкенде."""
    path_str = str(path)

    if '__pycache__' in path_str or 'uploads' in path_str:
        return True

    if 'venv' in path_str:
        return True

    if 'scripts' in path_str:
        return True

    if path.suffix == '.pyc':
        return True

    if path.name.startswith('.') and path.name not in ['.gitignore', '.env']:
        return True

    return False

def should_ignore_frontend(path: Path) -> bool:
    """Проверяет, нужно ли игнорировать файл/папку во фронтенде."""
    path_str = str(path)

    if 'node_modules' in path_str:
        return True

    if 'dist' in path_str or 'build' in path_str:
        return True

    if path.name.startswith('.') and path.name not in ['.gitignore', '.env']:
        return True

    return False

def copy_directory_flat(src: Path, dst: Path, ignore_func=None) -> int:
    """
    Копирует все файлы из директории в одну плоскую папку без подпапок.

    Args:
        src: Исходная директория
        dst: Целевая директория
        ignore_func: Функция для проверки игнорирования файлов

    Returns:
        Количество скопированных файлов
    """
    copied_files = 0

    if not src.exists():
        print(f"❌ Исходная директория не найдена: {src}")
        return 0

    dst.mkdir(parents=True, exist_ok=True)

    for root, dirs, files in os.walk(src):
        root_path = Path(root)

        if ignore_func:
            dirs[:] = [d for d in dirs if not ignore_func(root_path / d)]

        for file in files:
            src_file = root_path / file

            # Копируем только .py файлы
            if src_file.suffix != '.py':
                continue

            if ignore_func and ignore_func(src_file):
                continue

            dst_file = dst / file
            counter = 1
            original_name = file
            while dst_file.exists():
                name_parts = original_name.rsplit('.', 1)
                if len(name_parts) == 2:
                    new_name = f"{name_parts[0]}_{counter}.{name_parts[1]}"
                else:
                    new_name = f"{original_name}_{counter}"
                dst_file = dst / new_name
                counter += 1

            try:
                shutil.copy2(src_file, dst_file)
                copied_files += 1
                print(f"✅ Скопирован: {src_file.relative_to(src)} -> {dst_file.name}")
            except Exception as e:
                print(f"❌ Ошибка копирования {src_file}: {e}")

    return copied_files

def main():
    """Основная функция скрипта."""

    project_root = Path(__file__).parent
    print(f"📁 Корневая директория проекта: {project_root}")

    frontend_src = project_root / "frontend" / "src"
    backend_src = project_root / "backend"

    frontend_dst = project_root / "frontend_copy"
    backend_dst = project_root / "backend_copy"

    print("\n🚀 Начинаем копирование файлов...")

    print(f"\n📱 Копирование фронтенда из {frontend_src} в {frontend_dst}")
    if frontend_src.exists():

        if frontend_dst.exists():
            shutil.rmtree(frontend_dst)
            print("🗑️  Удалена старая копия фронтенда")

        frontend_files = copy_directory_flat(frontend_src, frontend_dst, should_ignore_frontend)
        print(f"✅ Фронтенд: скопировано {frontend_files} файлов")
    else:
        print(f"❌ Директория фронтенда не найдена: {frontend_src}")

    print(f"\n🔧 Копирование бэкенда из {backend_src} в {backend_dst}")
    if backend_src.exists():

        if backend_dst.exists():
            shutil.rmtree(backend_dst)
            print("🗑️  Удалена старая копия бэкенда")

        backend_files = copy_directory_flat(backend_src, backend_dst, should_ignore_backend)
        print(f"✅ Бэкенд: скопировано {backend_files} файлов")
    else:
        print(f"❌ Директория бэкенда не найдена: {backend_src}")

    print("\n🎉 Копирование завершено!")
    print(f"📱 Фронтенд: {frontend_dst}")
    print(f"🔧 Бэкенд: {backend_dst}")

if __name__ == "__main__":
    main()
