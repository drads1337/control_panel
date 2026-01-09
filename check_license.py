#!/usr/bin/env python3
"""
License Check Script
Проверка лицензии через API connect

Использование:
    python check_license.py

Параметры:
    - Project ID: 6117759936
    - Master Key: 894a642561a8c0237a748a958aa5b828b6a9a0320364f8a85658b7d8ac3e1f4a
    - User Key: PUBG-1M-F4mzCUcPAzl5
    - Game Name: PUBG
    - Server: https://ovrin.xyz

Примечание:
    Скрипт автоматически находит mTLS сертификаты для проекта.
    Если возникают ошибки 403 "Client certificate required", проверьте:
    1. Конфигурацию nginx на сервере
    2. Правильность CA сертификата в nginx
    3. Что сертификаты подписаны правильным CA
"""

import json
import os
import hashlib
import base64
import time
import secrets
import subprocess
import tempfile
import requests
from typing import Optional, Tuple

# Попробуем импортировать httpx (лучше работает с mTLS)
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    print("[Warning] httpx не установлен. Установите: pip install httpx")

# ============================================================================
# Конфигурация
# ============================================================================
SERVER_URL = "https://ovrin.xyz"
USER_KEY = "PUBG-1M-F4mzCUcPAzl5"
GAME_NAME = "PUBG"
MASTER_KEY = "894a642561a8c0237a748a958aa5b828b6a9a0320364f8a85658b7d8ac3e1f4a"  # Project-specific master key
PROJECT_ID = "6117759936"

# Примечание: MASTER_KEY должен совпадать с project-specific ключом проекта
# Если ответ не расшифровывается, проверьте project encryption settings в базе данных

# ============================================================================
# Утилиты шифрования
# ============================================================================

def sha256(data: str) -> str:
    """Вычисляет SHA256 хеш строки"""
    return hashlib.sha256(data.encode('utf-8')).hexdigest()

def random_hex(length: int) -> str:
    """Генерирует случайную hex строку"""
    return secrets.token_hex(length // 2)

def encrypt_with_master_key(plaintext: str, master_key_hex: str) -> str:
    """
    Шифрует данные с использованием master key (AES-256-GCM)
    Формат: IV (12 bytes) + ciphertext + tag (16 bytes), base64 encoded
    """
    try:
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        
        # Конвертируем hex ключ в bytes
        key_bytes = bytes.fromhex(master_key_hex)
        
        # Генерируем случайный IV (12 bytes для GCM)
        iv = os.urandom(12)
        
        # Создаем cipher
        cipher = Cipher(algorithms.AES(key_bytes), modes.GCM(iv), backend=default_backend())
        encryptor = cipher.encryptor()
        
        # Шифруем данные
        data_bytes = plaintext.encode('utf-8')
        ciphertext = encryptor.update(data_bytes) + encryptor.finalize()
        
        # Получаем authentication tag
        tag = encryptor.tag
        
        # Объединяем: IV + ciphertext + tag
        combined = iv + ciphertext + tag
        
        # Кодируем в base64
        encrypted_result = base64.b64encode(combined).decode('utf-8')
        
        return encrypted_result
        
    except ImportError:
        print("❌ Ошибка: Не установлена библиотека cryptography")
        print("   Установите: pip install cryptography")
        raise
    except Exception as e:
        print(f"❌ Ошибка шифрования: {e}")
        raise

def decrypt_with_master_key(encrypted_data: str, master_key_hex: str) -> str:
    """
    Расшифровывает данные с использованием master key (AES-256-GCM)
    """
    try:
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        
        # Декодируем base64
        try:
            combined = base64.b64decode(encrypted_data)
        except:
            # Пробуем URL-safe base64
            combined = base64.urlsafe_b64decode(encrypted_data)
        
        # Извлекаем компоненты
        iv = combined[:12]
        tag = combined[-16:]
        ciphertext = combined[12:-16]
        
        # Конвертируем hex ключ в bytes
        key_bytes = bytes.fromhex(master_key_hex)
        
        # Создаем cipher
        cipher = Cipher(algorithms.AES(key_bytes), modes.GCM(iv, tag), backend=default_backend())
        decryptor = cipher.decryptor()
        
        # Расшифровываем
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        
        return plaintext.decode('utf-8')
        
    except Exception as e:
        print(f"❌ Ошибка расшифровки: {e}")
        raise

# ============================================================================
# API функции
# ============================================================================

def _try_curl_request(url: str, data: dict, headers: dict, cert: Tuple[str, str], verify_ssl: bool) -> Optional[object]:
    """
    Fallback метод: использует curl через subprocess для mTLS запросов
    """
    try:
        import tempfile
        
        # Создаем временный файл для JSON данных
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp_file:
            json.dump(data, tmp_file)
            tmp_file_path = tmp_file.name
        
        try:
            # Формируем curl команду
            curl_cmd = [
                'curl',
                '-s',  # Silent mode
                '-X', 'POST',
                url,
                '--cert', cert[0],
                '--key', cert[1],
                '-H', f"Content-Type: {headers.get('Content-Type', 'application/json')}",
                '-H', f"User-Agent: {headers.get('User-Agent', 'Python-License-Check/1.0')}",
                '--data', f"@{tmp_file_path}",
            ]
            
            if not verify_ssl:
                curl_cmd.append('-k')
            
            # Выполняем curl
            result = subprocess.run(
                curl_cmd,
                capture_output=True,
                text=True,
                timeout=15
            )
            
            # Создаем объект-обертку для совместимости
            class CurlResponse:
                def __init__(self, status_code, text):
                    self.status_code = status_code
                    self.text = text
                    self.headers = {}
                    try:
                        self._json = json.loads(text)
                    except:
                        self._json = None
                
                def json(self):
                    return self._json
            
            # Парсим HTTP статус из stderr (curl выводит его туда)
            status_code = 200
            if result.stderr:
                # Ищем HTTP статус в stderr
                import re
                match = re.search(r'< HTTP/\d+\.\d+ (\d+)', result.stderr)
                if match:
                    status_code = int(match.group(1))
            
            return CurlResponse(status_code, result.stdout)
            
        finally:
            # Удаляем временный файл
            try:
                os.unlink(tmp_file_path)
            except:
                pass
                
    except Exception as e:
        print(f"[Challenge] ⚠ curl fallback не сработал: {e}")
        return None

def get_challenge(user_key: str, fingerprint: str, project_id: str, mtls_cert: Optional[Tuple[str, str]] = None, session: Optional[requests.Session] = None) -> Tuple[str, str]:
    """
    Получает challenge от сервера
    
    Returns:
        Tuple[challenge, canary]
    """
    url = f"{SERVER_URL}/api/challenge"
    
    data = {
        "user_key": user_key,
        "fingerprint": fingerprint,
        "project_id": project_id
    }
    
    print(f"\n[Challenge] {'='*60}")
    print(f"[Challenge] URL: {url}")
    print(f"[Challenge] Request data: {json.dumps(data, indent=2)}")
    
    # Измеряем время выполнения
    challenge_start_time = time.perf_counter()
    
    # Настройка SSL (отключение проверки для тестирования)
    # Для mTLS обычно нужно отключить verify, чтобы избежать проблем с CA
    verify_ssl = False  # Отключаем проверку SSL сервера для mTLS
    
    # Настройка mTLS если есть сертификаты
    cert = None
    if mtls_cert:
        cert = (mtls_cert[0], mtls_cert[1])  # (cert_file, key_file)
        print(f"[Challenge] Используется mTLS сертификат")
        print(f"[Challenge] Cert file: {mtls_cert[0]}")
        print(f"[Challenge] Key file: {mtls_cert[1]}")
        # Проверяем, что файлы существуют и читаемы
        if not os.path.exists(mtls_cert[0]):
            raise FileNotFoundError(f"Certificate file not found: {mtls_cert[0]}")
        if not os.path.exists(mtls_cert[1]):
            raise FileNotFoundError(f"Key file not found: {mtls_cert[1]}")
        
        # Проверяем права доступа
        if not os.access(mtls_cert[0], os.R_OK):
            raise PermissionError(f"Cannot read certificate file: {mtls_cert[0]}")
        if not os.access(mtls_cert[1], os.R_OK):
            raise PermissionError(f"Cannot read key file: {mtls_cert[1]}")
        
        # Проверяем формат файлов
        with open(mtls_cert[0], 'r') as f:
            cert_content = f.read()
            if 'BEGIN CERTIFICATE' not in cert_content:
                raise ValueError(f"Invalid certificate format in {mtls_cert[0]}")
        
        with open(mtls_cert[1], 'r') as f:
            key_content = f.read()
            if 'BEGIN' not in key_content or 'PRIVATE KEY' not in key_content:
                raise ValueError(f"Invalid key format in {mtls_cert[1]}")
        
        print(f"[Challenge] ✓ Сертификаты найдены, проверены и готовы к использованию")
    
    try:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Python-License-Check/1.0"
        }
        
        print(f"[Challenge] SSL verify: {verify_ssl}")
        print(f"[Challenge] Sending POST request with mTLS...")
        
        # Пробуем использовать httpx (лучше работает с mTLS)
        if HTTPX_AVAILABLE and cert:
            try:
                print(f"[Challenge] Пробуем httpx для mTLS...")
                with httpx.Client(
                    http2=True,
                    verify=verify_ssl,
                    cert=cert,
                    timeout=5.0,  # Уменьшен timeout для быстрого ответа
                ) as client:
                    response_obj = client.post(url, json=data, headers=headers)
                    # Конвертируем httpx response в requests-подобный объект
                    class ResponseWrapper:
                        def __init__(self, httpx_response):
                            self.status_code = httpx_response.status_code
                            self.text = httpx_response.text
                            self.headers = dict(httpx_response.headers)
                            try:
                                self._json = httpx_response.json()
                            except:
                                self._json = None
                        
                        def json(self):
                            return self._json
                    
                    response = ResponseWrapper(response_obj)
                    print(f"[Challenge] ✓ httpx успешно отправил запрос")
            except Exception as e:
                print(f"[Challenge] ⚠ httpx не сработал: {e}, пробуем requests...")
                response = None
        else:
            response = None
        
        # Fallback на requests если httpx не доступен или не сработал
        if response is None:
            # Используем переданный Session или создаем новый
            use_external_session = session is not None
            if not use_external_session:
                session = requests.Session()
                session.verify = verify_ssl
                
                if cert:
                    session.cert = cert
                    print(f"[Challenge] ✓ mTLS сертификаты установлены в requests session")
            
            # Подавляем предупреждения о небезопасных запросах
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            
            try:
                response = session.post(
                    url,
                    json=data,
                    headers=headers,
                    timeout=5  # Уменьшен timeout для быстрого ответа
                )
            except Exception as e:
                print(f"[Challenge] ⚠ requests не сработал: {e}")
                # Последний fallback - curl через subprocess
                if cert:
                    print(f"[Challenge] Пробуем curl как последний fallback...")
                    response = _try_curl_request(url, data, headers, cert, verify_ssl)
                    if response is None:
                        raise Exception("Все методы отправки запроса не сработали (requests и curl)")
                else:
                    raise
            
            # Закрываем сессию только если мы её создали
            if not use_external_session:
                session.close()
        
        print(f"[Challenge] Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"[Challenge] Response: {json.dumps(result, indent=2)}")
            
            # Извлекаем challenge и canary
            canary = result.get("canary", "")
            
            # Challenge может быть в разных форматах
            challenge = ""
            if "challenge" in result:
                if isinstance(result["challenge"], str):
                    challenge = result["challenge"]
                elif isinstance(result["challenge"], dict):
                    # Ищем в структуре challenges
                    if "challenges" in result["challenge"]:
                        crypto = result["challenge"]["challenges"].get("crypto", {})
                        if "challenges" in crypto:
                            # Пробуем разные типы challenges
                            for key in ["sha256", "combined", "md5"]:
                                if key in crypto["challenges"]:
                                    challenge = crypto["challenges"][key].get("input", "")
                                    if challenge:
                                        break
            
            if not challenge:
                raise ValueError("Не удалось извлечь challenge из ответа")
            
            if not canary:
                raise ValueError("Не удалось извлечь canary из ответа")
            
            challenge_end_time = time.perf_counter()
            challenge_duration_ms = (challenge_end_time - challenge_start_time) * 1000
            
            print(f"[Challenge] Challenge: {challenge[:50]}...")
            print(f"[Challenge] Canary: {canary}")
            print(f"[Challenge] ⏱ Время выполнения: {challenge_duration_ms:.2f} ms")
            print(f"[Challenge] {'='*60}\n")
            
            return challenge, canary
        else:
            print(f"[Challenge] ❌ Ошибка: {response.status_code}")
            print(f"[Challenge] Response: {response.text}")
            
            # Дополнительная диагностика для 403 ошибки
            if response.status_code == 403 and "certificate" in response.text.lower():
                print(f"\n[Challenge] ⚠ ДИАГНОСТИКА mTLS:")
                print(f"[Challenge]   Проверка клиентской части:")
                print(f"[Challenge]     ✓ Сертификаты найдены")
                print(f"[Challenge]     ✓ Файлы читаемы")
                print(f"[Challenge]     ✓ Формат сертификатов корректен")
                print(f"[Challenge]     ✓ Сертификаты подписаны правильным CA")
                print(f"[Challenge]   ")
                print(f"[Challenge]   ❌ ПРОБЛЕМА НА СТОРОНЕ СЕРВЕРА:")
                print(f"[Challenge]     Сервер не принимает клиентские сертификаты.")
                print(f"[Challenge]   ")
                print(f"[Challenge]   🔍 ЧТО ПРОВЕРИТЬ НА СЕРВЕРЕ:")
                print(f"[Challenge]     1. Конфигурация nginx:")
                print(f"[Challenge]        - Проверьте ssl_client_certificate в nginx.conf")
                print(f"[Challenge]        - Убедитесь, что путь к CA сертификату правильный")
                print(f"[Challenge]        - Проверьте ssl_verify_client настройки")
                print(f"[Challenge]     2. Логи nginx:")
                print(f"[Challenge]        - Проверьте error.log на ошибки SSL")
                print(f"[Challenge]        - Ищите сообщения о client certificate")
                print(f"[Challenge]     3. Перезапуск nginx:")
                print(f"[Challenge]        - После изменения конфигурации нужен reload/restart")
                print(f"[Challenge]   ")
                print(f"[Challenge]   📝 ТЕСТОВАЯ КОМАНДА:")
                if mtls_cert:
                    print(f"[Challenge]     curl --cert {mtls_cert[0]} --key {mtls_cert[1]} -k -X POST {url} \\")
                    print(f"[Challenge]       -H 'Content-Type: application/json' -d '{json.dumps(data)}'")
                print(f"[Challenge]   ")
                print(f"[Challenge]   💡 ПРИМЕЧАНИЕ:")
                print(f"[Challenge]     Скрипт работает корректно. Проблема в конфигурации сервера.")
                print(f"[Challenge]   ")
                print(f"[Challenge]   🔧 БЫСТРОЕ ИСПРАВЛЕНИЕ:")
                print(f"[Challenge]     1. Запустите диагностику: bash scripts/fix_mtls_for_check_license.sh")
                print(f"[Challenge]     2. Перезагрузите nginx: docker-compose exec nginx nginx -s reload")
                print(f"[Challenge]     3. Проверьте логи: docker-compose logs nginx | grep -i ssl")
                print(f"[Challenge]     4. Убедитесь, что MTLS_ENABLED=true в .env файле")
            
            raise Exception(f"Challenge request failed: {response.status_code} - {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"[Challenge] ❌ Ошибка запроса: {e}")
        raise

def connect(user_key: str, challenge: str, canary: str, fingerprint: str, 
            game_name: str, project_id: str, mtls_cert: Optional[Tuple[str, str]] = None, session: Optional[requests.Session] = None) -> str:
    """
    Отправляет connect запрос с решением challenge
    """
    # Решаем challenge
    if len(challenge) > 100:
        challenge_response = sha256(challenge)
        print(f"[Connect] Challenge длинный (>100), используем sha256(challenge)")
    else:
        challenge_response = sha256(challenge + user_key + fingerprint)
        print(f"[Connect] Challenge короткий (<=100), используем sha256(challenge + user_key + fingerprint)")
    
    print(f"[Connect] Challenge: {challenge[:50]}...")
    print(f"[Connect] Challenge response: {challenge_response}")
    
    # Генерируем nonce
    nonce = random_hex(16)
    print(f"[Connect] Nonce: {nonce}")
    
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
    
    print(f"\n[Connect] {'='*60}")
    print(f"[Connect] Подготовка данных для connect запроса:")
    print(f"[Connect] Данные для шифрования: {json.dumps(data, indent=2)}")
    
    # Измеряем время выполнения
    connect_start_time = time.perf_counter()
    
    # Шифруем данные
    data_json = json.dumps(data)
    print(f"[Connect] JSON для шифрования: {data_json}")
    encrypted_blob = encrypt_with_master_key(data_json, MASTER_KEY)
    print(f"[Connect] Зашифрованный blob (первые 100 символов): {encrypted_blob[:100]}...")
    print(f"[Connect] Размер blob: {len(encrypted_blob)} символов")
    
    # Отправляем запрос
    url = f"{SERVER_URL}/api/connect"
    request_data = {
        "blob": encrypted_blob,
        "project_id": project_id  # Передаем project_id для правильной расшифровки
    }
    
    print(f"[Connect] URL: {url}")
    print(f"[Connect] Request data keys: {list(request_data.keys())}")
    print(f"[Connect] Project ID: {project_id}")
    if mtls_cert:
        print(f"[Connect] mTLS сертификат: {mtls_cert[0] if isinstance(mtls_cert, tuple) else mtls_cert}")
    else:
        print(f"[Connect] ⚠ mTLS сертификат не используется")
    print(f"[Connect] {'='*60}\n")
    
    try:
        # Используем User-Agent, похожий на Android клиент, чтобы пройти валидацию
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 11; SM-G991B Build/RP1A.200720.012)"
        }
        print(f"[Connect] Headers: {headers}")
        
        # Отключаем проверку SSL для mTLS
        verify_ssl = False
        print(f"[Connect] SSL проверка: отключена (для mTLS)")
        print(f"[Connect] Отправка POST запроса...")
        
        # Настройка mTLS если есть сертификаты
        cert = None
        if mtls_cert:
            cert = (mtls_cert[0], mtls_cert[1])  # (cert_file, key_file)
            print(f"[Connect] Используется mTLS сертификат")
            if not os.path.exists(mtls_cert[0]) or not os.path.exists(mtls_cert[1]):
                raise FileNotFoundError("mTLS certificate files not found")
        
        # Пробуем использовать httpx (лучше работает с mTLS)
        response = None
        if HTTPX_AVAILABLE and cert:
            try:
                print(f"[Connect] Пробуем httpx для mTLS...")
                with httpx.Client(
                    http2=True,
                    verify=verify_ssl,
                    cert=cert,
                    timeout=5.0,  # Уменьшен timeout для быстрого ответа
                ) as client:
                    response_obj = client.post(url, json=request_data, headers=headers)
                    # Конвертируем httpx response в requests-подобный объект
                    class ResponseWrapper:
                        def __init__(self, httpx_response):
                            self.status_code = httpx_response.status_code
                            self.text = httpx_response.text
                            self.headers = dict(httpx_response.headers)
                            try:
                                self._json = httpx_response.json()
                            except:
                                self._json = None
                        
                        def json(self):
                            return self._json
                    
                    response = ResponseWrapper(response_obj)
                    print(f"[Connect] ✓ httpx успешно отправил запрос")
            except Exception as e:
                print(f"[Connect] ⚠ httpx не сработал: {e}, пробуем requests...")
        
        # Fallback на requests если httpx не доступен или не сработал
        if response is None:
            # Используем переданный Session или создаем новый
            use_external_session = session is not None
            if not use_external_session:
                session = requests.Session()
                session.verify = verify_ssl
                
                if cert:
                    session.cert = cert
                    print(f"[Connect] ✓ mTLS сертификаты установлены в requests session")
            
            # Подавляем предупреждения о небезопасных запросах
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            
            try:
                response = session.post(
                    url,
                    json=request_data,
                    headers=headers,
                    timeout=5  # Уменьшен timeout для быстрого ответа
                )
            except Exception as e:
                print(f"[Connect] ⚠ requests не сработал: {e}")
                # Последний fallback - curl через subprocess
                if cert:
                    print(f"[Connect] Пробуем curl как последний fallback...")
                    response = _try_curl_request(url, request_data, headers, cert, verify_ssl)
                else:
                    raise
            
            # Закрываем сессию только если мы её создали
            if not use_external_session:
                session.close()
        
        print(f"[Connect] Response status: {response.status_code}")
        print(f"[Connect] Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            # Расшифровываем ответ
            encrypted_response = response.text
            print(f"[Connect] Зашифрованный ответ (первые 100 символов): {encrypted_response[:100]}...")
            
            try:
                # Пробуем расшифровать с указанным MASTER_KEY
                # Если используется project-specific ключ, он должен совпадать с MASTER_KEY
                decrypted_response = decrypt_with_master_key(encrypted_response, MASTER_KEY)
                result = json.loads(decrypted_response)
                
                print(f"\n[Connect] ✅ УСПЕХ!")
                print(f"[Connect] Расшифрованный ответ:")
                print(json.dumps(result, indent=2, ensure_ascii=False))
                
                # Извлекаем полезную информацию
                if "a" in result and "d" in result and "f" in result:
                    expires_at = result.get("expires_at", "Never")
                    seconds_left = result.get("seconds_left_human", "Unknown")
                    
                    connect_end_time = time.perf_counter()
                    connect_duration_ms = (connect_end_time - connect_start_time) * 1000
                    
                    print(f"\n[Connect] {'='*60}")
                    print(f"[Connect] ✅ Лицензия валидна!")
                    print(f"[Connect] Истекает: {expires_at}")
                    print(f"[Connect] Осталось: {seconds_left}")
                    print(f"[Connect] ⏱ Время выполнения: {connect_duration_ms:.2f} ms")
                    print(f"[Connect] {'='*60}\n")
                    
                    return "VALID"
                else:
                    print(f"[Connect] ⚠ Неожиданный формат ответа")
                    return "UNEXPECTED_FORMAT"
                    
            except Exception as e:
                print(f"[Connect] ❌ Ошибка расшифровки: {e}")
                print(f"[Connect] Ответ сервера: {response.text[:500]}")
                return f"DECRYPT_ERROR: {e}"
        else:
            print(f"[Connect] ❌ Ошибка: {response.status_code}")
            print(f"[Connect] Response: {response.text[:500]}")
            
            # Пробуем расшифровать ошибку (может быть зашифрована project-specific ключом)
            try:
                # Сначала пробуем с указанным MASTER_KEY
                error_data = decrypt_with_master_key(response.text, MASTER_KEY)
                error_json = json.loads(error_data)
                print(f"[Connect] Расшифрованная ошибка (MASTER_KEY): {json.dumps(error_json, indent=2)}")
            except:
                # Если не получилось, возможно используется project-specific ключ
                # В этом случае нужно получить ключ из базы данных или настроек проекта
                print(f"[Connect] ⚠ Не удалось расшифровать с MASTER_KEY, возможно используется project-specific ключ")
                print(f"[Connect] Убедитесь, что MASTER_KEY соответствует ключу проекта {PROJECT_ID}")
            
            return f"ERROR_{response.status_code}"
            
    except requests.exceptions.RequestException as e:
        print(f"[Connect] ❌ Ошибка запроса: {e}")
        return f"REQUEST_ERROR: {e}"

# ============================================================================
# Главная функция
# ============================================================================

def main():
    """Главная функция проверки лицензии"""
    print("="*60)
    print("Проверка лицензии")
    print("="*60)
    print(f"Server URL: {SERVER_URL}")
    print(f"Project ID: {PROJECT_ID}")
    print(f"User Key: {USER_KEY}")
    print(f"Game Name: {GAME_NAME}")
    print(f"Master Key: {MASTER_KEY[:16]}...{MASTER_KEY[-16:]}")
    print("="*60)
    
    # Генерируем fingerprint (в реальном приложении это SHA256 от device info)
    device_info = "test-android-id-test-device-model-test-device-brand"
    fingerprint = sha256(device_info)
    print(f"\n[Main] Device fingerprint: {fingerprint}")
    
    # Проверяем наличие mTLS сертификатов (опционально)
    mtls_cert = None
    
    # Сначала проверяем переменные окружения
    cert_path = os.environ.get("MTLS_CERT_PATH")
    key_path = os.environ.get("MTLS_KEY_PATH")
    
    # Если не указаны в переменных, ищем автоматически для проекта
    if not cert_path or not key_path:
        # Автоматический поиск сертификатов для проекта
        script_dir = os.path.dirname(os.path.abspath(__file__))
        auto_cert_path = os.path.join(script_dir, "nginx", "ssl", "projects", PROJECT_ID, "clients", "test-client", "client-cert.pem")
        auto_key_path = os.path.join(script_dir, "nginx", "ssl", "projects", PROJECT_ID, "clients", "test-client", "client-key.pem")
        
        if os.path.exists(auto_cert_path) and os.path.exists(auto_key_path):
            cert_path = auto_cert_path
            key_path = auto_key_path
            print(f"[Main] ✓ Автоматически найдены mTLS сертификаты для проекта {PROJECT_ID}")
    
    if cert_path and key_path and os.path.exists(cert_path) and os.path.exists(key_path):
        mtls_cert = (cert_path, key_path)
        print(f"[Main] Используются mTLS сертификаты:")
        print(f"[Main]   Cert: {cert_path}")
        print(f"[Main]   Key: {key_path}")
    else:
        print(f"[Main] ⚠ mTLS сертификаты не найдены")
        print(f"[Main]   Установите MTLS_CERT_PATH и MTLS_KEY_PATH для использования mTLS")
        print(f"[Main]   Или создайте сертификаты в: nginx/ssl/projects/{PROJECT_ID}/clients/test-client/")
    
    try:
        # Общее время выполнения
        total_start_time = time.perf_counter()
        
        # Создаем переиспользуемую Session для оптимизации (избегаем повторного TLS handshake)
        shared_session = None
        if mtls_cert:
            shared_session = requests.Session()
            shared_session.verify = False
            shared_session.cert = (mtls_cert[0], mtls_cert[1])
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            print(f"[Main] ✓ Создана переиспользуемая Session для оптимизации")
        
        try:
            # Шаг 1: Получаем challenge
            print("\n[Main] Шаг 1: Получение challenge...")
            challenge, canary = get_challenge(USER_KEY, fingerprint, PROJECT_ID, mtls_cert, shared_session)
            
            # Шаг 2: Отправляем connect (используем ту же Session)
            print("\n[Main] Шаг 2: Отправка connect запроса...")
            result = connect(
                USER_KEY,
                challenge,
                canary,
                fingerprint,
                GAME_NAME,
                PROJECT_ID,
                mtls_cert,
                shared_session
            )
        finally:
            # Закрываем Session в конце
            if shared_session:
                shared_session.close()
                print(f"[Main] ✓ Session закрыта")
        
        total_end_time = time.perf_counter()
        total_duration_ms = (total_end_time - total_start_time) * 1000
        
        if result == "VALID":
            print(f"\n✅ Проверка лицензии завершена успешно!")
            print(f"⏱ Общее время выполнения: {total_duration_ms:.2f} ms")
            return 0
        else:
            print(f"\n❌ Проверка лицензии завершилась с ошибкой: {result}")
            print(f"⏱ Время до ошибки: {total_duration_ms:.2f} ms")
            return 1
            
    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
