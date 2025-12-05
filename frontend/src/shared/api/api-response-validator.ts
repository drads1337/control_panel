import { z } from 'zod';
import { getErrorMessage } from './enhanced-client';

export interface ValidationOptions {
  /**
   * Если true, выбрасывает ошибку при невалидных данных
   * Если false, возвращает null при ошибке валидации
   */
  strict?: boolean;
  
  /**
   * Имя API endpoint для более понятных сообщений об ошибках
   */
  endpointName?: string;
  
  /**
   * Логировать ли ошибки валидации (по умолчанию только в development)
   */
  logErrors?: boolean;
}

/**
 * Валидирует ответ API с помощью Zod схемы
 * 
 * @param data - Данные для валидации (обычно response.data)
 * @param schema - Zod схема для валидации
 * @param options - Опции валидации
 * @returns Валидированные данные или выбрасывает ошибку
 * 
 * @throws {Error} Если strict=true и данные невалидны
 */
export function validateApiResponse<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
): T {
  const {
    strict = true,
    endpointName = 'API endpoint',
    logErrors = import.meta.env.DEV,
  } = options;

  try {
    const result = schema.safeParse(data);

    if (result.success) {
      return result.data;
    }

    // Логируем ошибки валидации
    if (logErrors) {
      console.error(`[API Validation Error] ${endpointName}:`, {
        errors: result.error.errors,
        data: data,
      });
    }

    if (strict) {
      const errorMessages = result.error.errors
        .map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        })
        .join('; ');

      throw new Error(
        `Invalid API response from ${endpointName}: ${errorMessages}`
      );
    }

    // В нестрогом режиме возвращаем null
    return null as T;
  } catch (error) {
    // Если это уже наша ошибка - пробрасываем дальше
    if (error instanceof Error && error.message.includes('Invalid API response')) {
      throw error;
    }

    // Обрабатываем неожиданные ошибки
    const message = getErrorMessage(error);
    
    if (strict) {
      throw new Error(`Failed to validate API response from ${endpointName}: ${message}`);
    }

    if (logErrors) {
      console.error(`[API Validation Error] ${endpointName}:`, error);
    }

    return null as T;
  }
}

/**
 * Создает обертку для API функций с автоматической валидацией
 * 
 * @example
 * ```ts
 * export const getUsers = withApiValidation(
 *   async () => {
 *     const response = await api.get('/api/users');
 *     return response.data;
 *   },
 *   usersResponseSchema,
 *   { endpointName: 'GET /api/users' }
 * );
 * ```
 */
export function withApiValidation<TData, TArgs extends any[]>(
  apiFunction: (...args: TArgs) => Promise<unknown>,
  schema: z.ZodSchema<TData>,
  options: ValidationOptions = {}
): (...args: TArgs) => Promise<TData> {
  return async (...args: TArgs): Promise<TData> => {
    const data = await apiFunction(...args);
    return validateApiResponse(data, schema, options);
  };
}

/**
 * Валидация ответа с обработкой ошибок и возвратом fallback значения
 * 
 * @param data - Данные для валидации
 * @param schema - Zod схема
 * @param fallback - Значение по умолчанию при ошибке валидации
 * @param options - Опции валидации
 * @returns Валидированные данные или fallback
 */
export function validateApiResponseOrFallback<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  fallback: T,
  options: ValidationOptions = {}
): T {
  try {
    return validateApiResponse(data, schema, { ...options, strict: true });
  } catch (error) {
    if (options.logErrors !== false && import.meta.env.DEV) {
      console.warn('[API Validation] Using fallback value:', error);
    }
    return fallback;
  }
}
