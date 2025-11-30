#!/usr/bin/env python3
"""
Скрипт для анализа использования Service Locator pattern (get_service()).

Классифицирует все использования get_service() по:
- Типу файла (service, route, model, utils, etc.)
- Контексту использования (конструктор, метод, функция)
- Сложности миграции на DI
"""

import re
import ast
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field

@dataclass
class ServiceUsage:
    """Информация об использовании get_service()"""
    file_path: str
    line_number: int
    context: str  # 'constructor', 'method', 'function', 'module'
    service_name: Optional[str] = None
    class_name: Optional[str] = None
    method_name: Optional[str] = None
    migration_difficulty: str = "unknown"  # 'easy', 'medium', 'hard'
    
@dataclass
class AnalysisResult:
    """Результаты анализа"""
    total_files: int = 0
    total_usages: int = 0
    by_file_type: Dict[str, int] = field(default_factory=dict)
    by_context: Dict[str, int] = field(default_factory=dict)
    by_difficulty: Dict[str, int] = field(default_factory=dict)
    usages: List[ServiceUsage] = field(default_factory=list)

def extract_service_name(line: str) -> Optional[str]:
    """Извлечь имя сервиса из вызова get_service('service_name')"""
    match = re.search(r"get_service\(['\"]([^'\"]+)['\"]\)", line)
    if match:
        return match.group(1)
    return None

def classify_file_type(file_path: str) -> str:
    """Классифицировать тип файла"""
    path = Path(file_path)
    parts = path.parts
    
    if 'routes' in parts:
        return 'route'
    elif 'services' in parts:
        return 'service'
    elif 'models' in parts:
        return 'model'
    elif 'utils' in parts:
        return 'utils'
    elif 'middleware' in parts:
        return 'middleware'
    elif 'tasks' in parts:
        return 'task'
    elif 'tests' in parts:
        return 'test'
    else:
        return 'other'

def analyze_file(file_path: Path) -> List[ServiceUsage]:
    """Анализировать один файл на использование get_service()"""
    usages = []
    
    try:
        content = file_path.read_text(encoding='utf-8')
        lines = content.splitlines()
        
        # Парсим AST для определения контекста
        try:
            tree = ast.parse(content)
        except SyntaxError:
            # Если не можем распарсить, используем простой поиск
            for i, line in enumerate(lines, 1):
                if 'get_service(' in line:
                    service_name = extract_service_name(line)
                    usages.append(ServiceUsage(
                        file_path=str(file_path),
                        line_number=i,
                        context='unknown',
                        service_name=service_name,
                        migration_difficulty='medium'
                    ))
            return usages
        
        # Находим все вызовы get_service()
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if (isinstance(node.func, ast.Name) and node.func.id == 'get_service') or \
                   (isinstance(node.func, ast.Attribute) and node.func.attr == 'get_service'):
                    
                    # Извлекаем имя сервиса
                    service_name = None
                    if node.args and isinstance(node.args[0], ast.Constant):
                        service_name = node.args[0].value
                    elif node.args and isinstance(node.args[0], ast.Str):
                        service_name = node.args[0].s
                    
                    # Определяем контекст
                    context = 'unknown'
                    class_name = None
                    method_name = None
                    
                    parent = node
                    while parent:
                        if isinstance(parent, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            method_name = parent.name
                            if method_name == '__init__':
                                context = 'constructor'
                            else:
                                context = 'method'
                            break
                        elif isinstance(parent, ast.ClassDef):
                            class_name = parent.name
                            if context == 'unknown':
                                context = 'function'  # На уровне класса, но не в методе
                            break
                        parent = getattr(parent, 'parent', None)
                    
                    if context == 'unknown':
                        context = 'module'
                    
                    # Определяем сложность миграции
                    difficulty = 'medium'
                    if context == 'constructor':
                        difficulty = 'easy'
                    elif context == 'method' and class_name:
                        difficulty = 'medium'
                    elif 'route' in str(file_path):
                        difficulty = 'easy'  # Routes можно оставить как есть
                    elif 'test' in str(file_path):
                        difficulty = 'easy'  # Tests можно оставить
                    else:
                        difficulty = 'hard'
                    
                    usages.append(ServiceUsage(
                        file_path=str(file_path),
                        line_number=node.lineno,
                        context=context,
                        service_name=service_name,
                        class_name=class_name,
                        method_name=method_name,
                        migration_difficulty=difficulty
                    ))
        
    except Exception as e:
        print(f"Error analyzing {file_path}: {e}")
    
    return usages

def analyze_codebase(backend_path: Path = Path("backend")) -> AnalysisResult:
    """Анализировать всю кодовую базу"""
    result = AnalysisResult()
    
    # Находим все Python файлы
    python_files = list(backend_path.rglob("*.py"))
    result.total_files = len(python_files)
    
    # Анализируем каждый файл
    for file_path in python_files:
        # Пропускаем __pycache__ и venv
        if '__pycache__' in str(file_path) or 'venv' in str(file_path):
            continue
        
        usages = analyze_file(file_path)
        result.usages.extend(usages)
        result.total_usages += len(usages)
        
        # Классифицируем по типу файла
        file_type = classify_file_type(str(file_path))
        if file_type not in result.by_file_type:
            result.by_file_type[file_type] = 0
        result.by_file_type[file_type] += len(usages)
        
        # Классифицируем по контексту
        for usage in usages:
            if usage.context not in result.by_context:
                result.by_context[usage.context] = 0
            result.by_context[usage.context] += 1
            
            if usage.migration_difficulty not in result.by_difficulty:
                result.by_difficulty[usage.migration_difficulty] = 0
            result.by_difficulty[usage.migration_difficulty] += 1
    
    return result

def print_report(result: AnalysisResult):
    """Вывести отчет об анализе"""
    print("=" * 80)
    print("АНАЛИЗ ИСПОЛЬЗОВАНИЯ SERVICE LOCATOR PATTERN (get_service())")
    print("=" * 80)
    print()
    
    print(f"📊 Общая статистика:")
    print(f"   Файлов с get_service(): {result.total_files}")
    print(f"   Всего использований: {result.total_usages}")
    print()
    
    print(f"📁 По типам файлов:")
    for file_type, count in sorted(result.by_file_type.items(), key=lambda x: -x[1]):
        percentage = (count / result.total_usages * 100) if result.total_usages > 0 else 0
        print(f"   {file_type:15} {count:4} ({percentage:5.1f}%)")
    print()
    
    print(f"🔧 По контексту использования:")
    for context, count in sorted(result.by_context.items(), key=lambda x: -x[1]):
        percentage = (count / result.total_usages * 100) if result.total_usages > 0 else 0
        print(f"   {context:15} {count:4} ({percentage:5.1f}%)")
    print()
    
    print(f"⚡ По сложности миграции на DI:")
    for difficulty, count in sorted(result.by_difficulty.items(), key=lambda x: ['easy', 'medium', 'hard'].index(x[0])):
        percentage = (count / result.total_usages * 100) if result.total_usages > 0 else 0
        emoji = {'easy': '🟢', 'medium': '🟡', 'hard': '🔴'}.get(difficulty, '⚪')
        print(f"   {emoji} {difficulty:15} {count:4} ({percentage:5.1f}%)")
    print()
    
    # Топ-10 файлов с наибольшим количеством использований
    file_counts = defaultdict(int)
    for usage in result.usages:
        file_counts[usage.file_path] += 1
    
    print(f"📋 Топ-10 файлов с наибольшим количеством использований:")
    for file_path, count in sorted(file_counts.items(), key=lambda x: -x[1])[:10]:
        rel_path = file_path.replace(str(Path.cwd()) + '/', '')
        print(f"   {count:3} {rel_path}")
    print()
    
    # Статистика по сервисам
    service_counts = defaultdict(int)
    for usage in result.usages:
        if usage.service_name:
            service_counts[usage.service_name] += 1
    
    print(f"🔌 Топ-10 наиболее используемых сервисов:")
    for service_name, count in sorted(service_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"   {count:3} {service_name}")
    print()
    
    # Рекомендации
    print("=" * 80)
    print("РЕКОМЕНДАЦИИ")
    print("=" * 80)
    print()
    
    easy_count = result.by_difficulty.get('easy', 0)
    medium_count = result.by_difficulty.get('medium', 0)
    hard_count = result.by_difficulty.get('hard', 0)
    
    print(f"1. 🟢 Легкие миграции ({easy_count} использований):")
    print("   - Мигрировать конструкторы сервисов на DI")
    print("   - Routes можно оставить как есть (допустимо)")
    print("   - Tests можно оставить как есть")
    print()
    
    print(f"2. 🟡 Средние миграции ({medium_count} использований):")
    print("   - Мигрировать методы сервисов на DI через конструктор")
    print("   - Требует рефакторинга классов")
    print()
    
    print(f"3. 🔴 Сложные миграции ({hard_count} использований):")
    print("   - Требуют рефакторинга архитектуры")
    print("   - Рассмотреть Event Bus для развязки зависимостей")
    print("   - Возможно, потребуется разбиение сервисов")
    print()
    
    route_count = result.by_file_type.get('route', 0)
    if route_count > 0:
        print(f"💡 Routes ({route_count} использований):")
        print("   - Можно оставить get_service() для простоты")
        print("   - Или мигрировать на DI через Flask's g или request context")
        print()

if __name__ == "__main__":
    import sys
    
    backend_path = Path("backend")
    if len(sys.argv) > 1:
        backend_path = Path(sys.argv[1])
    
    if not backend_path.exists():
        print(f"Error: Path {backend_path} does not exist")
        sys.exit(1)
    
    print("Анализ кодовой базы...")
    result = analyze_codebase(backend_path)
    print_report(result)
    
    # Сохранить детальный отчет в файл
    report_file = Path("SERVICE_LOCATOR_ANALYSIS.txt")
    with open(report_file, 'w', encoding='utf-8') as f:
        import sys
        from io import StringIO
        
        old_stdout = sys.stdout
        sys.stdout = StringIO()
        print_report(result)
        output = sys.stdout.getvalue()
        sys.stdout = old_stdout
        
        f.write(output)
    
    print(f"\n✅ Детальный отчет сохранен в {report_file}")

