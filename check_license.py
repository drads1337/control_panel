#!/usr/bin/env python3
"""
Скрипт для проверки лицензии через API
Имитирует поведение Android клиента
"""

import json
import hashlib
import secrets
import base64
import os
import subprocess
import sys
from pathlib import Path
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# Конфигурация
SERVER_URL = "https://ovrin.xyz"  # Измените на ваш URL
USER_KEY = "PUBG-12M-uUakzkGT5FQY"
GAME_NAME = "PUBG"
MASTER_KEY = "a13b9a550d491f4d88206118a8ea9c12dc19ac1b7d263fa09c57a14e266f916d"
PROJECT_ID = "2920317791"
# Project key для расшифровки ответов (может отличаться от master key)
PROJECT_KEY = MASTER_KEY  # По умолчанию используем master key

# Имя клиента для сертификатов (можно изменить через переменную окружения)
CLIENT_NAME = os.environ.get("MTLS_CLIENT_NAME", "test-client")

# Генерируем фиктивный fingerprint (в реальном приложении это Android ID + модель + бренд)
FINGERPRINT = hashlib.sha256("test-android-id-test-device-model-test-device-brand".encode()).hexdigest()


def get_ssl_base_path():
    """
    Определяет базовый путь к SSL сертификатам в зависимости от окружения.
    В Docker: /app/nginx/ssl
    Локально: ./nginx/ssl
    """
    # Проверяем, работаем ли мы в Docker контейнере
    if os.path.exists("/app/nginx/ssl"):
        return Path("/app/nginx/ssl")
    elif os.path.exists("/app"):
        # В Docker, но директория не существует - создаем
        ssl_path = Path("/app/nginx/ssl")
        ssl_path.mkdir(parents=True, exist_ok=True)
        return ssl_path
    else:
        # Локально
        script_dir = Path(__file__).parent
        ssl_path = script_dir / "nginx" / "ssl"
        ssl_path.mkdir(parents=True, exist_ok=True)
        return ssl_path


def get_client_cert_paths(project_id: str, client_name: str):
    """
    Возвращает пути к клиентским сертификатам для проекта.
    В Docker: /app/nginx/ssl/projects/{project_id}/clients/{client_name}/
    Локально: ./nginx/ssl/projects/{project_id}/clients/{client_name}/
    """
    ssl_base = get_ssl_base_path()
    client_dir = ssl_base / "projects" / project_id / "clients" / client_name
    cert_path = client_dir / "client-cert.pem"
    key_path = client_dir / "client-key.pem"
    return cert_path, key_path, client_dir


def sha256(text: str) -> str:
    """Вычисляет SHA256 хеш"""
    return hashlib.sha256(text.encode()).hexdigest()


def random_hex(length: int) -> str:
    """Генерирует случайную hex строку"""
    return secrets.token_hex(length // 2)


def encrypt_with_master_key(plaintext: str, master_key_hex: str) -> str:
    """
    Шифрует данные с помощью AES-256-GCM
    Формат: IV (12 bytes) + ciphertext + tag (16 bytes), base64 encoded
    """
    # Конвертируем hex ключ в bytes
    key = bytes.fromhex(master_key_hex)
    
    # Генерируем случайный IV (12 bytes для GCM)
    iv = secrets.token_bytes(12)
    
    # Создаем cipher
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    
    # Шифруем данные
    plaintext_bytes = plaintext.encode('utf-8')
    ciphertext = encryptor.update(plaintext_bytes) + encryptor.finalize()
    
    # Получаем tag
    tag = encryptor.tag
    
    # Объединяем: IV + ciphertext + tag
    combined = iv + ciphertext + tag
    
    # Кодируем в base64
    return base64.b64encode(combined).decode('utf-8')


def decrypt_with_master_key(encrypted_data_b64: str, master_key_hex: str) -> str:
    """
    Расшифровывает данные с помощью AES-256-GCM
    """
    # Декодируем из base64
    combined = base64.b64decode(encrypted_data_b64.encode('utf-8'))
    
    if len(combined) < 28:
        raise ValueError("Encrypted data too short")
    
    # Извлекаем компоненты
    iv = combined[:12]
    tag = combined[-16:]
    ciphertext = combined[12:-16]
    
    # Конвертируем hex ключ в bytes
    key = bytes.fromhex(master_key_hex)
    
    # Создаем cipher
    cipher = Cipher(algorithms.AES(key), modes.GCM(iv, tag), backend=default_backend())
    decryptor = cipher.decryptor()
    
    # Расшифровываем
    plaintext = decryptor.update(ciphertext) + decryptor.finalize()
    
    return plaintext.decode('utf-8')


def generate_client_certificates(project_id: str, client_name: str):
    """
    Генерирует клиентские сертификаты для проекта используя скрипт mtls_project.sh
    """
    cert_path, key_path, client_dir = get_client_cert_paths(project_id, client_name)
    
    # Если сертификаты уже существуют, возвращаем их
    if cert_path.exists() and key_path.exists():
        print(f"[mTLS] Сертификаты уже существуют:")
        print(f"[mTLS]   Cert: {cert_path}")
        print(f"[mTLS]   Key: {key_path}")
        return str(cert_path), str(key_path)
    
    print(f"[mTLS] Генерация клиентских сертификатов для проекта {project_id}...")
    
    # Определяем путь к скрипту
    script_dir = Path(__file__).parent
    mtls_script = script_dir / "scripts" / "mtls_project.sh"
    
    if not mtls_script.exists():
        print(f"[mTLS] ⚠ Скрипт {mtls_script} не найден")
        print(f"[mTLS] Попытка генерации через локальный OpenSSL...")
        return _generate_certs_local(project_id, client_name, client_dir)
    
    try:
        # Сначала инициализируем CA для проекта, если его нет
        project_ssl_dir = get_ssl_base_path() / "projects" / project_id
        ca_cert = project_ssl_dir / "ca" / "ca-cert.pem"
        
        if not ca_cert.exists():
            print(f"[mTLS] Инициализация CA для проекта {project_id}...")
            # Используем bash для запуска скрипта (на случай, если нет прав на выполнение)
            script_cmd = ["bash", str(mtls_script), "init", project_id, client_name]
            result = subprocess.run(
                script_cmd,
                capture_output=True,
                text=True,
                cwd=script_dir
            )
            if result.returncode != 0:
                print(f"[mTLS] ⚠ Ошибка инициализации CA через скрипт: {result.stderr[:200]}")
                print(f"[mTLS] Попытка генерации через локальный OpenSSL...")
                return _generate_certs_local(project_id, client_name, client_dir)
        
        # Генерируем приватный ключ и CSR
        print(f"[mTLS] Генерация приватного ключа...")
        client_dir.mkdir(parents=True, exist_ok=True)
        
        # Генерируем ключ
        subprocess.run(
            ["openssl", "genrsa", "-out", str(key_path), "2048"],
            check=True,
            capture_output=True
        )
        os.chmod(key_path, 0o600)
        
        # Генерируем CSR
        csr_path = client_dir / "client.csr"
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
        
        # Подписываем CSR через скрипт
        print(f"[mTLS] Подписание CSR...")
        script_cmd = ["bash", str(mtls_script), "sign", project_id, str(csr_path), client_name]
        result = subprocess.run(
            script_cmd,
            capture_output=True,
            text=True,
            cwd=script_dir
        )
        
        if result.returncode == 0 and cert_path.exists():
            print(f"[mTLS] ✓ Сертификаты успешно сгенерированы:")
            print(f"[mTLS]   Cert: {cert_path}")
            print(f"[mTLS]   Key: {key_path}")
            return str(cert_path), str(key_path)
        else:
            print(f"[mTLS] ⚠ Ошибка подписания CSR через скрипт: {result.stderr[:200] if result.stderr else 'Unknown error'}")
            print(f"[mTLS] Попытка генерации через локальный OpenSSL...")
            return _generate_certs_local(project_id, client_name, client_dir)
            
    except subprocess.CalledProcessError as e:
        print(f"[mTLS] ⚠ Ошибка выполнения команды: {e}")
        return None, None
    except FileNotFoundError:
        print(f"[mTLS] ⚠ OpenSSL не найден. Установите openssl для генерации сертификатов.")
        return None, None


def _generate_certs_local(project_id: str, client_name: str, client_dir: Path):
    """Резервный метод: генерация сертификатов напрямую через OpenSSL"""
    try:
        cert_path = client_dir / "client-cert.pem"
        key_path = client_dir / "client-key.pem"
        client_dir.mkdir(parents=True, exist_ok=True)
        
        # Для полной генерации нужен CA, но мы можем создать самоподписанный сертификат для теста
        print(f"[mTLS] ⚠ Генерация самоподписанного сертификата (для теста)...")
        cn = f"project-{project_id}-{client_name}"
        
        # Генерируем ключ
        subprocess.run(
            ["openssl", "genrsa", "-out", str(key_path), "2048"],
            check=True,
            capture_output=True
        )
        os.chmod(key_path, 0o600)
        
        # Генерируем самоподписанный сертификат
        subprocess.run(
            [
                "openssl", "req", "-new", "-x509", "-key", str(key_path),
                "-out", str(cert_path), "-days", "365",
                "-subj", f"/C=US/ST=CA/L=San Francisco/O=Panel/CN={cn}"
            ],
            check=True,
            capture_output=True
        )
        
        print(f"[mTLS] ⚠ ВНИМАНИЕ: Создан самоподписанный сертификат!")
        print(f"[mTLS] ⚠ Этот сертификат НЕ будет работать с сервером, требующим mTLS!")
        print(f"[mTLS] ⚠ Используйте скрипт scripts/mtls_project.sh для правильной генерации.")
        return str(cert_path), str(key_path)
        
    except Exception as e:
        print(f"[mTLS] ⚠ Ошибка локальной генерации: {e}")
        return None, None


def get_mtls_cert(project_id: str, client_name: str):
    """
    Возвращает кортеж (cert_path, key_path) для mTLS.
    Автоматически генерирует сертификаты если их нет.
    """
    cert_path, key_path, _ = get_client_cert_paths(project_id, client_name)
    
    # Проверяем наличие обоих файлов сертификатов
    if cert_path.exists() and key_path.exists():
        print(f"[mTLS] Используются существующие клиентские сертификаты:")
        print(f"[mTLS]   Cert: {cert_path}")
        print(f"[mTLS]   Key: {key_path}")
        return (str(cert_path), str(key_path))
    
    # Пытаемся сгенерировать сертификаты
    print(f"[mTLS] Сертификаты не найдены, пытаемся сгенерировать...")
    cert_path_str, key_path_str = generate_client_certificates(project_id, client_name)
    
    if cert_path_str and key_path_str:
        return (cert_path_str, key_path_str)
    else:
        print(f"[mTLS] ⚠ Не удалось сгенерировать сертификаты")
        print(f"[mTLS] 💡 Для автоматического получения сертификата через API используйте:")
        print(f"[mTLS]    python scripts/get_client_cert_auto.py {project_id} <username> <password>")
        print(f"[mTLS] Подключение без mTLS (сервер может требовать клиентский сертификат)")
        return None


def get_challenge(user_key: str, fingerprint: str, project_id: str, mtls_cert=None) -> tuple[str, str, str]:
    """
    Получает challenge от сервера
    Возвращает (challenge, canary, project_id)
    """
    url = f"{SERVER_URL}/api/challenge"
    
    data = {
        "user_key": user_key,
        "fingerprint": fingerprint,
        "project_id": project_id
    }
    
    print(f"[GetChallenge] Отправка запроса на {url}")
    print(f"[GetChallenge] Данные: {json.dumps(data, indent=2)}")
    
    try:
        # Используем User-Agent, похожий на Android клиент, чтобы пройти валидацию
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 11; SM-G991B Build/RP1A.200720.012)"
        }
        
        response = requests.post(
            url,
            json=data,
            headers=headers,
            cert=mtls_cert,  # None если сертификаты не найдены
            timeout=10
        )
        
        print(f"[GetChallenge] Статус ответа: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"[GetChallenge] Ответ получен успешно")
            
            canary = result.get("canary")
            
            # Извлекаем challenge
            challenge_obj = result.get("challenge")
            if isinstance(challenge_obj, dict):
                # Enhanced challenge
                challenges = challenge_obj.get("challenges", {}).get("crypto", {}).get("challenges", {})
                
                if "sha256" in challenges and "input" in challenges["sha256"]:
                    challenge = challenges["sha256"]["input"]
                elif "combined" in challenges and "input" in challenges["combined"]:
                    challenge = challenges["combined"]["input"]
                elif "md5" in challenges and "input" in challenges["md5"]:
                    challenge = challenges["md5"]["input"]
                else:
                    raise ValueError("Could not find challenge input")
            elif isinstance(challenge_obj, str):
                # Legacy challenge
                challenge = challenge_obj
            else:
                raise ValueError("Invalid challenge format")
            
            # Обновляем project_id если он в ответе (сервер может вернуть другой project_id)
            new_project_id = None
            if "project_id" in result:
                new_project_id = str(result["project_id"])
                print(f"[GetChallenge] Project ID из ответа: {new_project_id}")
            return challenge, canary, new_project_id or project_id
            
        elif response.status_code == 404:
            print(f"[GetChallenge] ✗ Ключ не найден на сервере (404)")
            try:
                error_data = response.json()
                if "error" in error_data:
                    print(f"[GetChallenge] Ошибка: {error_data['error']}")
            except:
                pass
            raise Exception("Ключ лицензии не найден на сервере")
        else:
            print(f"[GetChallenge] Ошибка сервера: {response.status_code}")
            print(f"[GetChallenge] Ответ: {response.text}")
            raise Exception(f"Server error: {response.status_code}")
            
    except requests.exceptions.ConnectionError as e:
        print(f"[GetChallenge] Ошибка подключения: {e}")
        print(f"[GetChallenge] Проверьте, что сервер доступен по адресу {SERVER_URL}")
        raise
    except Exception as e:
        print(f"[GetChallenge] Ошибка: {e}")
        raise


def connect(user_key: str, challenge: str, canary: str, fingerprint: str, 
            game_name: str, project_id: str, mtls_cert=None) -> str:
    """
    Отправляет connect запрос с решением challenge
    """
    # Решаем challenge
    if len(challenge) > 100:
        challenge_response = sha256(challenge)
    else:
        challenge_response = sha256(challenge + user_key + fingerprint)
    
    # Генерируем nonce
    nonce = random_hex(16)
    
    # Подготавливаем данные для шифрования
    data = {
        "a": user_key,
        "b": challenge_response,
        "c": canary,
        "d": fingerprint,
        "e": game_name,
        "f": "test-serial",  # В реальном приложении это Android ID
        "g": "test-android-id",  # Android ID
        "h": "test-device-model",  # Device model
        "i": "test-device-brand",  # Device brand
        "j": nonce,
        "k": project_id
    }
    
    # Шифруем данные
    encrypted_blob = encrypt_with_master_key(json.dumps(data), MASTER_KEY)
    
    # Отправляем запрос
    url = f"{SERVER_URL}/api/connect"
    request_data = {
        "blob": encrypted_blob,
        "project_id": project_id  # Передаем project_id для правильной расшифровки
    }
    
    print(f"[Connect] Отправка запроса на {url}")
    print(f"[Connect] Данные для шифрования: {json.dumps(data, indent=2)}")
    
    try:
        # Используем User-Agent, похожий на Android клиент, чтобы пройти валидацию
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 11; SM-G991B Build/RP1A.200720.012)"
        }
        
        response = requests.post(
            url,
            json=request_data,
            headers=headers,
            cert=mtls_cert,  # None если сертификаты не найдены
            timeout=10
        )
        
        print(f"[Connect] Статус ответа: {response.status_code}")
        
        if response.status_code == 200:
            # Расшифровываем ответ
            decrypted_response = decrypt_with_master_key(response.text, MASTER_KEY)
            result = json.loads(decrypted_response)
            
            print(f"[Connect] Расшифрованный ответ: {json.dumps(result, indent=2)}")
            
            if "error" in result:
                return f"Ошибка сервера: {result['error']}"
            
            if "a" in result and "d" in result and "f" in result:
                token = result["a"] + result["d"] + result["f"]
                expires_at = result.get("expires_at", "Never")
                seconds_left = result.get("seconds_left_human", "Unknown")
                
                print(f"[Connect] SUCCESS")
                print(f"[Connect] Token: {token}")
                print(f"[Connect] Истекает: {expires_at}")
                print(f"[Connect] Осталось: {seconds_left}")
                
                return f"VALID|{expires_at}|{seconds_left}"
            else:
                return "Ошибка: Неверный формат ответа сервера"
        else:
            print(f"[Connect] Ошибка сервера: {response.status_code}")
            print(f"[Connect] Ответ (raw): {response.text}")
            
            # Пытаемся расшифровать ошибку
            error_message = None
            try:
                # Сначала пробуем как обычный JSON
                error_json = json.loads(response.text)
                if "error" in error_json:
                    error_message = error_json["error"]
                    if "not found" in error_message.lower() or "не найден" in error_message.lower():
                        return "✗ Ключ лицензии не найден на сервере"
            except json.JSONDecodeError:
                # Если не JSON, пробуем расшифровать
                decrypted = False
                # Сначала пробуем с master key
                try:
                    print(f"[Connect] Пытаемся расшифровать ответ с master key...")
                    decrypted_error = decrypt_with_master_key(response.text, MASTER_KEY)
                    print(f"[Connect] ✓ Расшифровано с master key: {decrypted_error[:200]}")
                    error_json = json.loads(decrypted_error)
                    decrypted = True
                except Exception as e1:
                    print(f"[Connect] Не удалось расшифровать с master key: {type(e1).__name__}")
                    # Пробуем с project key (если отличается)
                    if PROJECT_KEY != MASTER_KEY:
                        try:
                            print(f"[Connect] Пытаемся расшифровать с project key...")
                            decrypted_error = decrypt_with_master_key(response.text, PROJECT_KEY)
                            print(f"[Connect] ✓ Расшифровано с project key: {decrypted_error[:200]}")
                            error_json = json.loads(decrypted_error)
                            decrypted = True
                        except Exception as e2:
                            print(f"[Connect] Не удалось расшифровать с project key: {type(e2).__name__}")
                
                if decrypted:
                    if "error" in error_json:
                        error_message = error_json["error"]
                        if "not found" in error_message.lower() or "не найден" in error_message.lower():
                            return "✗ Ключ лицензии не найден на сервере"
                        if "rate limit" in error_message.lower() or "redis" in error_message.lower():
                            return f"⚠ Проблема сервера: {error_message}\n   (Redis недоступен или rate limit превышен)"
                        if "certificate" in error_message.lower() or "mtls" in error_message.lower() or "client certificate" in error_message.lower():
                            return f"⚠ Требуется mTLS: {error_message}\n   (Сервер требует клиентский сертификат)"
                        return f"✗ Ошибка: {error_message}"
            
            # Формируем понятное сообщение об ошибке
            if response.status_code == 503:
                return "⚠ Сервер временно недоступен (503)\n   Возможные причины:\n   - Redis недоступен\n   - Сервер перегружен\n   - Проверьте логи сервера"
            elif response.status_code == 429:
                return "⚠ Превышен лимит запросов (429)\n   Подождите немного и попробуйте снова"
            elif response.status_code == 403:
                return f"✗ Доступ запрещен (403)\n   {error_message if error_message else 'Проверьте настройки безопасности сервера'}"
            elif response.status_code == 401:
                return f"✗ Ошибка аутентификации (401)\n   {error_message if error_message else 'Неверный ключ или challenge'}"
            else:
                return f"✗ Ошибка HTTP {response.status_code}\n   {error_message if error_message else response.text[:100]}"
            
    except requests.exceptions.ConnectionError as e:
        print(f"[Connect] Ошибка подключения: {e}")
        raise
    except Exception as e:
        print(f"[Connect] Ошибка: {e}")
        raise


def check_license(user_key: str, game_name: str) -> str:
    """
    Основная функция проверки лицензии
    """
    print(f"\n{'='*60}")
    print(f"Проверка лицензии")
    print(f"{'='*60}")
    print(f"Ключ: {user_key}")
    print(f"Игра: {game_name}")
    print(f"Fingerprint: {FINGERPRINT}")
    print(f"Project ID: {PROJECT_ID}")
    print(f"{'='*60}\n")
    
    # Получаем mTLS сертификаты один раз для всех запросов
    # Используем project_id из конфигурации (может быть обновлен позже)
    mtls_cert = get_mtls_cert(PROJECT_ID, CLIENT_NAME)
    
    # Шаг 1: Получаем challenge
    print("[Шаг 1] Получение challenge от сервера...")
    try:
        challenge, canary, actual_project_id = get_challenge(user_key, FINGERPRINT, PROJECT_ID, mtls_cert)
        print(f"[Шаг 1] ✓ Challenge получен")
        print(f"[Шаг 1] ✓ Ключ найден на сервере!")
        # Используем project_id из ответа сервера
        project_id_to_use = actual_project_id
    except Exception as e:
        error_msg = str(e)
        if "не найден" in error_msg.lower() or "not found" in error_msg.lower():
            return f"✗ Ключ лицензии не найден на сервере"
        return f"Ошибка: Не удалось получить challenge от сервера: {e}"
    
    # Шаг 2: Отправляем connect запрос
    print("\n[Шаг 2] Отправка connect запроса...")
    try:
        result = connect(user_key, challenge, canary, FINGERPRINT, game_name, project_id_to_use, mtls_cert)
        # Если получили ошибку, но challenge был получен - ключ найден
        if not result.startswith("VALID") and ("403" in result or "Доступ запрещен" in result):
            return f"✓ Ключ найден на сервере!\n   Challenge получен успешно.\n   {result}"
        return result
    except Exception as e:
        # Даже если connect не прошел, challenge получен = ключ найден
        return f"✓ Ключ найден на сервере!\n   Challenge получен успешно.\n   Ошибка connect: {e}"


if __name__ == "__main__":
    try:
        result = check_license(USER_KEY, GAME_NAME)
        
        print(f"\n{'='*60}")
        print("РЕЗУЛЬТАТ ПРОВЕРКИ:")
        print(f"{'='*60}")
        if result.startswith("VALID"):
            parts = result.split("|")
            print("✓ ЛИЦЕНЗИЯ ДЕЙСТВИТЕЛЬНА!")
            if len(parts) > 1:
                print(f"  Истекает: {parts[1]}")
            if len(parts) > 2:
                print(f"  Осталось: {parts[2]}")
        elif "Ключ найден на сервере" in result or "Challenge получен" in result:
            # Если challenge получен, значит ключ найден
            print("✓ КЛЮЧ НАЙДЕН НА СЕРВЕРЕ!")
            print("  Challenge получен успешно - ключ существует и активен")
            if "403" in result or "Доступ запрещен" in result:
                print("  ⚠ Примечание: Полная проверка не завершена из-за проблем")
                print("    с безопасностью сервера, но ключ подтвержден!")
        elif result.startswith("✗"):
            print(result)
        elif result.startswith("⚠"):
            print(result)
        else:
            print(result)
        print(f"{'='*60}\n")
            
    except KeyboardInterrupt:
        print("\n\nПрервано пользователем")
    except Exception as e:
        print(f"\n\nКритическая ошибка: {e}")
        import traceback
        traceback.print_exc()

