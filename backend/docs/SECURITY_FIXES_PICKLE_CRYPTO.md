# Security Fixes: PickleType, Secrets Fallback, and Cryptography Complexity

## Обзор

Исправлены три критические уязвимости безопасности, выявленные в security audit:

1. **Использование PickleType** - заменено на JSON для предотвращения RCE атак
2. **Hardcoded Secrets Fallback** - приложение теперь падает в production при отсутствии секретов
3. **Cryptography Complexity** - упрощена логика дешифрования для предотвращения timing attacks

## 1. Замена PickleType на JSON

### Проблема
Модель `ReferralCode` использовала `db.PickleType` для хранения `game_ids` и `rbac_role_ids`. Pickle небезопасен - если злоумышленник получит доступ к БД (SQLi) или Redis, он сможет выполнить RCE (Remote Code Execution) при десериализации этих данных.

### Решение
- Заменен `db.PickleType` на `db.JSON` в модели `ReferralCode`
- Обновлены property методы для работы с JSON форматом
- Добавлена обратная совместимость для legacy данных (строковый формат)
- Создана миграция `replace_pickletype_with_json.py` для конвертации существующих данных

### Файлы
- `backend/models/keys.py` - модель ReferralCode
- `backend/migrations/versions/replace_pickletype_with_json.py` - миграция

### Примечания
- Для PostgreSQL используется JSONB (более эффективный)
- Для других БД используется JSON
- Существующие PickleType данные должны быть конвертированы отдельно (data migration)

## 2. Hardcoded Secrets Fallback

### Проблема
В `config.py` и `secure_crypto.py` была логика, которая позволяла использовать ключи по умолчанию или генерировать их "на лету", если переменные окружения не заданы. В продакшене приложение могло "тихо" запуститься с небезопасной конфигурацией.

### Решение
- Добавлена явная проверка `IS_PRODUCTION` режима
- В production режиме приложение **обязательно падает** при отсутствии:
  - `PANEL_MASTER_KEY`
  - `JWT_SECRET_KEY`
- Улучшены сообщения об ошибках с указанием, что в production режиме приложение должно падать

### Файлы
- `backend/config/config.py` - проверка секретов в production режиме

### Пример ошибки
```
CRITICAL SECURITY ERROR: PANEL_MASTER_KEY environment variable is not set!
In production mode, the application MUST fail if secrets are missing.
This prevents running with insecure default configurations.
```

## 3. Упрощение логики дешифрования

### Проблема
Логика шифрования (`decryption_service.py`, `secure_crypto.py`) была слишком "умной". Она пыталась расшифровать данные:
1. Ключом проекта (AES Key)
2. Если не вышло - мастер-ключом проекта (project_master_key)
3. Если не вышло - Legacy GCM методом
4. Если не вышло - стандартным методом
5. Если не вышло - глобальным MASTER_KEY

Это открывало вектор для:
- **Timing Attacks** - время ответа зависит от того, какой ключ подошел
- **Padding Oracle Attacks** - разные методы могут давать разные времена ответа
- **Key Enumeration Attacks** - можно определить, какой ключ используется

### Решение
- **Один ключ**: Используется только один источник ключа (предпочтительно AES Key из ProjectEncryptionKeys)
- **Один метод**: Используется только стандартный метод дешифрования (без legacy fallbacks)
- **Fail Fast**: При ошибке дешифрования сразу выбрасывается исключение (без множественных попыток)
- **Удален fallback на глобальный MASTER_KEY**: В strict multi-tenant архитектуре каждый проект должен использовать свой ключ

### Файлы
- `backend/utils/secure_crypto.py` - функция `decrypt_data_with_project_key`
- `backend/routes/settings.py` - упрощенная функция дешифрования
- `backend/services/connect/decryption_service.py` - удален fallback на глобальный ключ

### Изменения в логике

**До:**
```python
# Пытается AES Key -> project_master_key -> legacy GCM -> standard -> global MASTER_KEY
try:
    decrypt_with_aes_key()
except:
    try:
        decrypt_with_project_master_key()
    except:
        try:
            decrypt_with_legacy_gcm()
        except:
            decrypt_with_standard()
```

**После:**
```python
# Использует только один ключ и один метод
key = get_project_key()  # AES Key или project_master_key
decrypt_with_standard_method(key)  # Один метод, fail fast
```

## Миграция базы данных

### Запуск миграции

```bash
# Применить миграцию
flask db upgrade

# Откатить миграцию (не рекомендуется в production)
flask db downgrade
```

### Важно
- Перед применением миграции убедитесь, что существующие PickleType данные конвертированы в JSON
- В production рекомендуется создать backup перед миграцией
- Миграция может потерять данные, если они не могут быть конвертированы из Pickle в JSON

## Тестирование

### Проверка замены PickleType
```python
# Создать referral code с game_ids
code = ReferralCode(
    code="TEST123",
    game_ids=[1, 2, 3],  # Теперь JSON, не PickleType
    rbac_role_ids=[1, 2]
)
db.session.add(code)
db.session.commit()

# Проверить, что данные сохраняются как JSON
assert isinstance(code.game_ids, list)
```

### Проверка production secrets
```bash
# В production режиме приложение должно падать без секретов
export FLASK_ENV=production
unset PANEL_MASTER_KEY
python -m backend  # Должно упасть с RuntimeError
```

### Проверка упрощенной дешифровки
- Дешифровка должна использовать только один ключ
- При ошибке должно сразу выбрасываться исключение
- Не должно быть fallback на глобальный MASTER_KEY

## Обратная совместимость

- **PickleType -> JSON**: Модель поддерживает legacy строковый формат данных
- **Дешифровка**: Старые данные, зашифрованные project_master_key, все еще поддерживаются
- **Миграция**: Миграция может потерять данные, если они не конвертируются из Pickle

## Рекомендации

1. **Немедленно применить миграцию** в production после тестирования
2. **Проверить все места**, где используются ReferralCode, на совместимость с JSON
3. **Убедиться**, что все секреты установлены в production через environment variables
4. **Мониторить логи** на предмет ошибок дешифрования после изменений

## Связанные файлы

- `backend/models/keys.py` - модель ReferralCode
- `backend/config/config.py` - проверка секретов
- `backend/utils/secure_crypto.py` - упрощенная дешифровка
- `backend/routes/settings.py` - упрощенная дешифровка в routes
- `backend/services/connect/decryption_service.py` - удален fallback на глобальный ключ
- `backend/migrations/versions/replace_pickletype_with_json.py` - миграция

