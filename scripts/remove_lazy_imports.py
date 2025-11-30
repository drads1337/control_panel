#!/usr/bin/env python3
"""
Скрипт для удаления ленивых импортов get_service внутри методов/функций.
Оставляет только импорты на уровне модуля (если они нужны для fallback).
"""

import re
import ast
from pathlib import Path
from typing import List, Tuple
from datetime import datetime
import shutil

def find_lazy_imports(content: str) -> List[Tuple[int, str]]:
    """
    Находит все ленивые импорты get_service внутри методов/функций.
    Возвращает: [(line_num, line_content), ...]
    """
    lines = content.splitlines(keepends=True)
    result = []
    
    in_function = False
    in_method = False
    function_indent = 0
    method_indent = 0
    in_class = False
    class_indent = 0
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Определяем начало класса
        class_match = re.match(r'^class\s+\w+', stripped)
        if class_match:
            in_class = True
            class_indent = len(line) - len(line.lstrip())
            continue
        
        # Определяем конец класса
        if in_class and stripped:
            line_indent = len(line) - len(line.lstrip())
            if line_indent <= class_indent and (stripped.startswith('class ') or (stripped.startswith('def ') and not in_class)):
                in_class = False
                continue
        
        # Определяем начало функции/метода
        if stripped.startswith('def '):
            if in_class:
                in_method = True
                method_indent = len(line) - len(line.lstrip())
            else:
                in_function = True
                function_indent = len(line) - len(line.lstrip())
            continue
        
        # Определяем конец функции/метода
        if in_function or in_method:
            if stripped:
                line_indent = len(line) - len(line.lstrip())
                current_indent = method_indent if in_method else function_indent
                if line_indent <= current_indent and (stripped.startswith('def ') or stripped.startswith('class ')):
                    in_function = False
                    in_method = False
                    continue
        
        # Ищем ленивый импорт внутри функции/метода
        if (in_function or in_method) and 'from' in line and 'service_helpers' in line and 'get_service' in line:
            # Проверяем, что это действительно импорт
            if re.search(r'from\s+.*service_helpers.*import.*get_service', line):
                result.append((i, line))
    
    return result

def has_module_level_import(content: str) -> bool:
    """Проверяет, есть ли импорт get_service на уровне модуля"""
    lines = content.splitlines(keepends=True)
    
    in_class = False
    in_function = False
    class_indent = 0
    function_indent = 0
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Пропускаем комментарии и docstrings в начале файла
        if i < 50 and (stripped.startswith('#') or stripped.startswith('"""') or stripped.startswith("'''")):
            continue
        
        # Определяем начало класса
        if re.match(r'^class\s+\w+', stripped):
            in_class = True
            class_indent = len(line) - len(line.lstrip())
            continue
        
        # Определяем начало функции
        if stripped.startswith('def '):
            in_function = True
            function_indent = len(line) - len(line.lstrip())
            continue
        
        # Определяем конец класса/функции
        if in_class or in_function:
            if stripped:
                line_indent = len(line) - len(line.lstrip())
                current_indent = class_indent if in_class else function_indent
                if line_indent <= current_indent and (stripped.startswith('def ') or stripped.startswith('class ')):
                    in_class = False
                    in_function = False
                    continue
        
        # Ищем импорт на уровне модуля (не внутри класса/функции)
        if not in_class and not in_function:
            if re.search(r'from\s+.*service_helpers.*import.*get_service', line):
                return True
    
    return False

def remove_lazy_imports(file_path: Path, dry_run: bool = False) -> bool:
    """Удаляет ленивые импорты из файла"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        lines = content.splitlines(keepends=True)
        
        # Находим ленивые импорты
        lazy_imports = find_lazy_imports(content)
        
        if not lazy_imports:
            return False
        
        print(f"  Найдено ленивых импортов: {len(lazy_imports)}")
        
        # Удаляем ленивые импорты (с конца, чтобы не сбить индексы)
        for line_num, line_content in sorted(lazy_imports, reverse=True):
            print(f"    Удаление строки {line_num + 1}: {line_content.strip()}")
            if line_num < len(lines):
                del lines[line_num]
        
        # Проверяем, нужен ли импорт на уровне модуля
        new_content = ''.join(lines)
        needs_module_import = False
        
        # Проверяем, используется ли get_service в коде
        if 'get_service(' in new_content and not has_module_level_import(new_content):
            needs_module_import = True
            print(f"    ⚠️  get_service() используется, но нет импорта на уровне модуля")
            print(f"    → Добавляю импорт на уровне модуля")
            
            # Находим место для вставки импорта (после других импортов)
            import_insert_pos = 0
            for i, line in enumerate(lines):
                if line.strip().startswith('from ') or line.strip().startswith('import '):
                    import_insert_pos = i + 1
                elif line.strip() and not line.strip().startswith('#') and not line.strip().startswith('"""'):
                    break
            
            # Определяем правильный путь импорта (относительно backend/)
            file_str = str(file_path)
            if 'services' in file_str:
                # backend/services/xxx/yyy.py -> from ...utils.service_helpers import get_service
                import_line = 'from ...utils.service_helpers import get_service\n'
            elif 'routes' in file_str:
                # backend/routes/xxx.py -> from ..utils.service_helpers import get_service
                import_line = 'from ..utils.service_helpers import get_service\n'
            elif 'utils' in file_str:
                # backend/utils/xxx.py -> from .service_helpers import get_service
                import_line = 'from .service_helpers import get_service\n'
            elif 'tasks' in file_str:
                # backend/tasks/xxx.py -> from ..utils.service_helpers import get_service
                import_line = 'from ..utils.service_helpers import get_service\n'
            elif 'middleware' in file_str:
                # backend/middleware/xxx.py -> from ..utils.service_helpers import get_service
                import_line = 'from ..utils.service_helpers import get_service\n'
            elif 'models' in file_str:
                # backend/models/xxx.py -> from ..utils.service_helpers import get_service
                import_line = 'from ..utils.service_helpers import get_service\n'
            else:
                # По умолчанию
                import_line = 'from ..utils.service_helpers import get_service\n'
            
            lines.insert(import_insert_pos, import_line)
            new_content = ''.join(lines)
            print(f"    ✓ Импорт добавлен на строке {import_insert_pos + 1}")
        
        if new_content != original_content:
            if not dry_run:
                # Создаем резервную копию
                backup_path = file_path.with_suffix(f'.py.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
                shutil.copy2(file_path, backup_path)
                
                # Сохраняем изменения
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                print(f"  ✓ Файл обновлен, резервная копия: {backup_path.name}")
            else:
                print(f"  [DRY RUN] Будет удалено {len(lazy_imports)} ленивых импортов")
            return True
        
        return False
        
    except Exception as e:
        print(f"  ✗ Ошибка при обработке {file_path}: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Удаление ленивых импортов get_service внутри методов/функций'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Только показать что будет удалено, не выполнять удаление'
    )
    parser.add_argument(
        '--backend-dir',
        type=Path,
        default=Path(__file__).parent.parent / 'backend',
        help='Директория с backend кодом'
    )
    parser.add_argument(
        '--file',
        type=Path,
        help='Обработать только указанный файл'
    )
    
    args = parser.parse_args()
    
    if args.file:
        files_to_process = [args.file]
    else:
        # Находим все Python файлы с ленивыми импортами
        files_to_process = []
        for file_path in args.backend_dir.rglob('*.py'):
            if 'venv' in str(file_path) or '__pycache__' in str(file_path) or '.backup' in str(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Проверяем, есть ли ленивые импорты
                lazy_imports = find_lazy_imports(content)
                if lazy_imports:
                    files_to_process.append(file_path)
            except:
                pass
    
    print(f"Найдено {len(files_to_process)} файлов с ленивыми импортами")
    print()
    
    if not files_to_process:
        print("Нет файлов для обработки")
        return
    
    if args.dry_run:
        print("[DRY RUN MODE] Изменения не будут сохранены\n")
    else:
        response = input("Продолжить с удалением ленивых импортов? (yes/no): ")
        if response.lower() != 'yes':
            print("Отменено")
            return
    
    processed = 0
    for file_path in files_to_process:
        rel_path = file_path.relative_to(args.backend_dir.parent) if file_path.is_relative_to(args.backend_dir.parent) else file_path
        print(f"\nОбработка {rel_path}...")
        if remove_lazy_imports(file_path, dry_run=args.dry_run):
            processed += 1
    
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}✅ Обработка завершена: обработано {processed} файлов")

if __name__ == '__main__':
    main()

