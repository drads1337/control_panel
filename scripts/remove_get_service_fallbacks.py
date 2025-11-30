#!/usr/bin/env python3
"""
Скрипт для автоматического удаления fallback на get_service() из сервисов.

Находит паттерны:
- self._service_name or get_service('service_name')
- get_service('service_name')

И заменяет их на:
- Проверку if not self._service_name: raise ServiceError(...)
- Использование только self._service_name

Исключает backup файлы и файлы в venv/__pycache__.
"""

import re
import sys
from pathlib import Path
from typing import List, Set, Tuple
from datetime import datetime
import shutil

def should_process_file(file_path: Path) -> bool:
    """Проверяет, нужно ли обрабатывать файл"""
    path_str = str(file_path)
    
    # Исключаем backup файлы
    if '.backup' in path_str:
        return False
    
    # Исключаем venv и __pycache__
    if 'venv' in path_str or '__pycache__' in path_str:
        return False
    
    # Обрабатываем только Python файлы в services
    if not path_str.endswith('.py'):
        return False
    
    if 'services' not in path_str:
        return False
    
    return True

def find_get_service_patterns(content: str) -> List[Tuple[int, str, str]]:
    """
    Находит все использования get_service() в файле.
    Возвращает: [(line_num, full_line, service_name), ...]
    """
    patterns = []
    lines = content.splitlines(keepends=True)
    
    for i, line in enumerate(lines):
        # Паттерн 1: self._service_name or get_service('service_name')
        # Также обрабатываем: return self._service or get_service(...)
        match1 = re.search(r'self\._(\w+)\s+or\s+get_service\([\'"](\w+)[\'"]\)', line)
        if match1:
            service_var = match1.group(1)
            service_name = match1.group(2)
            patterns.append((i, line, service_var, service_name))
            continue
        
        # Паттерн 2: get_service('service_name') (без self._service_name)
        match2 = re.search(r'get_service\([\'"](\w+)[\'"]\)', line)
        if match2:
            service_name = match2.group(1)
            # Пропускаем если это уже в паттерне 1 или это комментарий
            if 'self._' not in line and not line.strip().startswith('#'):
                # Пытаемся определить имя переменной из контекста
                # Ищем присваивание: service_name = get_service(...)
                var_match = re.search(r'(\w+)\s*=\s*get_service\(', line)
                if var_match:
                    var_name = var_match.group(1)
                    # Если это не self._service_name
                    if not var_name.startswith('self._'):
                        # Если имя переменной совпадает с именем сервиса, заменяем на self._service_name
                        if var_name == service_name:
                            service_var = service_name
                            patterns.append((i, line, service_var, service_name))
                        # Если имя переменной похоже на имя сервиса
                        elif service_name.endswith('_service') and var_name == service_name:
                            service_var = service_name
                            patterns.append((i, line, service_var, service_name))
                        # Если имя переменной содержит имя сервиса (например: project_relationships_service)
                        elif service_name in var_name or var_name in service_name:
                            # Используем имя сервиса как service_var
                            service_var = service_name
                            patterns.append((i, line, service_var, service_name))
                        else:
                            # Не можем определить, пропускаем
                            continue
                    else:
                        service_var = var_name.replace('self._', '')
                        patterns.append((i, line, service_var, service_name))
                else:
                    # Не можем определить переменную, пропускаем
                    continue
    
    return patterns

def has_service_error_import(content: str) -> bool:
    """Проверяет, есть ли импорт ServiceError"""
    return 'from ...utils.service_exceptions import' in content or \
           'from ..utils.service_exceptions import' in content or \
           'from .utils.service_exceptions import' in content

def add_service_error_import(content: str) -> str:
    """Добавляет импорт ServiceError если его нет"""
    if has_service_error_import(content):
        return content
    
    lines = content.splitlines(keepends=True)
    
    # Ищем место для импорта (после других импортов из utils)
    insert_pos = -1
    for i, line in enumerate(lines):
        if 'from ...utils' in line or 'from ..utils' in line:
            insert_pos = i + 1
            break
    
    if insert_pos == -1:
        # Ищем любой импорт
        for i, line in enumerate(lines):
            if line.strip().startswith('import ') or line.strip().startswith('from '):
                insert_pos = i + 1
                break
    
    if insert_pos == -1:
        insert_pos = 0
    
    # Определяем правильный путь импорта (считаем уровень вложенности)
    file_path = Path(content) if isinstance(content, Path) else None
    if file_path:
        depth = len(file_path.parts) - len(Path('backend/services').parts)
        import_path = '...' if depth > 0 else '..'
    else:
        import_path = '...'  # По умолчанию для services
    
    import_line = f'from {import_path}.utils.service_exceptions import ServiceError\n'
    
    lines.insert(insert_pos, import_line)
    return ''.join(lines)

def replace_get_service_patterns(content: str, patterns: List[Tuple[int, str, str, str]]) -> Tuple[str, int]:
    """
    Заменяет паттерны get_service() на проверки зависимостей.
    Возвращает: (новый контент, количество изменений)
    """
    if not patterns:
        return content, 0
    
    lines = content.splitlines(keepends=True)
    changes = 0
    lines_to_insert = {}  # {line_num: [lines to insert before]}
    
    # Добавляем импорт ServiceError если нужно
    if not has_service_error_import(content):
        content = add_service_error_import(content)
        lines = content.splitlines(keepends=True)
        changes += 1
    
    for line_num, original_line, service_var, service_name in patterns:
        if line_num >= len(lines):
            continue
        
        line = lines[line_num]
        indent = len(line) - len(line.lstrip())
        indent_str = ' ' * indent
        
        # Паттерн 1: self._service_name or get_service('service_name')
        if f'self._{service_var} or get_service' in line:
            # Заменяем на проверку и использование
            # Находим где используется результат
            if '=' in line:
                # Присваивание: service = self._service or get_service(...)
                var_match = re.search(r'(\w+)\s*=\s*self\._' + re.escape(service_var), line)
                if var_match:
                    var_name = var_match.group(1)
                    # Заменяем всю строку
                    new_line = line.replace(
                        f'self._{service_var} or get_service(\'{service_name}\')',
                        f'self._{service_var}'
                    )
                    # Добавляем проверку перед этой строкой
                    check_lines = [
                        f'{indent_str}if not self._{service_var}:\n',
                        f'{indent_str}    raise ServiceError(\n',
                        f'{indent_str}        "{service_var.replace("_", " ").title()} dependency not injected",\n',
                        f'{indent_str}        status_code=500\n',
                        f'{indent_str}    )\n'
                    ]
                    lines_to_insert[line_num] = check_lines
                    lines[line_num] = new_line
                    changes += 1
            elif line.strip().startswith('return'):
                # return self._service or get_service(...)
                new_line = line.replace(
                    f'self._{service_var} or get_service(\'{service_name}\')',
                    f'self._{service_var}'
                )
                # Добавляем проверку перед
                check_lines = [
                    f'{indent_str}if not self._{service_var}:\n',
                    f'{indent_str}    raise ServiceError(\n',
                    f'{indent_str}        "{service_var.replace("_", " ").title()} dependency not injected",\n',
                    f'{indent_str}        status_code=500\n',
                    f'{indent_str}    )\n'
                ]
                lines_to_insert[line_num] = check_lines
                lines[line_num] = new_line
                changes += 1
            else:
                # Использование без присваивания
                new_line = line.replace(
                    f'self._{service_var} or get_service(\'{service_name}\')',
                    f'self._{service_var}'
                )
                # Добавляем проверку перед
                check_lines = [
                    f'{indent_str}if not self._{service_var}:\n',
                    f'{indent_str}    raise ServiceError(\n',
                    f'{indent_str}        "{service_var.replace("_", " ").title()} dependency not injected",\n',
                    f'{indent_str}        status_code=500\n',
                    f'{indent_str}    )\n'
                ]
                lines_to_insert[line_num] = check_lines
                lines[line_num] = new_line
                changes += 1
        
        # Паттерн 2: get_service('service_name') без self._service_name
        elif f'get_service(\'{service_name}\')' in line and f'self._{service_var}' not in line:
            # Определяем имя переменной из строки
            var_match = re.search(r'(\w+)\s*=\s*get_service\(', line)
            if var_match:
                var_name = var_match.group(1)
                # Если переменная не начинается с self._, заменяем на self._service_var
                if not var_name.startswith('self._'):
                    # Если имя переменной совпадает с именем сервиса, заменяем на self._service_name
                    if var_name == service_name:
                        # Заменяем service_name = get_service(...) на service_name = self._service_name
                        new_line = re.sub(
                            rf'{re.escape(var_name)}\s*=\s*get_service\([\'"]{re.escape(service_name)}[\'"]\)',
                            rf'{var_name} = self._{service_var}',
                            line
                        )
                    else:
                        # Заменяем var_name = get_service(...) на var_name = self._service_var
                        new_line = re.sub(
                            rf'{re.escape(var_name)}\s*=\s*get_service\([\'"]{re.escape(service_name)}[\'"]\)',
                            rf'{var_name} = self._{service_var}',
                            line
                        )
                else:
                    # Уже self._var_name, просто заменяем get_service
                    new_line = line.replace(
                        f'get_service(\'{service_name}\')',
                        f'self._{service_var}'
                    )
            else:
                # Использование без присваивания
                new_line = line.replace(
                    f'get_service(\'{service_name}\')',
                    f'self._{service_var}'
                )
            
            # Добавляем проверку перед
            check_lines = [
                f'{indent_str}if not self._{service_var}:\n',
                f'{indent_str}    raise ServiceError(\n',
                f'{indent_str}        "{service_var.replace("_", " ").title()} dependency not injected",\n',
                f'{indent_str}        status_code=500\n',
                f'{indent_str}    )\n'
            ]
            lines_to_insert[line_num] = check_lines
            lines[line_num] = new_line
            changes += 1
    
    # Вставляем проверки (в обратном порядке, чтобы не сбить индексы)
    for line_num in sorted(lines_to_insert.keys(), reverse=True):
        lines[line_num:line_num] = lines_to_insert[line_num]
    
    return ''.join(lines), changes

def process_file(file_path: Path, dry_run: bool = False) -> bool:
    """Обрабатывает один файл"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Находим паттерны
        patterns = find_get_service_patterns(content)
        
        if not patterns:
            return False
        
        print(f"  Найдено {len(patterns)} использований get_service()")
        
        # Заменяем паттерны
        new_content, changes = replace_get_service_patterns(content, patterns)
        
        if new_content != original_content and changes > 0:
            if not dry_run:
                # Создаем резервную копию
                backup_path = file_path.with_suffix(f'.py.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
                shutil.copy2(file_path, backup_path)
                
                # Сохраняем изменения
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                print(f"  ✓ Файл обновлен ({changes} изменений), резервная копия: {backup_path.name}")
            else:
                print(f"  [DRY RUN] Будет изменено: {changes} использований")
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
        description='Удаление fallback на get_service() из сервисов'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Только показать что будет изменено, не выполнять изменения'
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
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Автоматически подтвердить все изменения (не спрашивать)'
    )
    
    args = parser.parse_args()
    
    if args.file:
        files_to_process = [args.file]
    else:
        # Находим все Python файлы в services
        files_to_process = []
        services_dir = args.backend_dir / 'services'
        
        if not services_dir.exists():
            print(f"Директория {services_dir} не найдена")
            return
        
        for file_path in services_dir.rglob('*.py'):
            if should_process_file(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Проверяем, есть ли get_service()
                    if 'get_service(' in content:
                        patterns = find_get_service_patterns(content)
                        if patterns:
                            files_to_process.append(file_path)
                except:
                    pass
    
    print(f"Найдено {len(files_to_process)} файлов с get_service()")
    print()
    
    if not files_to_process:
        print("Нет файлов для обработки")
        return
    
    if args.dry_run:
        print("[DRY RUN MODE] Изменения не будут сохранены\n")
    elif not args.yes:
        response = input("Продолжить с автоматическим удалением get_service()? (yes/no): ")
        if response.lower() != 'yes':
            print("Отменено")
            return
    
    processed = 0
    for file_path in files_to_process:
        rel_path = file_path.relative_to(args.backend_dir.parent) if file_path.is_relative_to(args.backend_dir.parent) else file_path
        print(f"\nОбработка {rel_path}...")
        if process_file(file_path, dry_run=args.dry_run):
            processed += 1
    
    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}✅ Обработка завершена: обработано {processed} файлов")

if __name__ == '__main__':
    main()

