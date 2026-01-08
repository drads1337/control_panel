#!/bin/bash
# Скрипт для копирования клиентских сертификатов на Android устройство через adb
# Использует adb push для копирования в app's internal files directory

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PROJECT_ID="${1:-${PROJECT_ID:-2920317791}}"
CLIENT_NAME="${2:-${CLIENT_NAME:-android}}"
PACKAGE_NAME="${3:-${PACKAGE_NAME:-com.example.myapplication}}"

SSL_DIR="$PROJECT_ROOT/nginx/ssl"
CLIENT_DIR="$SSL_DIR/projects/$PROJECT_ID/clients/$CLIENT_NAME"
CERT_FILE="$CLIENT_DIR/client-cert.pem"
KEY_FILE="$CLIENT_DIR/client-key.pem"

# Android путь к app's internal files directory
ANDROID_FILES_DIR="/data/data/${PACKAGE_NAME}/files"

echo "============================================================"
echo "Копирование клиентских сертификатов на Android устройство"
echo "============================================================"
echo "Project ID: $PROJECT_ID"
echo "Client Name: $CLIENT_NAME"
echo "Package Name: $PACKAGE_NAME"
echo "Android Files Dir: $ANDROID_FILES_DIR"
echo ""

# Проверяем наличие файлов
if [ ! -f "$CERT_FILE" ]; then
    echo "❌ Файл сертификата не найден: $CERT_FILE"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Файл ключа не найден: $KEY_FILE"
    exit 1
fi

echo "✓ Файлы найдены:"
echo "  Cert: $CERT_FILE"
echo "  Key:  $KEY_FILE"
echo ""

# Проверяем наличие adb
if ! command -v adb &> /dev/null; then
    echo "❌ adb не найден в PATH"
    echo ""
    echo "Установите Android SDK Platform Tools:"
    echo "  - macOS: brew install android-platform-tools"
    echo "  - Linux: sudo apt-get install adb"
    echo "  - Или скачайте с https://developer.android.com/studio/releases/platform-tools"
    exit 1
fi

# Проверяем подключение устройства
echo "Проверка подключения Android устройства..."
if ! adb devices | grep -q "device$"; then
    echo "❌ Android устройство не подключено или не авторизовано"
    echo ""
    echo "Убедитесь, что:"
    echo "  1. Устройство подключено через USB"
    echo "  2. На устройстве включена отладка по USB"
    echo "  3. На устройстве разрешен доступ для этого компьютера"
    echo ""
    echo "Проверьте подключение:"
    echo "  adb devices"
    exit 1
fi

DEVICE_INFO=$(adb shell getprop ro.product.model 2>/dev/null || echo "Unknown")
echo "✓ Устройство подключено: $DEVICE_INFO"
echo ""

# Проверяем формат ключа и конвертируем в RSA если нужно
KEY_FORMAT=$(head -1 "$KEY_FILE")
if [[ "$KEY_FORMAT" == *"BEGIN PRIVATE KEY"* ]]; then
    echo "⚠ Ключ в PKCS#8 формате - конвертируем в RSA..."
    TEMP_KEY="${KEY_FILE}.rsa.tmp"
    if openssl rsa -in "$KEY_FILE" -out "$TEMP_KEY" 2>/dev/null; then
        KEY_FILE_TO_COPY="$TEMP_KEY"
        echo "✓ Ключ конвертирован в RSA формат"
    else
        echo "⚠ Не удалось конвертировать ключ, используем оригинал"
        KEY_FILE_TO_COPY="$KEY_FILE"
    fi
else
    KEY_FILE_TO_COPY="$KEY_FILE"
fi

# Проверяем права доступа к app's files directory
echo "Проверка доступа к app's files directory..."
if ! adb shell ls "$ANDROID_FILES_DIR" > /dev/null 2>&1; then
    echo "⚠ App's files directory недоступен или не существует"
    echo "  Возможно, приложение еще не запущено или нужно root доступ"
    echo ""
    echo "Попробуйте скопировать в Download папку (не требует root):"
    ANDROID_DOWNLOAD_DIR="/sdcard/Download"
    echo "  Android Download Dir: $ANDROID_DOWNLOAD_DIR"
    echo ""
    read -p "Скопировать в Download папку вместо app's files? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ANDROID_TARGET_DIR="$ANDROID_DOWNLOAD_DIR"
    else
        echo "❌ Отменено. Попробуйте запустить приложение сначала."
        exit 1
    fi
else
    ANDROID_TARGET_DIR="$ANDROID_FILES_DIR"
    echo "✓ App's files directory доступен"
fi

echo ""
echo "Копирование сертификатов на устройство..."
echo "  Target: $ANDROID_TARGET_DIR"
echo ""

# Копируем сертификат
echo "Копирование client-cert.pem..."
if adb push "$CERT_FILE" "${ANDROID_TARGET_DIR}/client-cert.pem" 2>/dev/null; then
    echo "✓ Сертификат скопирован"
    # Устанавливаем права доступа
    adb shell chmod 644 "${ANDROID_TARGET_DIR}/client-cert.pem" 2>/dev/null || true
else
    echo "❌ Не удалось скопировать сертификат"
    echo ""
    echo "Возможные причины:"
    echo "  1. Недостаточно прав (нужен root или приложение должно быть запущено)"
    echo "  2. App's files directory защищен (Android 11+)"
    echo ""
    echo "Попробуйте альтернативные методы:"
    echo "  1. Скопировать в Download папку и вручную переместить в приложение"
    echo "  2. Использовать Android File Transfer"
    echo "  3. Использовать приложение для копирования файлов"
    exit 1
fi

# Копируем ключ
echo "Копирование client-key.pem..."
if adb push "$KEY_FILE_TO_COPY" "${ANDROID_TARGET_DIR}/client-key.pem" 2>/dev/null; then
    echo "✓ Ключ скопирован"
    # Устанавливаем права доступа (только чтение для владельца)
    adb shell chmod 600 "${ANDROID_TARGET_DIR}/client-key.pem" 2>/dev/null || true
else
    echo "❌ Не удалось скопировать ключ"
    rm -f "$TEMP_KEY" 2>/dev/null || true
    exit 1
fi

# Удаляем временный файл если был создан
if [ -n "$TEMP_KEY" ] && [ -f "$TEMP_KEY" ]; then
    rm -f "$TEMP_KEY"
fi

echo ""
echo "============================================================"
echo "✓ Сертификаты успешно скопированы на Android устройство!"
echo "============================================================"
echo ""
echo "Файлы на устройстве:"
echo "  Cert: ${ANDROID_TARGET_DIR}/client-cert.pem"
echo "  Key:  ${ANDROID_TARGET_DIR}/client-key.pem"
echo ""

if [ "$ANDROID_TARGET_DIR" = "$ANDROID_DOWNLOAD_DIR" ]; then
    echo "⚠ ВНИМАНИЕ: Файлы скопированы в Download папку"
    echo "  Вам нужно вручную переместить их в app's files directory:"
    echo "  ${ANDROID_FILES_DIR}/"
    echo ""
    echo "Или обновите пути в main.cpp для использования Download папки:"
    echo "  g_ClientCertPath = \"/sdcard/Download/client-cert.pem\""
    echo "  g_ClientKeyPath = \"/sdcard/Download/client-key.pem\""
else
    echo "✓ Файлы скопированы в app's internal files directory"
    echo "  Обновите пути в main.cpp если нужно:"
    echo "  g_ClientCertPath = \"${ANDROID_TARGET_DIR}/client-cert.pem\""
    echo "  g_ClientKeyPath = \"${ANDROID_TARGET_DIR}/client-key.pem\""
fi

echo ""
echo "Теперь пересоберите и запустите Android приложение!"

