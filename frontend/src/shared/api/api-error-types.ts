import { AxiosError } from 'axios'
import type { ApiErrorResponse } from './error-schemas'

/**
 * Типизированная версия AxiosError с правильным типом response.data
 */
export interface TypedAxiosError<T = ApiErrorResponse> extends AxiosError<T> {
  response: AxiosError<T>['response'] & {
    data: T
  }
}

/**
 * Проверяет, является ли ошибка типизированным AxiosError
 */
export function isTypedAxiosError<T = ApiErrorResponse>(
  error: unknown
): error is TypedAxiosError<T> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true &&
    (error as AxiosError).response !== undefined &&
    (error as AxiosError).response?.data !== undefined
  )
}

/**
 * Извлекает статус код из ошибки
 */
export function getErrorStatus(error: unknown): number | undefined {
  if (isTypedAxiosError(error)) {
    return error.response?.status
  }
  return undefined
}

/**
 * Извлекает данные ошибки из ответа
 */
export function getErrorData<T = ApiErrorResponse>(error: unknown): T | undefined {
  if (isTypedAxiosError<T>(error)) {
    return error.response?.data
  }
  return undefined
}

/**
 * Извлекает сообщение об ошибке
 */
export function getErrorMessage(error: unknown): string {
  const errorData = getErrorData(error)
  if (errorData && typeof errorData === 'object') {
    if ('message' in errorData && typeof errorData.message === 'string') {
      return errorData.message
    }
    if ('msg' in errorData && typeof errorData.msg === 'string') {
      return errorData.msg
    }
    if ('error' in errorData && typeof errorData.error === 'string') {
      return errorData.error
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}

