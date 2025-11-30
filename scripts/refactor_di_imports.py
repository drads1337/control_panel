#!/usr/bin/env python3
"""
Скрипт для автоматического рефакторинга ленивых импортов get_service() внутри методов.

Этот скрипт:
1. Находит все случаи использования get_service() внутри методов/функций
2. Определяет, какие сервисы используются
3. Предлагает рефакторинг для классов (добавить в __init__) и функций (получить в начале)
4. Выполняет автоматический рефакторинг с резервным копированием

Использование:
    python scripts/refactor_di_imports.py --dry-run  # Только показать что будет изменено
    python scripts/refactor_di_imports.py            # Выполнить рефакторинг
"""

import ast
import re
import sys
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from dataclasses import dataclass
import shutil
from datetime import datetime

@dataclass
class ServiceUsage:
    """Информация об использовании сервиса"""
    service_name: str
    line_number: int
    context: str  # Название метода/функции
    is_in_method: bool
    is_in_function: bool
    class_name: Optional[str] = None

@dataclass
class FileRefactorInfo:
    """Информация о рефакторинге файла"""
    file_path: Path
    service_usages: List[ServiceUsage]
    has_class: bool = False
    class_name: Optional[str] = None
    has_init: bool = False
    init_line: Optional[int] = None

class ServiceUsageFinder(ast.NodeVisitor):
    """AST visitor для поиска использования get_service()"""
    
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.usages: List[ServiceUsage] = []
        self.current_class: Optional[str] = None
        self.current_method: Optional[str] = None
        self.current_function: Optional[str] = None
        self.in_init = False
        self.init_line: Optional[int] = None
        
    def visit_ClassDef(self, node):
        old_class = self.current_class
        self.current_class = node.name
        self.generic_visit(node)
        self.current_class = old_class
    
    def visit_FunctionDef(self, node):
        old_method = self.current_method
        old_function = self.current_function
        old_in_init = self.in_init
        
        if self.current_class:
            self.current_method = node.name
            self.in_init = (node.name == '__init__')
            if self.in_init:
                self.init_line = node.lineno
        else:
            self.current_function = node.name
        
        self.generic_visit(node)
        
        self.current_method = old_method
        self.current_function = old_function
        self.in_init = old_in_init
    
    def visit_Call(self, node):
        # Проверяем, является ли это вызовом get_service()
        if isinstance(node.func, ast.Name) and node.func.id == 'get_service':
            # Получаем имя сервиса из аргументов
            if node.args and isinstance(node.args[0], ast.Constant):
                service_name = node.args[0].value
            elif node.args and isinstance(node.args[0], ast.Str):  # Python < 3.8
                service_name = node.args[0].s
            else:
                self.generic_visit(node)
                return
            
            # Проверяем, что это не в __init__ (там это нормально)
            if not self.in_init:
                usage = ServiceUsage(
                    service_name=service_name,
                    line_number=node.lineno,
                    context=self.current_method or self.current_function or 'module',
                    is_in_method=bool(self.current_method),
                    is_in_function=bool(self.current_function),
                    class_name=self.current_class
                )
                self.usages.append(usage)
        
        self.generic_visit(node)

def find_service_usages(file_path: Path) -> FileRefactorInfo:
    """Находит все использования get_service() в файле"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем, есть ли импорт get_service
        if 'get_service' not in content:
            return FileRefactorInfo(file_path=file_path, service_usages=[])
        
        tree = ast.parse(content, filename=str(file_path))
        finder = ServiceUsageFinder(file_path)
        finder.visit(tree)
        
        # Определяем, есть ли класс и __init__
        has_class = any(isinstance(node, ast.ClassDef) for node in ast.walk(tree))
        class_def = next((node for node in ast.walk(tree) if isinstance(node, ast.ClassDef)), None)
        class_name = class_def.name if class_def else None
        
        has_init = finder.init_line is not None
        
        return FileRefactorInfo(
            file_path=file_path,
            service_usages=finder.usages,
            has_class=has_class,
            class_name=class_name,
            has_init=has_init,
            init_line=finder.init_line
        )
    except Exception as e:
        print(f"Ошибка при анализе {file_path}: {e}", file=sys.stderr)
        return FileRefactorInfo(file_path=file_path, service_usages=[])

def find_all_python_files(root_dir: Path) -> List[Path]:
    """Находит все Python файлы в директории"""
    python_files = []
    for path in root_dir.rglob('*.py'):
        # Пропускаем виртуальные окружения и другие исключения
        if 'venv' in str(path) or '__pycache__' in str(path):
            continue
        python_files.append(path)
    return python_files

def analyze_files(backend_dir: Path) -> List[FileRefactorInfo]:
    """Анализирует все файлы и находит использования get_service()"""
    print(f"🔍 Анализ файлов в {backend_dir}...")
    
    python_files = find_all_python_files(backend_dir)
    print(f"   Найдено {len(python_files)} Python файлов")
    
    refactor_info = []
    for file_path in python_files:
        info = find_service_usages(file_path)
        if info.service_usages:
            refactor_info.append(info)
    
    return refactor_info

def generate_refactor_report(refactor_info: List[FileRefactorInfo]) -> str:
    """Генерирует отчет о найденных проблемах"""
    report = []
    report.append("=" * 80)
    report.append("ОТЧЕТ О НАЙДЕННЫХ ПРОБЛЕМАХ С ЛЕНИВЫМИ ИМПОРТАМИ")
    report.append("=" * 80)
    report.append("")
    
    total_files = len(refactor_info)
    total_usages = sum(len(info.service_usages) for info in refactor_info)
    
    report.append(f"Всего файлов с проблемами: {total_files}")
    report.append(f"Всего использований get_service() внутри методов: {total_usages}")
    report.append("")
    
    for info in refactor_info:
        report.append(f"📄 {info.file_path.relative_to(Path.cwd())}")
        report.append(f"   Класс: {info.class_name or 'Нет'}")
        report.append(f"   Есть __init__: {'Да' if info.has_init else 'Нет'}")
        report.append(f"   Использований: {len(info.service_usages)}")
        
        # Группируем по сервисам
        services = {}
        for usage in info.service_usages:
            if usage.service_name not in services:
                services[usage.service_name] = []
            services[usage.service_name].append(usage)
        
        for service_name, usages in sorted(services.items()):
            contexts = [u.context for u in usages]
            report.append(f"      - {service_name}: {len(usages)} раз(а) в {', '.join(set(contexts))}")
        
        report.append("")
    
    return "\n".join(report)

def refactor_file_function_start(content: str, usages: List[ServiceUsage], dry_run: bool) -> Tuple[str, int]:
    """Рефакторит функции: перемещает get_service() в начало функций"""
    lines = content.splitlines(keepends=True)
    changes_count = 0
    
    # Группируем использования по функциям
    functions_usages: Dict[str, List[ServiceUsage]] = {}
    for usage in usages:
        if usage.is_in_function and not usage.is_in_method:
            func_name = usage.context
            if func_name not in functions_usages:
                functions_usages[func_name] = []
            functions_usages[func_name].append(usage)
    
    if not functions_usages:
        return content, 0
    
    # Обрабатываем каждую функцию (начинаем с конца, чтобы не сбить индексы)
    for func_name, func_usages in sorted(functions_usages.items(), key=lambda x: max(u.line_number for u in x[1]), reverse=True):
        # Находим уникальные сервисы для этой функции
        services = sorted(set(u.service_name for u in func_usages))
        
        # Находим строки с get_service() вызовами (1-indexed -> 0-indexed)
        service_line_nums = sorted([u.line_number - 1 for u in func_usages], reverse=True)
        
        # Находим начало функции (ищем def func_name)
        func_start_idx = None
        for i, line in enumerate(lines):
            if re.search(rf'^\s*def\s+{re.escape(func_name)}\s*\(', line):
                func_start_idx = i
                break
        
        if func_start_idx is None:
            continue
        
        # Находим первую строку тела функции (после :)
        func_body_start = func_start_idx + 1
        while func_body_start < len(lines) and ':' not in lines[func_body_start]:
            func_body_start += 1
        
        if func_body_start >= len(lines):
            continue
        
        func_body_start += 1  # После :
        
        # Находим первую непустую строку после def (это начало тела)
        body_start = func_body_start
        while body_start < len(lines) and (not lines[body_start].strip() or lines[body_start].strip().startswith('#')):
            body_start += 1
        
        if body_start >= len(lines):
            continue
        
        # Получаем отступ для тела функции
        indent = len(lines[body_start]) - len(lines[body_start].lstrip()) if lines[body_start].strip() else 4
        
        # Собираем строки для удаления (get_service вызовы)
        lines_to_remove = []
        service_vars = {}  # service_name -> var_name
        
        for line_num in service_line_nums:
            if line_num < len(lines):
                line = lines[line_num]
                # Ищем паттерн: var_name = get_service('service_name')
                match = re.search(r'(\w+)\s*=\s*get_service\([\'"](\w+)[\'"]\)', line)
                if match:
                    var_name = match.group(1)
                    service_name = match.group(2)
                    service_vars[service_name] = var_name
                    lines_to_remove.append(line_num)
        
        # Удаляем старые вызовы get_service() (с конца, чтобы не сбить индексы)
        for line_num in sorted(lines_to_remove, reverse=True):
            if line_num < len(lines):
                lines[line_num] = ''
                changes_count += 1
        
        # Формируем код для получения сервисов
        service_lines_code = []
        service_lines_code.append(' ' * indent + '# Get services once at the start (DI pattern)\n')
        for service in services:
            var_name = service_vars.get(service, service.replace('_service', '_service'))
            service_lines_code.append(f'{" " * indent}{var_name} = get_service(\'{service}\')\n')
        
        # Вставляем код получения сервисов в начало функции
        lines[body_start:body_start] = service_lines_code
        changes_count += len(services)
    
    return ''.join(lines), changes_count

def refactor_file(info: FileRefactorInfo, dry_run: bool = False) -> bool:
    """Рефакторит один файл"""
    file_path = info.file_path
    
    if not info.service_usages:
        return False
    
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Рефакторинг {file_path.relative_to(Path.cwd())}...")
    
    # Читаем файл
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Группируем использования по сервисам
    services_needed = set(usage.service_name for usage in info.service_usages)
    
    # Определяем стратегию рефакторинга
    if info.has_class and info.has_init:
        # Для классов: добавляем зависимости в __init__
        strategy = "class_init"
    elif info.has_class:
        # Для классов без __init__: создаем __init__
        strategy = "class_new_init"
    else:
        # Для функций: получаем сервисы в начале
        strategy = "function_start"
    
    # Создаем резервную копию
    if not dry_run:
        backup_path = file_path.with_suffix(f'.py.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        shutil.copy2(file_path, backup_path)
        print(f"   ✓ Создана резервная копия: {backup_path.name}")
    
    # Выполняем рефакторинг
    changes_made = False
    if strategy == "function_start":
        print(f"   Стратегия: Получить сервисы в начале функций")
        print(f"   Нужные сервисы: {', '.join(sorted(services_needed))}")
        
        # Рефакторим только функции (не методы классов)
        function_usages = [u for u in info.service_usages if u.is_in_function and not u.is_in_method]
        if function_usages:
            new_content, changes_count = refactor_file_function_start(content, function_usages, dry_run)
            if changes_count > 0:
                if not dry_run:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"   ✓ Изменено: {changes_count} использований в {len(set(u.context for u in function_usages))} функциях")
                else:
                    print(f"   [DRY RUN] Будет изменено: {changes_count} использований в {len(set(u.context for u in function_usages))} функциях")
                changes_made = True
            else:
                print("   ⚠️  Не удалось автоматически рефакторить")
        else:
            print("   ⚠️  Нет функций для рефакторинга (только методы классов)")
    elif strategy == "class_init":
        print(f"   Стратегия: Добавить зависимости в __init__ класса {info.class_name}")
        print(f"   Нужные сервисы: {', '.join(sorted(services_needed))}")
        print("   ⚠️  Автоматический рефакторинг классов требует ручной проверки")
    elif strategy == "class_new_init":
        print(f"   Стратегия: Создать __init__ для класса {info.class_name}")
        print(f"   Нужные сервисы: {', '.join(sorted(services_needed))}")
        print("   ⚠️  Автоматический рефакторинг классов требует ручной проверки")
    
    return changes_made

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Рефакторинг ленивых импортов get_service() внутри методов'
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
        '--output',
        type=Path,
        help='Сохранить отчет в файл'
    )
    
    args = parser.parse_args()
    
    # Анализируем файлы
    refactor_info = analyze_files(args.backend_dir)
    
    # Генерируем отчет
    report = generate_refactor_report(refactor_info)
    
    # Выводим отчет
    print("\n" + report)
    
    # Сохраняем отчет в файл, если указан
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n📝 Отчет сохранен в {args.output}")
    
    # Выполняем рефакторинг, если не dry-run
    if not args.dry_run and refactor_info:
        print("\n" + "=" * 80)
        print("АВТОМАТИЧЕСКИЙ РЕФАКТОРИНГ")
        print("=" * 80)
        print("Скрипт автоматически переместит get_service() вызовы в начало функций.")
        print("Для классов рефакторинг требует ручной проверки.")
        print("=" * 80)
        
        response = input("\nПродолжить с автоматическим рефакторингом? (yes/no): ")
        if response.lower() == 'yes':
            refactored_count = 0
            for info in refactor_info:
                if refactor_file(info, dry_run=False):
                    refactored_count += 1
            print(f"\n✅ Рефакторинг завершен: обработано {refactored_count} файлов")
        else:
            print("Рефакторинг отменен.")
    else:
        print("\n💡 Используйте --dry-run для предварительного просмотра")
        print("   Для автоматического рефакторинга запустите без --dry-run")

if __name__ == '__main__':
    main()

