
"""
Скрипт для копирования файлов проекта в отдельные директории.
Копирует .py файлы из backend/ и файлы фронтенда (.ts, .tsx, .js, .jsx, .css) из frontend/src/,
исключая ненужные файлы.
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

def collect_files(src: Path, ignore_func=None, allowed_extensions=None) -> List[Path]:
    """
    Собирает все файлы из директории, соответствующие критериям.

    Args:
        src: Исходная директория
        ignore_func: Функция для проверки игнорирования файлов
        allowed_extensions: Список разрешенных расширений файлов

    Returns:
        Список путей к файлам
    """
    files = []

    if not src.exists():
        return files

    if allowed_extensions is None:
        allowed_extensions = ['.py']

    for root, dirs, file_names in os.walk(src):
        root_path = Path(root)

        if ignore_func:
            dirs[:] = [d for d in dirs if not ignore_func(root_path / d)]

        for file in file_names:
            src_file = root_path / file

            # Копируем только файлы с разрешенными расширениями
            if src_file.suffix not in allowed_extensions:
                continue

            if ignore_func and ignore_func(src_file):
                continue

            files.append(src_file)

    return files

def copy_file_to_flat(src_file: Path, src_base: Path, dst: Path) -> bool:
    """
    Копирует один файл в плоскую директорию с обработкой конфликтов имен.

    Args:
        src_file: Исходный файл
        src_base: Базовая директория для относительных путей
        dst: Целевая директория

    Returns:
        True если файл успешно скопирован, False в противном случае
    """
    file = src_file.name

    # Для .ts, .tsx и .py файлов добавляем .txt к расширению
    if src_file.suffix == '.tsx':
        original_name = file.rsplit('.', 1)[0] + '.tsx.txt'
    elif src_file.suffix == '.ts':
        original_name = file.rsplit('.', 1)[0] + '.ts.txt'
    elif src_file.suffix == '.py':
        original_name = file.rsplit('.', 1)[0] + '.py.txt'
    else:
        original_name = file
    
    dst_file = dst / original_name
    counter = 1
    while dst_file.exists():
        # Обработка конфликтов имен
        if original_name.endswith('.tsx.txt'):
            name_without_ext = original_name.rsplit('.tsx.txt', 1)[0]
            new_name = f"{name_without_ext}_{counter}.tsx.txt"
        elif original_name.endswith('.ts.txt'):
            name_without_ext = original_name.rsplit('.ts.txt', 1)[0]
            new_name = f"{name_without_ext}_{counter}.ts.txt"
        elif original_name.endswith('.py.txt'):
            name_without_ext = original_name.rsplit('.py.txt', 1)[0]
            new_name = f"{name_without_ext}_{counter}.py.txt"
        else:
            name_parts = original_name.rsplit('.', 1)
            if len(name_parts) == 2:
                new_name = f"{name_parts[0]}_{counter}.{name_parts[1]}"
            else:
                new_name = f"{original_name}_{counter}"
        dst_file = dst / new_name
        counter += 1

    try:
        shutil.copy2(src_file, dst_file)
        print(f"✅ Скопирован: {src_file.relative_to(src_base)} -> {dst_file.name}")
        return True
    except Exception as e:
        print(f"❌ Ошибка копирования {src_file}: {e}")
        return False

def copy_directory_flat(src: Path, dst: Path, ignore_func=None, allowed_extensions=None) -> int:
    """
    Копирует все файлы из директории в одну плоскую папку без подпапок.

    Args:
        src: Исходная директория
        dst: Целевая директория
        ignore_func: Функция для проверки игнорирования файлов
        allowed_extensions: Список разрешенных расширений файлов (например, ['.py'] или ['.ts', '.tsx', '.js', '.jsx', '.css'])

    Returns:
        Количество скопированных файлов
    """
    if not src.exists():
        print(f"❌ Исходная директория не найдена: {src}")
        return 0

    # По умолчанию для бэкенда копируем только .py файлы
    if allowed_extensions is None:
        allowed_extensions = ['.py']

    dst.mkdir(parents=True, exist_ok=True)

    files = collect_files(src, ignore_func, allowed_extensions)
    copied_files = 0

    for src_file in files:
        if copy_file_to_flat(src_file, src, dst):
            copied_files += 1

    return copied_files

def build_directory_tree(files: List[Path], base_path: Path) -> dict:
    """
    Строит дерево директорий из списка файлов.
    
    Args:
        files: Список путей к файлам
        base_path: Базовая директория для относительных путей
        
    Returns:
        Словарь, представляющий дерево директорий
    """
    tree = {}
    
    for file_path in files:
        # Получаем относительный путь от базовой директории
        try:
            rel_path = file_path.relative_to(base_path)
        except ValueError:
            rel_path = file_path
        
        # Разбиваем путь на части
        parts = rel_path.parts
        current = tree
        
        # Создаем структуру директорий
        for part in parts[:-1]:  # Все части кроме имени файла
            if part not in current:
                current[part] = {}
            current = current[part]
        
        # Добавляем файл
        filename = parts[-1]
        if '__files__' not in current:
            current['__files__'] = []
        current['__files__'].append((filename, file_path))
    
    return tree

def format_tree_markdown(tree: dict, base_path: Path, indent: int = 0, prefix: str = "") -> List[str]:
    """
    Форматирует дерево директорий в Markdown формат.
    
    Args:
        tree: Дерево директорий
        base_path: Базовая директория
        indent: Текущий отступ
        prefix: Префикс для текущей строки
        
    Returns:
        Список строк Markdown
    """
    lines = []
    items = []
    
    # Собираем директории и файлы
    for key, value in sorted(tree.items()):
        if key == '__files__':
            continue
        items.append((key, value, True))  # True = директория
    
    # Добавляем файлы в конец
    if '__files__' in tree:
        for filename, file_path in sorted(tree['__files__'], key=lambda x: x[0]):
            items.append((filename, file_path, False))  # False = файл
    
    # Формируем строки
    for i, (name, value, is_dir) in enumerate(items):
        is_last = i == len(items) - 1
        current_prefix = "└── " if is_last else "├── "
        connector = "    " if is_last else "│   "
        
        if is_dir:
            lines.append(f"{prefix}{current_prefix}{name}/")
            next_prefix = prefix + connector
            lines.extend(format_tree_markdown(value, base_path, indent + 1, next_prefix))
        else:
            # Это файл
            file_path = value
            try:
                file_size = file_path.stat().st_size
                size_kb = file_size / 1024
                size_str = f" ({size_kb:.2f} KB)" if size_kb > 0 else ""
            except:
                size_str = ""
            lines.append(f"{prefix}{current_prefix}{name}{size_str}")
    
    return lines

def generate_file_tree_markdown(source_files: List[Path], base_path: Path, output_file: Path, title: str = "File Tree") -> bool:
    """
    Генерирует дерево файлов в формате Markdown с оригинальной структурой директорий.

    Args:
        source_files: Список исходных файлов с их путями
        base_path: Базовая директория для относительных путей
        output_file: Путь к выходному .md файлу
        title: Заголовок для Markdown файла

    Returns:
        True если файл успешно создан, False в противном случае
    """
    if not source_files:
        print(f"⚠️  Нет файлов для генерации дерева")
        return False

    # Строим дерево директорий
    tree = build_directory_tree(source_files, base_path)
    
    # Генерируем Markdown
    markdown_lines = [
        f"# {title}",
        "",
        f"**Базовая директория:** `{base_path}`",
        f"**Всего файлов:** {len(source_files)}",
        "",
        "## Структура директорий",
        "",
        "```",
    ]
    
    # Добавляем имя корневой директории
    base_name = base_path.name if base_path.name else str(base_path)
    markdown_lines.append(f"{base_name}/")
    
    # Формируем дерево
    tree_lines = format_tree_markdown(tree, base_path)
    markdown_lines.extend(tree_lines)
    
    markdown_lines.append("```")
    markdown_lines.append("")
    markdown_lines.append("## Детальный список файлов")
    markdown_lines.append("")
    
    # Сортируем файлы по пути
    sorted_files = sorted(source_files, key=lambda p: str(p.relative_to(base_path) if base_path in p.parents else p))
    
    for i, file_path in enumerate(sorted_files, 1):
        try:
            rel_path = file_path.relative_to(base_path)
        except ValueError:
            rel_path = file_path
        
        try:
            file_size = file_path.stat().st_size
            size_kb = file_size / 1024
            size_str = f" ({size_kb:.2f} KB)"
        except:
            size_str = ""
        
        markdown_lines.append(f"{i}. `{rel_path}`{size_str}")
    
    markdown_lines.append("")

    # Сохраняем в файл
    try:
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(markdown_lines))
        print(f"📄 Создано дерево файлов: {output_file}")
        return True
    except Exception as e:
        print(f"❌ Ошибка создания дерева файлов {output_file}: {e}")
        return False

def main():
    """Основная функция скрипта."""

    project_root = Path(__file__).parent
    print(f"📁 Корневая директория проекта: {project_root}")

    frontend_src = project_root / "frontend" / "src"
    backend_src = project_root / "backend"

    # Создаем главную директорию copy
    copy_dir = project_root / "copy"
    backend_dst = copy_dir / "backend"

    # Удаляем старую директорию copy если существует
    if copy_dir.exists():
        shutil.rmtree(copy_dir)
        print("🗑️  Удалена старая директория copy")

    print("\n🚀 Начинаем копирование файлов...")

    print(f"\n📱 Копирование фронтенда из {frontend_src}")
    if frontend_src.exists():
        # Собираем все файлы фронтенда
        frontend_extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json']
        frontend_files_list = collect_files(
            frontend_src,
            should_ignore_frontend,
            allowed_extensions=frontend_extensions
        )

        total_files = len(frontend_files_list)
        print(f"📊 Найдено файлов фронтенда: {total_files}")

        if total_files == 0:
            print("⚠️  Файлы фронтенда не найдены")
        else:
            # Разделяем файлы на две части (50/50)
            mid_point = total_files // 2
            first_half = frontend_files_list[:mid_point]
            second_half = frontend_files_list[mid_point:]

            frontend_dst_part1 = copy_dir / "frontend_part1"
            frontend_dst_part2 = copy_dir / "frontend_part2"

            # Копируем первую половину
            frontend_dst_part1.mkdir(parents=True, exist_ok=True)
            print(f"\n📦 Копирование первой части ({len(first_half)} файлов) в {frontend_dst_part1}")
            copied_part1 = 0
            for src_file in first_half:
                if copy_file_to_flat(src_file, frontend_src, frontend_dst_part1):
                    copied_part1 += 1
            print(f"✅ Фронтенд часть 1: скопировано {copied_part1} файлов")

            # Копируем вторую половину
            frontend_dst_part2.mkdir(parents=True, exist_ok=True)
            print(f"\n📦 Копирование второй части ({len(second_half)} файлов) в {frontend_dst_part2}")
            copied_part2 = 0
            for src_file in second_half:
                if copy_file_to_flat(src_file, frontend_src, frontend_dst_part2):
                    copied_part2 += 1
            print(f"✅ Фронтенд часть 2: скопировано {copied_part2} файлов")

            print(f"📊 Всего скопировано файлов фронтенда: {copied_part1 + copied_part2}")
            
            # Генерируем дерево файлов для фронтенда
            print(f"\n📝 Генерация дерева файлов фронтенда...")
            generate_file_tree_markdown(
                first_half,
                frontend_src,
                copy_dir / "frontend_part1_tree.md",
                "Frontend Files Tree - Part 1"
            )
            generate_file_tree_markdown(
                second_half,
                frontend_src,
                copy_dir / "frontend_part2_tree.md",
                "Frontend Files Tree - Part 2"
            )
            
            # Создаем объединенное дерево для всего фронтенда
            generate_file_tree_markdown(
                frontend_files_list,
                frontend_src,
                copy_dir / "frontend_tree.md",
                "Frontend Files Tree - Complete"
            )
    else:
        print(f"❌ Директория фронтенда не найдена: {frontend_src}")

    print(f"\n🔧 Копирование бэкенда из {backend_src} в {backend_dst}")
    if backend_src.exists():
        # Собираем список исходных файлов бэкенда
        backend_files_list = collect_files(
            backend_src,
            should_ignore_backend,
            allowed_extensions=['.py']
        )

        # Копируем только .py файлы бэкенда
        backend_files = copy_directory_flat(
            backend_src, 
            backend_dst, 
            should_ignore_backend,
            allowed_extensions=['.py']
        )
        print(f"✅ Бэкенд: скопировано {backend_files} файлов")
        
        # Генерируем дерево файлов для бэкенда
        print(f"\n📝 Генерация дерева файлов бэкенда...")
        generate_file_tree_markdown(
            backend_files_list,
            backend_src,
            copy_dir / "backend_tree.md",
            "Backend Files Tree"
        )
    else:
        print(f"❌ Директория бэкенда не найдена: {backend_src}")

    print("\n🎉 Копирование завершено!")
    print(f"📂 Все файлы скопированы в директорию: {copy_dir}")
    print(f"📱 Фронтенд часть 1: {copy_dir / 'frontend_part1'}")
    print(f"📱 Фронтенд часть 2: {copy_dir / 'frontend_part2'}")
    print(f"🔧 Бэкенд: {backend_dst}")
    print(f"\n📄 Созданные файлы деревьев в директории {copy_dir}:")
    print(f"   - frontend_part1_tree.md")
    print(f"   - frontend_part2_tree.md")
    print(f"   - frontend_tree.md (объединенное)")
    print(f"   - backend_tree.md")

if __name__ == "__main__":
    main()
