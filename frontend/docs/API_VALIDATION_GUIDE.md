# Руководство по валидации API ответов

## Обзор

Добавлена система валидации ответов API с помощью Zod для защиты фронтенда от неожиданных изменений структуры API.

## Преимущества

- ✅ **Runtime валидация** - проверка данных на этапе выполнения
- ✅ **Type safety** - защита от изменений API контракта
- ✅ **Раннее обнаружение ошибок** - проблемы выявляются сразу
- ✅ **Документирование** - схемы служат документацией API

## Использование

### Базовое использование

```ts
import { validateApiResponse } from '@/shared/api/api-response-validator';
import { productsResponseSchema } from '@/entities/product/model/schemas';

export async function getProducts(type: string = 'all') {
  const response = await api.get(API_ENDPOINTS.PRODUCTS, { params: { type } });
  
  // Валидируем ответ API
  return validateApiResponse(response.data, productsResponseSchema, {
    endpointName: 'GET /api/products',
    strict: true, // Выбрасывать ошибку при невалидных данных
  });
}
```

### С обработкой ошибок

```ts
import { validateApiResponseOrFallback } from '@/shared/api/api-response-validator';

export async function getProducts(type: string = 'all') {
  const response = await api.get(API_ENDPOINTS.PRODUCTS, { params: { type } });
  
  // Используем fallback значение при ошибке валидации
  return validateApiResponseOrFallback(
    response.data,
    productsResponseSchema,
    { success: false, products: [], total_count: 0, filter_type: type }, // fallback
    { endpointName: 'GET /api/products' }
  );
}
```

### С автоматической валидацией (обертка)

```ts
import { withApiValidation } from '@/shared/api/api-response-validator';
import { productsResponseSchema } from '@/entities/product/model/schemas';

export const getProducts = withApiValidation(
  async (type: string = 'all') => {
    const response = await api.get(API_ENDPOINTS.PRODUCTS, { params: { type } });
    return response.data;
  },
  productsResponseSchema,
  { endpointName: 'GET /api/products' }
);
```

## Создание схем

### Пример схемы для сущности

```ts
import { z } from 'zod';

export const productSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
});

export const productsResponseSchema = z.object({
  success: z.boolean(),
  products: z.array(productSchema),
  total_count: z.number().int().nonnegative(),
});
```

### Паттерны валидации

- **Обязательные поля**: `z.string()` - обязательное
- **Опциональные поля**: `z.string().optional()` - может отсутствовать
- **Nullable поля**: `z.string().nullable()` - может быть null
- **Числа**: `z.number().int().positive()` - положительное целое
- **Массивы**: `z.array(itemSchema)` - массив элементов
- **Enum**: `z.enum(['value1', 'value2'])` - одно из значений

## Миграция существующих API функций

### До валидации:
```ts
export async function getProducts(type: string = 'all') {
  const response = await api.get(API_ENDPOINTS.PRODUCTS, { params: { type } });
  return response.data; // Нет валидации!
}
```

### После валидации:
```ts
import { validateApiResponse } from '@/shared/api/api-response-validator';
import { productsResponseSchema } from '../model/schemas';

export async function getProducts(type: string = 'all') {
  const response = await api.get(API_ENDPOINTS.PRODUCTS, { params: { type } });
  
  return validateApiResponse(response.data, productsResponseSchema, {
    endpointName: 'GET /api/products',
  });
}
```

## Рекомендации

1. **Начните с критичных API** - валидируйте ответы для важных endpoints
2. **Используйте strict режим в production** - для раннего обнаружения проблем
3. **Логируйте ошибки в development** - для отладки
4. **Создавайте схемы постепенно** - не нужно валидировать все сразу

## Дальнейшие шаги

- ✅ Создана утилита валидации `api-response-validator.ts`
- ✅ Примеры схем для Product и User
- ⏳ Интеграция валидации в существующие API функции (постепенно)
- ⏳ Создание схем для других сущностей (Key, Agent, etc.)
