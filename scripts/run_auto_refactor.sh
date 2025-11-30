#!/bin/bash
# Скрипт для автоматического рефакторинга всех функций
# Использование: ./scripts/run_auto_refactor.sh

set -e

echo "🚀 Автоматический рефакторинг ленивых импортов get_service()"
echo "============================================================"
echo ""
echo "Этот скрипт автоматически переместит все get_service() вызовы"
echo "в начало функций (DI pattern)."
echo ""
echo "⚠️  ВНИМАНИЕ: Скрипт создаст резервные копии всех изменяемых файлов."
echo ""

read -p "Продолжить? (yes/no): " response
if [ "$response" != "yes" ]; then
    echo "Отменено."
    exit 0
fi

echo ""
echo "Запуск рефакторинга..."
python scripts/refactor_di_imports.py

echo ""
echo "✅ Рефакторинг завершен!"
echo ""
echo "Проверьте изменения:"
echo "  git status"
echo "  git diff"
echo ""
echo "Если все хорошо, закоммитьте изменения:"
echo "  git add -A"
echo "  git commit -m 'refactor: auto-refactor get_service() calls to function start'"

