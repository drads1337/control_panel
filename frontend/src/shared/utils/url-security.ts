/**
 * Утилиты для безопасной работы с URL и предотвращения утечки PII
 * 
 * SECURITY: Эти утилиты помогают предотвратить попадание PII в:
 * - Историю браузера
 * - Логи серверов
 * - Referrer headers
 */

/**
 * Очищает URL от чувствительных query параметров после использования
 * 
 * @param sensitiveParams - Массив имен параметров, которые считаются чувствительными (PII)
 * @param replaceState - Использовать replaceState вместо pushState (по умолчанию true)
 * 
 * @example
 * // После загрузки данных с поисковым запросом
 * clearSensitiveParamsFromUrl(['q', 'search', 'username'])
 */
export function clearSensitiveParamsFromUrl(
  sensitiveParams: string[],
  replaceState: boolean = true
): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const url = new URL(window.location.href)
    let hasChanges = false

    // Удаляем чувствительные параметры
    sensitiveParams.forEach(param => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param)
        hasChanges = true
      }
    })

    // Обновляем URL без чувствительных параметров
    if (hasChanges) {
      const newUrl = url.toString()
      if (replaceState) {
        window.history.replaceState({}, '', newUrl)
      } else {
        window.history.pushState({}, '', newUrl)
      }
    }
  } catch (error) {
    // Игнорируем ошибки при работе с URL (например, в тестовом окружении)
    console.warn('[URL Security] Failed to clear sensitive params:', error)
  }
}

/**
 * Проверяет, содержит ли URL чувствительные параметры
 * 
 * @param sensitiveParams - Массив имен параметров, которые считаются чувствительными
 * @returns true если URL содержит хотя бы один чувствительный параметр
 */
export function hasSensitiveParamsInUrl(sensitiveParams: string[]): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const url = new URL(window.location.href)
    return sensitiveParams.some(param => url.searchParams.has(param))
  } catch (error) {
    return false
  }
}

/**
 * Создает безопасный URL без чувствительных параметров
 * 
 * @param url - Исходный URL
 * @param sensitiveParams - Массив имен параметров, которые считаются чувствительными
 * @returns Новый URL без чувствительных параметров
 */
export function createSafeUrl(
  url: string | URL,
  sensitiveParams: string[]
): URL {
  const urlObj = typeof url === 'string' ? new URL(url) : url
  const safeUrl = new URL(urlObj.toString())

  sensitiveParams.forEach(param => {
    safeUrl.searchParams.delete(param)
  })

  return safeUrl
}

/**
 * Стандартный список чувствительных параметров, которые могут содержать PII
 */
export const DEFAULT_SENSITIVE_PARAMS = [
  'username',
  'user_id',
  'userId',
  'email',
  'search',
  'q', // query/search term
  'token',
  'api_key',
  'apikey',
  'password',
  'pass',
  'secret',
] as const

/**
 * Очищает URL от стандартных чувствительных параметров
 * 
 * @param replaceState - Использовать replaceState вместо pushState (по умолчанию true)
 */
export function clearDefaultSensitiveParamsFromUrl(
  replaceState: boolean = true
): void {
  clearSensitiveParamsFromUrl([...DEFAULT_SENSITIVE_PARAMS], replaceState)
}

