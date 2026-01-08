#!/bin/bash
# Скрипт для очистки __pycache__ директорий

echo "============================================================"
echo "Очистка __pycache__ и .pyc файлов"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Удаляем все __pycache__ директории
echo "Удаление __pycache__ директорий..."
find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true

# Удаляем все .pyc файлы
echo "Удаление .pyc файлов..."
find . -type f -name "*.pyc" -delete 2>/dev/null || true

# Удаляем все .pyo файлы (оптимизированные байткоды)
echo "Удаление .pyo файлов..."
find . -type f -name "*.pyo" -delete 2>/dev/null || true

echo ""
echo "✓ Очистка завершена"
echo ""
echo "Проверка (должно быть пусто):"
grep -r "CN must start with" backend/ 2>/dev/null | grep -v ".pyc:" | grep -v "Binary file" || echo "  ✓ Старый код не найден"
echo ""

