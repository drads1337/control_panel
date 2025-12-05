# Пример интеграции валидации API

Этот документ показывает, как интегрировать валидацию API ответов в существующие функции.

## Пример: getProducts

### До валидации:
```ts
export async function getProducts(type: string = 'all'): Promise<ProductsResponse> {
  const response = await api.get(API_ENDPOINTS.PRODUCTS, { params: { type } });
  return response.data; // Нет валидации!
}
```

### После валидации (рекомендуемый подход):
```ts
import { validateApiResponse } from '@/shared/api/api-response-validator';
import { productsResponseSchema } from '../model/schemas';

export async function getProducts(type: string = 'all'): Promise<ProductsResponse> {
  try {
    const params: any = { type, _t: Date.now().toString() };
    const response = await api.get(API_ENDPOINTS.PRODUCTS, { params });
    
    // Валидируем ответ API
    return validateApiResponse(response.data, productsResponseSchema, {
      endpointName: `GET ${API_ENDPOINTS.PRODUCTS}`,
      strict: true,
      logErrors: import.meta.env.DEV,
    });
  } catch (err: unknown) {
    // Существующая обработка ошибок остается
    const status = getErrorStatus(err);
    if (status === 402) {
      const error = new Error(`PAYMENT REQUIRED`);
      (error as { status?: number; data?: unknown }).status = 402;
      if (isAxiosError(err)) {
        (error as { status?: number; data?: unknown }).data = err.response?.data;
      }
      throw error;
    }
    if (status === 429) {
      const error = new Error(`TOO MANY REQUESTS`);
      (error as { status?: number }).status = 429;
      throw error;
    }
    throw new Error(getErrorMessage(err));
  }
}
```

## Постепенная миграция

Валидацию можно добавлять постепенно:

1. **Критичные API** - начать с важных endpoints (users, products)
2. **Новые API** - все новые функции должны использовать валидацию
3. **По запросу** - добавлять валидацию при обнаружении проблем

## Нестрогий режим для постепенной миграции

Для плавной миграции можно использовать нестрогий режим:

```ts
return validateApiResponse(response.data, productsResponseSchema, {
  endpointName: `GET ${API_ENDPOINTS.PRODUCTS}`,
  strict: false, // Не выбрасывает ошибку, логирует warning
  logErrors: true,
}) || response.data; // Fallback на исходные данные
```
