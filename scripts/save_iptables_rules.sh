#!/bin/bash
# Сохранение правил iptables для автозагрузки

set -e

echo "=========================================="
echo "Сохранение правил iptables"
echo "=========================================="
echo ""

# Создать директорию если её нет
mkdir -p /etc/iptables

# Сохранить правила
iptables-save > /etc/iptables/rules.v4

echo "✅ Правила iptables сохранены в /etc/iptables/rules.v4"
echo ""

# Проверить, что правила применены
echo "Текущие правила для портов 80 и 443:"
iptables -L INPUT -n -v | grep -E "80|443"
echo ""

# Проверить, есть ли сервис для автозагрузки
if systemctl list-units | grep -q iptables; then
    echo "✅ Сервис iptables найден"
elif [ -f /etc/systemd/system/iptables-restore.service ]; then
    echo "✅ Сервис iptables-restore найден"
else
    echo "⚠️  Для автозагрузки правил при перезагрузке создайте сервис:"
    echo ""
    echo "Создать файл /etc/systemd/system/iptables-restore.service:"
    echo "[Unit]"
    echo "Description=Restore iptables rules"
    echo "Before=network-pre.target"
    echo ""
    echo "[Service]"
    echo "Type=oneshot"
    echo "ExecStart=/usr/sbin/iptables-restore /etc/iptables/rules.v4"
    echo ""
    echo "[Install]"
    echo "WantedBy=multi-user.target"
    echo ""
    echo "Затем:"
    echo "  systemctl enable iptables-restore.service"
fi

echo ""
echo "=========================================="
echo "Готово!"
echo "=========================================="

