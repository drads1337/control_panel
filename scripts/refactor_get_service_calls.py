#!/usr/bin/env python3
"""
Скрипт для автоматического рефакторинга вызовов get_service() внутри методов классов:
- Находит все вызовы get_service() внутри методов классов
- Добавляет недостающие зависимости в __init__
- Заменяет get_service('service_name') на self._service_name or get_service('service_name')
"""

import re
import ast
import sys
from pathlib import Path
from typing import List, Set, Dict, Tuple
from datetime import datetime
import shutil

def find_class_methods_with_get_service(content: str) -> Dict[str, List[Tuple[int, str, str]]]:
    """
    Находит все вызовы get_service() внутри методов классов.
    Возвращает: {class_name: [(line_num, method_name, service_name), ...]}
    """
    result = {}
    lines = content.splitlines(keepends=True)
    
    current_class = None
    current_method = None
    in_class = False
    in_method = False
    class_indent = 0
    method_indent = 0
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Определяем начало класса (пропускаем Enum, dataclass и т.д.)
        class_match = re.match(r'^class\s+(\w+).*:', stripped)
        if class_match:
            class_name = class_match.group(1)
            # Пропускаем служебные классы
            if class_name in ['DecisionType', 'Decision', 'ServiceScope', 'Task', 'MockTask', 
                            'DatabaseTask', 'Celery', 'ContextTask']:
                continue
            # Пропускаем если это dataclass или Enum
            if i > 0 and ('@dataclass' in lines[i-1] or 'Enum' in lines[i-1] or 'class ' in lines[i-1] and 'Enum' in lines[i-1]):
                continue
            current_class = class_name
            in_class = True
            class_indent = len(line) - len(line.lstrip())
            result[current_class] = []
            continue
        
        # Определяем конец класса (новый класс или функция на том же уровне)
        if in_class and stripped:
            line_indent = len(line) - len(line.lstrip())
            if line_indent <= class_indent:
                if stripped.startswith('class '):
                    in_class = False
                    current_class = None
                    continue
                elif stripped.startswith('def ') and not stripped.startswith('def __'):
                    # Функция на уровне класса - это не метод, значит вышли из класса
                    in_class = False
                    current_class = None
                    continue
        
        # Определяем начало метода
        if in_class and stripped.startswith('def '):
            method_match = re.match(r'^def\s+(\w+)\s*\(', stripped)
            if method_match:
                current_method = method_match.group(1)
                in_method = True
                method_indent = len(line) - len(line.lstrip())
                # Пропускаем __init__ и методы с _get_* (уже обработаны)
                if current_method == '__init__' or current_method.startswith('_get_'):
                    current_method = None
                    in_method = False
                continue
        
        # Определяем конец метода
        if in_method and stripped:
            line_indent = len(line) - len(line.lstrip())
            if line_indent <= method_indent and (stripped.startswith('def ') or stripped.startswith('class ') or stripped.startswith('@')):
                in_method = False
                current_method = None
                continue
        
        # Ищем get_service() внутри методов
        if in_class and in_method and current_method and 'get_service(' in line:
            # Ищем паттерн: get_service('service_name')
            matches = re.finditer(r"get_service\(['\"](\w+)['\"]\)", line)
            for match in matches:
                service_name = match.group(1)
                if current_class not in result:
                    result[current_class] = []
                result[current_class].append((i, current_method, service_name))
    
    return result

def find_init_method(content: str, class_name: str) -> Tuple[int, int, List[str]]:
    """
    Находит метод __init__ класса.
    Возвращает: (start_line, end_line, existing_params)
    """
    lines = content.splitlines(keepends=True)
    
    in_class = False
    class_indent = 0
    init_start = -1
    init_end = -1
    existing_params = []
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Находим класс
        if re.match(rf'^class\s+{re.escape(class_name)}', stripped):
            in_class = True
            class_indent = len(line) - len(line.lstrip())
            continue
        
        # Выходим из класса
        if in_class and stripped:
            line_indent = len(line) - len(line.lstrip())
            if line_indent <= class_indent and (stripped.startswith('class ') or (stripped.startswith('def ') and not stripped.startswith('def __init__'))):
                if init_start == -1:
                    # __init__ не найден, нужно создать
                    return (-1, -1, [])
                break
        
        # Находим __init__
        if in_class and re.match(r'^def\s+__init__\s*\(', stripped):
            init_start = i
            init_indent = len(line) - len(line.lstrip())
            
            # Извлекаем параметры из строки def
            params_match = re.search(r'__init__\s*\((.*?)\)', line)
            if params_match:
                params_str = params_match.group(1)
                # Простой парсинг параметров (без значений по умолчанию)
                for param in params_str.split(','):
                    param = param.strip()
                    if param and param != 'self':
                        param_name = param.split('=')[0].strip()
                        if param_name:
                            existing_params.append(param_name)
            
            # Ищем конец метода
            for j in range(i + 1, len(lines)):
                j_line = lines[j]
                j_stripped = j_line.strip()
                if j_stripped:
                    j_indent = len(j_line) - len(j_line.lstrip())
                    if j_indent <= init_indent and (j_stripped.startswith('def ') or j_stripped.startswith('class ') or j_stripped.startswith('@')):
                        init_end = j
                        break
            else:
                init_end = len(lines)
            
            break
    
    return (init_start, init_end, existing_params)

def add_service_to_init(content: str, class_name: str, service_name: str, existing_params: List[str]) -> str:
    """Добавляет сервис в __init__ если его там еще нет"""
    lines = content.splitlines(keepends=True)
    init_start, init_end, _ = find_init_method(content, class_name)
    
    if init_start == -1:
        # Нужно создать __init__
        # Найдем место после определения класса
        class_line = -1
        for i, line in enumerate(lines):
            if re.match(rf'^class\s+{re.escape(class_name)}', line.strip()):
                class_line = i
                break
        
        if class_line == -1:
            return content
        
        # Найдем отступ класса
        class_indent = len(lines[class_line]) - len(lines[class_line].lstrip())
        method_indent = class_indent + 4
        
        # Создаем __init__
        init_code = [
            ' ' * method_indent + f'def __init__(self, {service_name}=None):\n',
            ' ' * (method_indent + 4) + f'"""Initialize {class_name} with dependencies"""\n',
            ' ' * (method_indent + 4) + f'self._{service_name} = {service_name}\n',
        ]
        
        # Вставляем после класса
        insert_pos = class_line + 1
        # Пропускаем docstring если есть
        if insert_pos < len(lines) and lines[insert_pos].strip().startswith('"""'):
            while insert_pos < len(lines) and not lines[insert_pos].strip().endswith('"""'):
                insert_pos += 1
            insert_pos += 1
        
        lines[insert_pos:insert_pos] = init_code
        return ''.join(lines)
    
    # Добавляем параметр в существующий __init__
    init_line = lines[init_start]
    
    # Проверяем, есть ли уже этот параметр
    if service_name in existing_params or f'_{service_name}' in existing_params:
        return content
    
    # Находим строку с def __init__
    params_match = re.search(r'__init__\s*\((.*?)\)', init_line)
    if params_match:
        params_str = params_match.group(1)
        # Добавляем параметр
        if params_str.strip() and not params_str.strip().endswith(','):
            params_str += ', '
        params_str += f'{service_name}=None'
        
        new_init_line = re.sub(r'__init__\s*\(.*?\)', f'__init__({params_str})', init_line)
        lines[init_start] = new_init_line
        
        # Добавляем присваивание в тело __init__
        init_indent = len(lines[init_start]) - len(lines[init_start].lstrip())
        body_indent = init_indent + 4
        
        # Находим место для вставки (после docstring если есть)
        insert_pos = init_start + 1
        if insert_pos < init_end and lines[insert_pos].strip().startswith('"""'):
            while insert_pos < init_end and not lines[insert_pos].strip().endswith('"""'):
                insert_pos += 1
            insert_pos += 1
        
        # Проверяем, нет ли уже такого присваивания
        for i in range(insert_pos, init_end):
            if f'self._{service_name}' in lines[i]:
                return ''.join(lines)
        
        # Вставляем присваивание
        assign_line = ' ' * body_indent + f'self._{service_name} = {service_name}\n'
        lines[insert_pos:insert_pos] = [assign_line]
    
    return ''.join(lines)

def replace_get_service_calls(content: str, class_name: str, service_usages: List[Tuple[int, str, str]]) -> str:
    """Заменяет вызовы get_service() на использование зависимостей"""
    lines = content.splitlines(keepends=True)
    changes = 0
    
    for line_num, method_name, service_name in service_usages:
        if line_num >= len(lines):
            continue
        
        line = lines[line_num]
        
        # Заменяем get_service('service_name') на self._service_name or get_service('service_name')
        # Но только если это не уже заменено
        if f'self._{service_name}' not in line:
            new_line = re.sub(
                rf"get_service\(['\"]{re.escape(service_name)}['\"]\)",
                f'self._{service_name} or get_service(\'{service_name}\')',
                line
            )
            if new_line != line:
                lines[line_num] = new_line
                changes += 1
    
    return ''.join(lines), changes

def refactor_file(file_path: Path, dry_run: bool = False) -> bool:
    """Рефакторит один файл"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Находим все использования get_service() в методах классов
        class_usages = find_class_methods_with_get_service(content)
        
        if not class_usages:
            return False
        
        print(f"  Найдено классов с get_service(): {len(class_usages)}")
        
        total_changes = 0
        
        for class_name, usages in class_usages.items():
            print(f"    Класс {class_name}: {len(usages)} использований")
            
            # Собираем уникальные сервисы для этого класса
            services_needed = sorted(set(service for _, _, service in usages))
            
            # Добавляем зависимости в __init__
            for service_name in services_needed:
                init_start, init_end, existing_params = find_init_method(content, class_name)
                
                # Проверяем, нужно ли добавлять
                needs_add = True
                if init_start != -1:
                    # Проверяем существующие параметры
                    init_lines = content.splitlines(keepends=True)[init_start:init_end]
                    init_content = ''.join(init_lines)
                    if service_name in existing_params or f'_{service_name}' in existing_params:
                        needs_add = False
                    # Также проверяем, есть ли уже присваивание
                    if f'self._{service_name}' in init_content:
                        needs_add = False
                
                if needs_add:
                    content = add_service_to_init(content, class_name, service_name, existing_params)
                    print(f"      Добавлен {service_name} в __init__")
                    total_changes += 1
            
            # Заменяем вызовы get_service()
            new_content, changes = replace_get_service_calls(content, class_name, usages)
            if changes > 0:
                content = new_content
                print(f"      Заменено {changes} вызовов get_service()")
                total_changes += changes
        
        if content != original_content and total_changes > 0:
            if not dry_run:
                # Создаем резервную копию
                backup_path = file_path.with_suffix(f'.py.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
                shutil.copy2(file_path, backup_path)
                
                # Сохраняем изменения
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                print(f"  ✓ Файл отрефакторен ({total_changes} изменений), резервная копия: {backup_path.name}")
            else:
                print(f"  [DRY RUN] Будет изменено: {total_changes} использований")
            return True
        
        return False
        
    except Exception as e:
        print(f"  ✗ Ошибка при рефакторинге {file_path}: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Рефакторинг вызовов get_service() внутри методов классов'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Только показать что будет изменено, не выполнять рефакторинг'
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
        help='Рефакторить только указанный файл'
    )
    
    args = parser.parse_args()
    
    if args.file:
        files_to_process = [args.file]
    else:
        # Находим все Python файлы с get_service()
        files_to_process = []
        for file_path in args.backend_dir.rglob('*.py'):
            if 'venv' in str(file_path) or '__pycache__' in str(file_path) or '.backup' in str(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Проверяем, есть ли get_service() в методах классов
                class_usages = find_class_methods_with_get_service(content)
                if class_usages:
                    files_to_process.append(file_path)
            except:
                pass
    
    print(f"Найдено {len(files_to_process)} файлов с get_service() в методах классов")
    print()
    
    if not files_to_process:
        print("Нет файлов для рефакторинга")
        return
    
    if args.dry_run:
        print("[DRY RUN MODE] Изменения не будут сохранены\n")
    else:
        response = input("Продолжить с автоматическим рефакторингом? (yes/no): ")
        if response.lower() != 'yes':
            print("Отменено")
            return
    
    refactored = 0
    for file_path in files_to_process:
        rel_path = file_path.relative_to(args.backend_dir.parent) if file_path.is_relative_to(args.backend_dir.parent) else file_path
        print(f"\nРефакторинг {rel_path}...")
        if refactor_file(file_path, dry_run=args.dry_run):
            refactored += 1
    
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}✅ Рефакторинг завершен: обработано {refactored} файлов")

if __name__ == '__main__':
    main()

