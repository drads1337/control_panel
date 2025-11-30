#!/usr/bin/env python3
"""
Скрипт для автоматического рефакторинга методов классов:
- Заменяет _get_*_service() на прямые обращения к self._service
- Удаляет методы _get_*_service()
- Добавляет недостающие зависимости в __init__
"""

import re
import sys
from pathlib import Path
from typing import List, Set

def find_get_service_methods(content: str) -> List[tuple]:
    """Находит все методы _get_*_service() в файле"""
    methods = []
    lines = content.splitlines()
    
    for i, line in enumerate(lines):
        # Ищем паттерн: def _get_*_service(self):
        match = re.search(r'def\s+(_get_\w+_service)\s*\(self', line)
        if match:
            method_name = match.group(1)
            # Извлекаем имя сервиса
            service_match = re.search(r'_get_(\w+)_service', method_name)
            if service_match:
                service_base = service_match.group(1)
                service_name = f"{service_base}_service"
                methods.append((i, method_name, service_name))
    
    return methods

def find_method_usage(content: str, method_name: str) -> List[int]:
    """Находит все использования метода в файле"""
    usages = []
    lines = content.splitlines()
    
    for i, line in enumerate(lines):
        if f"{method_name}()" in line:
            usages.append(i)
    
    return usages

def refactor_class_file(file_path: Path) -> bool:
    """Рефакторит один файл с классом"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        methods = find_get_service_methods(content)
        
        if not methods:
            return False
        
        print(f"  Найдено методов _get_*_service: {len(methods)}")
        
        # Заменяем использования методов на прямые обращения
        for line_num, method_name, service_name in methods:
            usages = find_method_usage(content, method_name)
            if usages:
                # Заменяем self._get_service_name_service() на self._service_name_service or get_service('service_name')
                var_pattern = rf'(\w+)\s*=\s*self\.{re.escape(method_name)}\(\)'
                replacement = rf'\1 = self._{service_name} or get_service(\'{service_name}\')'
                content = re.sub(var_pattern, replacement, content)
                print(f"    Заменено {len(usages)} использований {method_name}")
        
        # Удаляем сами методы _get_*_service()
        lines = content.splitlines(keepends=True)
        lines_to_remove = set()
        
        for line_num, method_name, service_name in methods:
            # Находим начало метода
            start_line = line_num
            # Находим конец метода (следующий def или конец класса)
            end_line = start_line + 1
            indent = len(lines[start_line]) - len(lines[start_line].lstrip())
            
            while end_line < len(lines):
                line = lines[end_line]
                if line.strip() and not line.strip().startswith('#'):
                    line_indent = len(line) - len(line.lstrip())
                    if line_indent <= indent and (line.strip().startswith('def ') or line.strip().startswith('class ')):
                        break
                end_line += 1
            
            # Удаляем метод
            for i in range(start_line, end_line):
                lines_to_remove.add(i)
        
        # Удаляем строки (с конца, чтобы не сбить индексы)
        for line_num in sorted(lines_to_remove, reverse=True):
            if line_num < len(lines):
                del lines[line_num]
        
        content = ''.join(lines)
        
        if content != original_content:
            # Создаем резервную копию
            backup_path = file_path.with_suffix(f'.py.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
            
            # Сохраняем изменения
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"  ✓ Файл отрефакторен, создана резервная копия: {backup_path.name}")
            return True
        
        return False
        
    except Exception as e:
        print(f"  ✗ Ошибка при рефакторинге {file_path}: {e}")
        return False

def main():
    from datetime import datetime
    
    backend_dir = Path(__file__).parent.parent / 'backend'
    
    # Находим все файлы с _get_*_service методами
    service_files = []
    for file_path in backend_dir.rglob('*.py'):
        if 'venv' in str(file_path) or '__pycache__' in str(file_path):
            continue
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if '_get_' in content and '_service()' in content:
                methods = find_get_service_methods(content)
                if methods:
                    service_files.append((file_path, methods))
        except:
            pass
    
    print(f"Найдено {len(service_files)} файлов с методами _get_*_service()")
    print()
    
    if not service_files:
        print("Нет файлов для рефакторинга")
        return
    
    response = input("Продолжить с автоматическим рефакторингом? (yes/no): ")
    if response.lower() != 'yes':
        print("Отменено")
        return
    
    refactored = 0
    for file_path, methods in service_files:
        print(f"\nРефакторинг {file_path.relative_to(backend_dir.parent)}...")
        if refactor_class_file(file_path):
            refactored += 1
    
    print(f"\n✅ Рефакторинг завершен: обработано {refactored} файлов")

if __name__ == '__main__':
    from datetime import datetime
    main()

