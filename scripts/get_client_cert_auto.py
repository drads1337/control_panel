#!/usr/bin/env python3
"""
Автоматическое получение клиентского mTLS сертификата
Использование: 
  python scripts/get_client_cert_auto.py <project_id> [client_name]
  
  Или с переменными окружения:
  export PANEL_USERNAME=admin@example.com
  export PANEL_PASSWORD=mypassword
  python scripts/get_client_cert_auto.py <project_id> [client_name]
"""

import sys
import os
import subprocess
from pathlib import Path
import requests
import json
import getpass
import time

# Конфигурация
SERVER_URL = os.environ.get("PANEL_SERVER_URL", "https://ovrin.xyz")
TOKEN_CACHE_FILE = Path.home() / ".panel_jwt_token"
TOKEN_CACHE_EXPIRY = 3600  # 1 час

def get_cached_token() -> str | None:
    """Получить сохраненный JWT токен из кэша"""
    if not TOKEN_CACHE_FILE.exists():
        return None
    
    try:
        with open(TOKEN_CACHE_FILE, "r") as f:
            data = json.load(f)
            token = data.get("token")
            timestamp = data.get("timestamp", 0)
            
            # Проверяем, не истек ли токен
            if time.time() - timestamp < TOKEN_CACHE_EXPIRY:
                return token
    except:
        pass
    
    return None

def save_token(token: str):
    """Сохранить JWT токен в кэш"""
    try:
        data = {
            "token": token,
            "timestamp": time.time()
        }
        with open(TOKEN_CACHE_FILE, "w") as f:
            json.dump(data, f)
        os.chmod(TOKEN_CACHE_FILE, 0o600)  # Только для владельца
    except Exception as e:
        print(f"⚠️  Не удалось сохранить токен в кэш: {e}")

def login(username: str | None = None, password: str | None = None) -> str:
    """Автоматический логин и получение JWT токена"""
    # Пытаемся использовать кэшированный токен
    cached_token = get_cached_token()
    if cached_token:
        print("🔐 Используется сохраненный токен...")
        # Проверяем, что токен еще валиден (попытка запроса)
        try:
            test_url = f"{SERVER_URL}/api/users/me"
            headers = {"Authorization": f"Bearer {cached_token}"}
            response = requests.get(test_url, headers=headers, timeout=10)
            if response.status_code == 200:
                print("✅ Токен валиден!")
                return cached_token
        except:
            pass
        print("⚠️  Токен истек, требуется повторная авторизация")
    
    # Если токена нет или он невалиден - логинимся
    if not username:
        username = os.environ.get("PANEL_USERNAME")
    if not password:
        password = os.environ.get("PANEL_PASSWORD")
    
    if not username:
        print("❌ Не указан username")
        print("   Укажите через переменную окружения: export PANEL_USERNAME=admin@example.com")
        print("   Или передайте как аргумент: python get_client_cert_auto.py <project_id> <username> <password>")
        sys.exit(1)
    
    if not password:
        password = getpass.getpass(f"Введите пароль для {username}: ")
    
    print("🔐 Авторизация на сервере...")
    url = f"{SERVER_URL}/api/auth/login"
    data = {
        "username": username,
        "password": password
    }
    
    try:
        response = requests.post(url, json=data, timeout=30)
        response.raise_for_status()
        
        result = response.json()
        access_token = result.get("access_token")
        
        if not access_token:
            print("❌ JWT токен не получен в ответе")
            sys.exit(1)
        
        # Сохраняем токен в кэш
        save_token(access_token)
        print("✅ Успешная авторизация! Токен сохранен в кэш.")
        return access_token
        
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            print("❌ Неверные учетные данные")
        else:
            print(f"❌ Ошибка авторизации: {e}")
            print(f"   Ответ: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        sys.exit(1)

def get_client_cert(project_id: str, jwt_token: str, client_name: str = "local-client"):
    """Получение клиентского сертификата"""
    # Путь для сохранения сертификатов
    script_dir = Path(__file__).parent.parent
    ssl_dir = script_dir / "nginx" / "ssl" / "projects" / project_id / "clients" / client_name
    ssl_dir.mkdir(parents=True, exist_ok=True)
    
    key_path = ssl_dir / "client-key.pem"
    csr_path = ssl_dir / "client.csr"
    cert_path = ssl_dir / "client-cert.pem"
    
    print(f"\n📜 Получение клиентского сертификата для проекта {project_id}...")
    print(f"   Клиент: {client_name}")
    print(f"   Путь: {ssl_dir}")
    
    # Шаг 1: Генерация приватного ключа
    if not key_path.exists():
        print("\n1️⃣  Генерация приватного ключа...")
        subprocess.run(
            ["openssl", "genrsa", "-out", str(key_path), "2048"],
            check=True,
            capture_output=True
        )
        os.chmod(key_path, 0o600)
        print(f"   ✓ Ключ создан: {key_path}")
    else:
        print(f"\n1️⃣  ✓ Используется существующий ключ: {key_path}")
    
    # Шаг 2: Генерация CSR
    print("2️⃣  Генерация CSR...")
    cn = f"project-{project_id}-{client_name}"
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
    print("3️⃣  Отправка CSR на сервер для подписания...")
    url = f"{SERVER_URL}/api/projects/{project_id}/mtls/csr-sign"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    data = {
        "csr_pem": csr_pem,
        "client_name": client_name
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
        
        return str(cert_path), str(key_path)
        
    except requests.exceptions.HTTPError as e:
        print(f"❌ Ошибка HTTP: {e}")
        if e.response.status_code == 401:
            print("   JWT токен истек или неверен")
        elif e.response.status_code == 403:
            print("   Нет доступа к проекту")
        elif e.response.status_code == 404:
            print("   Проект не найден")
        else:
            try:
                error_data = e.response.json()
                print(f"   Ошибка: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"   Ответ сервера: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print("Использование: python get_client_cert_auto.py <project_id> [client_name]")
        print("")
        print("Способ 1: С переменными окружения (рекомендуется)")
        print("  export PANEL_USERNAME=admin@example.com")
        print("  export PANEL_PASSWORD=mypassword")
        print("  python scripts/get_client_cert_auto.py 2920317791")
        print("")
        print("Способ 2: С аргументами")
        print("  python scripts/get_client_cert_auto.py 2920317791 <username> <password> [client_name]")
        print("")
        print("Способ 3: Интерактивный ввод пароля")
        print("  export PANEL_USERNAME=admin@example.com")
        print("  python scripts/get_client_cert_auto.py 2920317791")
        print("  (пароль будет запрошен интерактивно)")
        print("")
        print("Примечание: Токен сохраняется в ~/.panel_jwt_token и переиспользуется")
        sys.exit(1)
    
    project_id = sys.argv[1]
    client_name = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("-") else "local-client"
    
    # Определяем username и password из аргументов или переменных окружения
    username = None
    password = None
    
    # Если переданы username и password как аргументы (старый способ)
    if len(sys.argv) >= 4:
        username = sys.argv[2]
        password = sys.argv[3] if sys.argv[3] != "-" else None
        if len(sys.argv) > 4:
            client_name = sys.argv[4]
    
    # Автоматический логин (использует кэш или переменные окружения)
    jwt_token = login(username, password)
    
    # Получение клиентского сертификата
    cert_path, key_path = get_client_cert(project_id, jwt_token, client_name)
    
    print("\n" + "="*60)
    print("✅ Клиентский сертификат готов для использования!")
    print("="*60)
    print(f"   Cert: {cert_path}")
    print(f"   Key: {key_path}")
    print("")
    print("Теперь можно запустить проверку лицензии:")
    print(f"   python check_license.py")

if __name__ == "__main__":
    main()

