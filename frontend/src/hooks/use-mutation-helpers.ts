import { useMutation, useQueryClient, UseMutationOptions, QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * Опции для создания мутации с автоматической инвалидацией кэша
 */
export interface CreateMutationOptions<TData, TVariables, TError = Error> {
  /** Функция мутации */
  mutationFn: (variables: TVariables) => Promise<TData>
  
  /** Query keys для инвалидации после успешной мутации */
  invalidateQueries?: QueryKey[]
  
  /** Сообщения об успехе и ошибке */
  successMessage?: string
  errorMessage?: string | ((error: TError) => string)
  
  /** Дополнительные опции react-query мутации */
  mutationOptions?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn' | 'onSuccess' | 'onError'>
  
  /** Callback после успешной мутации */
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>
  
  /** Callback после ошибки */
  onError?: (error: TError, variables: TVariables) => void | Promise<void>
}

/**
 * Создаёт мутацию с автоматической инвалидацией кэша и toast уведомлениями
 * 
 * @example
 * ```ts
 * const createProject = useMutationWithCache({
 *   mutationFn: (data: CreateProjectData) => createProject(data),
 *   invalidateQueries: [projectKeys.lists()],
 *   successMessage: 'Project created successfully',
 *   errorMessage: 'Failed to create project',
 * })
 * ```
 */
export function useMutationWithCache<TData, TVariables, TError = Error>(
  options: CreateMutationOptions<TData, TVariables, TError>
) {
  const queryClient = useQueryClient()
  
  const {
    mutationFn,
    invalidateQueries = [],
    successMessage,
    errorMessage,
    mutationOptions = {},
    onSuccess: customOnSuccess,
    onError: customOnError,
  } = options

  return useMutation<TData, TError, TVariables>({
    mutationFn,
    onSuccess: async (data, variables) => {
      // Инвалидация кэша
      if (invalidateQueries.length > 0) {
        await Promise.all(
          invalidateQueries.map(queryKey =>
            queryClient.invalidateQueries({ queryKey })
          )
        )
      }
      
      // Toast уведомление
      if (successMessage) {
        toast.success(successMessage)
      }
      
      // Пользовательский callback
      if (customOnSuccess) {
        await customOnSuccess(data, variables)
      }
    },
    onError: async (error, variables) => {
      // Получение сообщения об ошибке
      let errorMsg = errorMessage
      if (typeof errorMessage === 'function') {
        errorMsg = errorMessage(error)
      } else if (!errorMsg) {
        errorMsg = 'An error occurred'
      }
      
      // Извлечение сообщения из ошибки API
      const apiMessage = (error as any)?.response?.data?.message || (error as any)?.message
      const finalMessage = apiMessage || errorMsg
      
      // Toast уведомление
      toast.error(finalMessage)
      
      // Пользовательский callback
      if (customOnError) {
        await customOnError(error, variables)
      }
    },
    ...mutationOptions,
  })
}


