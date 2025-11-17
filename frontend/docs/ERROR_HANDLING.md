# Централизованная система обработки ошибок

## Обзор

Реализована единая система обработки ошибок, которая обеспечивает:
- **Консистентную обработку ошибок** через единый API
- **Интеграцию с Sentry** для мониторинга ошибок в production
- **Автоматические toast-уведомления** для пользователей
- **Категоризацию ошибок** для правильной обработки

## Архитектура

### 1. Централизованный Error Handler (`lib/error-handler.ts`)

Основной модуль для обработки всех ошибок в приложении:

```typescript
import { handleError } from '@/lib/error-handler'

// Базовое использование
await handleError(error, {
  category: 'network',
  userMessage: 'Custom error message',
  skipToast: false,
  skipSentry: false,
  metadata: { customField: 'value' }
})
```

**Категории ошибок:**
- `network` - проблемы с сетью
- `authentication` - ошибки аутентификации (401)
- `authorization` - ошибки авторизации (403)
- `validation` - ошибки валидации (400, 422)
- `rate_limit` - превышение лимита запросов (429)
- `server` - серверные ошибки (500+)
- `client` - клиентские ошибки (400-499)
- `unknown` - неизвестные ошибки

### 2. React Query Integration

Глобальные обработчики ошибок для React Query автоматически обрабатывают все ошибки queries и mutations:

```typescript
// В query-provider.tsx
defaultOptions: {
  queries: {
    onError: (error, query) => {
      handleQueryError(error, query)
    }
  },
  mutations: {
    onError: (error, _variables, _context, mutation) => {
      handleMutationError(error, mutation)
    }
  }
}
```

**Особенности:**
- Автоматическая обработка всех ошибок React Query
- Интеграция с Sentry для отслеживания
- Toast-уведомления для пользователей
- Специальная обработка ошибок аутентификации (401/403) - автоматический logout

### 3. Error Boundary

Компонент `ErrorBoundary` перехватывает все необработанные ошибки React:

```tsx
import { ErrorBoundary } from '@/components/error-boundary'

<ErrorBoundary showDetails={import.meta.env.DEV}>
  <YourComponent />
</ErrorBoundary>
```

**Функции:**
- Перехват всех ошибок рендеринга React
- Автоматическая отправка в Sentry
- Пользовательский UI для отображения ошибок
- Опции для восстановления (Try Again, Reload, Go Home)

### 4. Sentry Integration

Sentry инициализируется при старте приложения (`main.tsx`):

```typescript
import { initSentry } from './lib/sentry-config'

initSentry().catch((error) => {
  console.warn('Failed to initialize Sentry:', error)
})
```

**Конфигурация:**
- Автоматическая отправка ошибок в production
- Фильтрация известных несущественных ошибок
- Контекст пользователя и окружения
- Performance monitoring

## Использование

### Обработка ошибок в компонентах

**Рекомендуемый подход:**
```typescript
import { handleError } from '@/lib/error-handler'

try {
  await someAsyncOperation()
} catch (error) {
  await handleError(error, {
    category: 'validation',
    userMessage: 'Failed to save data',
    metadata: { operation: 'save' }
  })
}
```

**Для React Query mutations:**
```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    return await api.post('/endpoint', data)
  },
  // Ошибки автоматически обрабатываются через глобальный onError
  // Но можно добавить дополнительную обработку:
  onError: (error) => {
    // Дополнительная логика, если нужна
    console.log('Mutation failed:', error)
  }
})
```

### Пропуск автоматической обработки

Если нужно обработать ошибку вручную:

```typescript
await handleError(error, {
  skipToast: true,  // Не показывать toast
  skipSentry: true, // Не отправлять в Sentry
})
```

### Кастомные сообщения

```typescript
await handleError(error, {
  userMessage: 'Custom user-friendly message',
  category: 'validation'
})
```

## Миграция существующего кода

### Замена toast.error

**Было:**
```typescript
try {
  await operation()
} catch (error) {
  toast.error(getErrorMessage(error))
  console.error(error)
}
```

**Стало:**
```typescript
try {
  await operation()
} catch (error) {
  await handleError(error)
  // Toast и Sentry автоматически
}
```

### Замена console.error

**Было:**
```typescript
catch (error) {
  console.error('Error:', error)
}
```

**Стало:**
```typescript
catch (error) {
  await handleError(error, {
    skipToast: true, // Если не нужно показывать toast
  })
}
```

## Преимущества

1. **Консистентность**: Все ошибки обрабатываются одинаково
2. **Мониторинг**: Автоматическая отправка в Sentry
3. **UX**: Единообразные сообщения для пользователей
4. **Поддерживаемость**: Легко изменить поведение обработки ошибок в одном месте
5. **Типизация**: Полная поддержка TypeScript

## Конфигурация

### Переменные окружения

```env
VITE_SENTRY_DSN=your-sentry-dsn-here
VITE_APP_VERSION=1.0.0
```

### Настройка Sentry

Конфигурация находится в `lib/sentry-config.ts`. Можно настроить:
- Sample rates для ошибок и трассировки
- Фильтры ошибок
- Контекст окружения

## Best Practices

1. **Используйте централизованный handler**: Всегда используйте `handleError` вместо прямых вызовов `toast.error` или `console.error`

2. **Указывайте категорию**: Это помогает правильно обработать ошибку:
   ```typescript
   await handleError(error, { category: 'validation' })
   ```

3. **Добавляйте метаданные**: Для лучшего отслеживания в Sentry:
   ```typescript
   await handleError(error, {
     metadata: { userId, operation, timestamp }
   })
   ```

4. **Не дублируйте обработку**: React Query ошибки обрабатываются автоматически, не нужно обрабатывать их вручную

5. **Используйте Error Boundary**: Оберните критические секции приложения в Error Boundary

## Troubleshooting

### Ошибки не отправляются в Sentry

- Проверьте, что `VITE_SENTRY_DSN` установлен
- Убедитесь, что приложение в production режиме
- Проверьте консоль браузера на ошибки инициализации Sentry

### Дублирующиеся toast-уведомления

- Убедитесь, что не обрабатываете ошибки React Query вручную
- Используйте `skipToast: true` если обрабатываете ошибку вручную

### Ошибки не обрабатываются

- Проверьте, что используете `await handleError()` (асинхронная функция)
- Убедитесь, что ошибка не перехватывается раньше другим обработчиком

