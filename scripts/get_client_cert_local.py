#!/usr/bin/env python3
"""
Получение клиентского mTLS сертификата для локального использования
Использование: python scripts/get_client_cert_local.py <project_id> <jwt_token> [client_name]
"""

import sys
import os
import subprocess
from pathlib import Path
import requests
import json

# Конфигурация
SERVER_URL = "https://ovrin.xyz"
PROJECT_ID = sys.argv[1] if len(sys.argv) > 1 else None
JWT_TOKEN = sys.argv[2] if len(sys.argv) > 2 else None
CLIENT_NAME = sys.argv[3] if len(sys.argv) > 3 else "local-client"

if not PROJECT_ID or not JWT_TOKEN:
    print("Использование: python get_client_cert_local.py <project_id> <jwt_token> [client_name]")
    print("")
    print("Пример:")
    print("  python scripts/get_client_cert_local.py 2920317791 'eyJ0eXAiOiJKV1QiLCJhbGc...' my-client")
    sys.exit(1)

# Путь для сохранения сертификатов
script_dir = Path(__file__).parent.parent
ssl_dir = script_dir / "nginx" / "ssl" / "projects" / PROJECT_ID / "clients" / CLIENT_NAME
ssl_dir.mkdir(parents=True, exist_ok=True)

key_path = ssl_dir / "client-key.pem"
csr_path = ssl_dir / "client.csr"
cert_path = ssl_dir / "client-cert.pem"

print(f"Получение клиентского сертификата для проекта {PROJECT_ID}...")
print(f"Клиент: {CLIENT_NAME}")
print(f"Путь: {ssl_dir}")
print("")

# Шаг 1: Генерация приватного ключа
if not key_path.exists():
    print("1. Генерация приватного ключа...")
    subprocess.run(
        ["openssl", "genrsa", "-out", str(key_path), "2048"],
        check=True,
        capture_output=True
    )
    os.chmod(key_path, 0o600)
    print(f"   ✓ Ключ создан: {key_path}")
else:
    print(f"1. ✓ Используется существующий ключ: {key_path}")

# Шаг 2: Генерация CSR
print("2. Генерация CSR...")
cn = f"project-{PROJECT_ID}-{CLIENT_NAME}"
subprocess.run(
    [
        "openssl", "req", "-new", "-key", str(key_path),
        "-out", str(csr_path),
        "-subj", f"/C=US/ST=CA/L=San Francisco/O=Panel/CN={cn}"
    ],
    check=True,
    capture_output=True
)
print(f"   ✓ CSR создан: {csr_path}")

# Шаг 3: Чтение CSR
with open(csr_path, "r") as f:
    csr_pem = f.read()

# Шаг 4: Отправка CSR на сервер для подписания
print("3. Отправка CSR на сервер для подписания...")
url = f"{SERVER_URL}/api/projects/{PROJECT_ID}/mtls/csr-sign"
headers = {
    "Authorization": f"Bearer {JWT_TOKEN}",
    "Content-Type": "application/json"
}
data = {
    "csr_pem": csr_pem,
    "client_name": CLIENT_NAME
}

try:
    response = requests.post(url, json=data, headers=headers, timeout=30)
    response.raise_for_status()
    
    result = response.json()
    client_cert = result["certificate"]
    ca_cert = result["ca_certificate"]
    fingerprint = result["fingerprint"]
    
    # Сохранение клиентского сертификата
    with open(cert_path, "w") as f:
        f.write(client_cert)
    os.chmod(cert_path, 0o644)
    
    # Сохранение CA сертификата (для справки)
    ca_path = ssl_dir / "ca-cert.pem"
    with open(ca_path, "w") as f:
        f.write(ca_cert)
    
    print(f"   ✓ Сертификат получен и сохранен: {cert_path}")
    print(f"   ✓ CA сертификат сохранен: {ca_path}")
    print(f"   ✓ Fingerprint: {fingerprint}")
    print("")
    print("✅ Клиентский сертификат готов для использования!")
    print(f"   Cert: {cert_path}")
    print(f"   Key: {key_path}")
    print("")
    print("Теперь можно запустить проверку лицензии:")
    print(f"   python check_license.py")
    
except requests.exceptions.HTTPError as e:
    print(f"❌ Ошибка HTTP: {e}")
    if e.response.status_code == 401:
        print("   Проверьте JWT токен")
    elif e.response.status_code == 403:
        print("   Нет доступа к проекту")
    elif e.response.status_code == 404:
        print("   Проект не найден")
    else:
        print(f"   Ответ сервера: {e.response.text}")
    sys.exit(1)
except Exception as e:
    print(f"❌ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

