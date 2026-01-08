# Получение Project Invite Code

## Команда для получения project code

```bash
# Получить project code для пользователя drads123
docker exec panel_api python -m backend.scripts.get_project_code drads123
```

Или для другого пользователя:

```bash
# Получить project code для любого пользователя
docker exec panel_api python -m backend.scripts.get_project_code <username>
```

## Что делает скрипт:

1. Находит пользователя по username
2. Проверяет, есть ли у пользователя валидный project invite code
3. Если есть валидный код - показывает его
4. Если нет - создает новый код (действителен 30 дней)
5. Выводит код для использования

## Пример вывода:

```
🔍 Поиск project invite code для пользователя: drads123

✓ Найден пользователь: drads123 (ID: 1)
✓ Проект: My Project (ID: 1)

✅ Найден валидный project invite code:
   Code: ABC123XYZ9
   Действителен еще 25 дней

==================================================
📋 PROJECT INVITE CODE: ABC123XYZ9
==================================================
```

## Использование кода:

Этот код можно использовать для:
- Регистрации новых пользователей через `/api/auth/register-with-invite`
- Приглашения пользователей в проект
