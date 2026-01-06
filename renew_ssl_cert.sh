#!/bin/bash
# Скрипт для обновления SSL сертификатов Let's Encrypt
# Сертификаты обновляются автоматически, но можно запустить вручную

set -e

echo "🔄 Обновление SSL сертификатов Let's Encrypt..."

# Обновление сертификатов
docker compose run --rm certbot renew

echo ""
echo "🔄 Перезагрузка nginx для применения обновленных сертификатов..."
docker compose exec nginx nginx -s reload

echo ""
echo "✅ Обновление завершено!"

