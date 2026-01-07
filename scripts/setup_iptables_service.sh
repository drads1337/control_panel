#!/bin/bash
# Создание systemd сервиса для автозагрузки правил iptables

set -e

echo "=========================================="
echo "Настройка автозагрузки правил iptables"
echo "=========================================="
echo ""

# Создать systemd сервис
cat > /etc/systemd/system/iptables-restore.service << 'EOF'
[Unit]
Description=Restore iptables rules
Before=network-pre.target
Wants=network-pre.target

[Service]
Type=oneshot
ExecStart=/usr/sbin/iptables-restore /etc/iptables/rules.v4
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Сервис iptables-restore.service создан"

# Перезагрузить systemd
systemctl daemon-reload
echo "✅ systemd перезагружен"

# Включить автозагрузку
systemctl enable iptables-restore.service
echo "✅ Автозагрузка включена"

# Проверить статус
echo ""
echo "Статус сервиса:"
systemctl status iptables-restore.service --no-pager -l || true

echo ""
echo "=========================================="
echo "Готово!"
echo "=========================================="
echo ""
echo "Правила iptables будут автоматически загружаться при перезагрузке сервера."

