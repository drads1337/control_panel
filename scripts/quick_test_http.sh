#!/bin/bash
# Быстрый тест доступности домена по HTTP

set -e

DOMAIN="ovrin.xyz"
SERVER_IP="38.242.149.188"

echo "=========================================="
echo "Тест доступности домена по HTTP"
echo "=========================================="
echo ""

echo "1. Проверка по IP (HTTP):"
echo "---"
curl -v -L --max-time 10 "http://$SERVER_IP" 2>&1 | head -20 || echo "Недоступно по IP"
echo ""

echo "2. Проверка по домену (HTTP):"
echo "---"
curl -v -L --max-time 10 "http://$DOMAIN" 2>&1 | head -20 || echo "Недоступно по домену"
echo ""

echo "3. Проверка ACME challenge:"
echo "---"
curl -v -L --max-time 10 "http://$DOMAIN/.well-known/acme-challenge/test" 2>&1 | head -10 || echo "ACME challenge недоступен"
echo ""

echo "=========================================="
echo "Если HTTP работает, можно получить Let's Encrypt сертификат"
echo "=========================================="

