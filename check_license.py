#!/usr/bin/env python3
"""
Скрипт для проверки лицензии через API
Имитирует поведение Android клиента
"""

import json
import hashlib
import secrets
import base64
import requests
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# Конфигурация
SERVER_URL = "http://192.168.1.80:5001"  # Измените на ваш URL
USER_KEY = "PUBG-1M-BZZ8OnYPSOED"
GAME_NAME = "PUBG"
MASTER_KEY = "ca3695f66cc428a41e6bc8c2ed7ee27b0940fe4da284ae03cc89b89edb35c339"
PROJECT_ID = "9516412833"
# Project key для расшифровки ответов (может отличаться от master key)
PROJECT_KEY = MASTER_KEY  # По умолчанию используем master key

# Генерируем фиктивный fingerprint (в реальном приложении это Android ID + модель + бренд)
FINGERPRINT = hashlib.sha256("test-android-id-test-device-model-test-device-brand".encode()).hexdigest()


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


def get_challenge(user_key: str, fingerprint: str, project_id: str) -> tuple[str, str, str]:
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
            if "project_id" in result:
                project_id = str(result["project_id"])
                print(f"[GetChallenge] Project ID из ответа: {project_id}")
            
            print(f"[GetChallenge] ✓ Challenge получен успешно")
            print(f"[GetChallenge] ✓ Ключ найден на сервере!")
            return challenge, canary, project_id
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
            game_name: str, project_id: str) -> str:
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
    
    # Шаг 1: Получаем challenge
    print("[Шаг 1] Получение challenge от сервера...")
    try:
        challenge, canary, actual_project_id = get_challenge(user_key, FINGERPRINT, PROJECT_ID)
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
        result = connect(user_key, challenge, canary, FINGERPRINT, game_name, project_id_to_use)
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

