#!/bin/bash

# Скрипт для очистки сертификатов (mTLS CA, клиентские сертификаты, временные сертификаты)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  ОЧИСТКА СЕРТИФИКАТОВ"
echo "=========================================="
echo ""

echo "=== Текущие сертификаты ==="
echo "mTLS CA и клиентские сертификаты:"
ls -lh nginx/ssl/*.pem 2>/dev/null | awk '{print $9, $5}' || echo "Нет сертификатов в nginx/ssl/"
echo ""

echo "Let's Encrypt сертификаты:"
ls -lh letsencrypt/live/*/fullchain.pem 2>/dev/null | awk '{print $9, $5}' || echo "Нет Let's Encrypt сертификатов"
echo ""

# Запрос подтверждения
read -p "Что удалить? (all/mtls/letsencrypt/temp): " choice

case "$choice" in
    all)
        echo ""
        echo "=== Удаление всех сертификатов ==="
        rm -rf nginx/ssl/*.pem nginx/ssl/*.key nginx/ssl/*.csr 2>/dev/null || true
        rm -rf letsencrypt/live/* letsencrypt/archive/* letsencrypt/renewal/* 2>/dev/null || true
        echo "✓ Все сертификаты удалены"
        ;;
    mtls)
        echo ""
        echo "=== Удаление mTLS сертификатов ==="
        rm -rf nginx/ssl/ca-*.pem nginx/ssl/ca-*.key 2>/dev/null || true
        rm -rf nginx/ssl/client-*.pem nginx/ssl/client-*.key 2>/dev/null || true
        rm -rf nginx/ssl/*.csr 2>/dev/null || true
        echo "✓ mTLS сертификаты удалены"
        ;;
    letsencrypt)
        echo ""
        echo "=== Удаление Let's Encrypt сертификатов ==="
        rm -rf letsencrypt/live/* letsencrypt/archive/* letsencrypt/renewal/* 2>/dev/null || true
        echo "✓ Let's Encrypt сертификаты удалены"
        ;;
    temp)
        echo ""
        echo "=== Удаление временных сертификатов ==="
        rm -f nginx/ssl/cert.pem nginx/ssl/key.pem 2>/dev/null || true
        echo "✓ Временные сертификаты удалены"
        ;;
    *)
        echo "Отменено."
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "  ГОТОВО"
echo "=========================================="
