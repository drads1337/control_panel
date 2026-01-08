#!/bin/bash

# Скрипт для очистки системных логов

echo "=========================================="
echo "  ОЧИСТКА СИСТЕМНЫХ ЛОГОВ"
echo "=========================================="
echo ""

echo "=== Текущий размер логов ==="
sudo du -sh /var/log/* 2>/dev/null | sort -rh | head -10
echo ""

# Запрос подтверждения
read -p "Очистить логи? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Отменено."
    exit 1
fi

echo ""
echo "=== 1. Очистка journald (108MB) ==="
sudo journalctl --vacuum-time=7d 2>/dev/null || echo "Не удалось очистить journal"
echo "✓ Journal очищен (оставлены логи за 7 дней)"
echo ""

echo "=== 2. Очистка старых логов ==="
# Очистка старых логов (старше 30 дней)
sudo find /var/log -type f -name "*.log" -mtime +30 -exec truncate -s 0 {} \; 2>/dev/null || true
sudo find /var/log -type f -name "*.gz" -mtime +30 -delete 2>/dev/null || true
echo "✓ Старые логи очищены"
echo ""

echo "=== 3. Очистка btmp (5.8MB) ==="
sudo truncate -s 0 /var/log/btmp 2>/dev/null || echo "Не удалось очистить btmp"
echo "✓ btmp очищен"
echo ""

# Показать результат
echo "=== Результат очистки ==="
echo "Размер логов после очистки:"
sudo du -sh /var/log/* 2>/dev/null | sort -rh | head -10
echo ""

echo "Использование диска системы:"
df -h / | tail -1
echo ""

echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
