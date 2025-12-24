import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface UseMutationWithInvalidationOptions<TData, TVariables, TContext = unknown> {
  mutationFn: (variables: TVariables) => Promise<TData>
  invalidateQueries?: readonly unknown[] | ((data: TData, variables: TVariables) => readonly unknown[])
  successMessage?: string | ((data: TData, variables: TVariables) => string)
  errorMessage?: string | ((error: unknown) => string)
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void | Promise<void>
  onError?: (error: unknown, variables: TVariables, context: TContext | undefined) => void | Promise<void>
  showToast?: boolean
}

export function useMutationWithInvalidation<TData, TVariables, TContext = unknown>(
  options: UseMutationWithInvalidationOptions<TData, TVariables, TContext>
) {
  const queryClient = useQueryClient()
  const {
    mutationFn,
    invalidateQueries,
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    showToast = true,
  } = options

  return useMutation<TData, unknown, TVariables, TContext>({
    mutationFn,
    onSuccess: async (data, variables, context) => {

      if (invalidateQueries) {
        const queryKeys = typeof invalidateQueries === 'function'
          ? invalidateQueries(data, variables)
          : invalidateQueries

        queryClient.invalidateQueries({ queryKey: queryKeys })
      }

      if (showToast && successMessage) {
        const message = typeof successMessage === 'function'
          ? successMessage(data, variables)
          : successMessage
        toast.success(message)
      }

      if (onSuccess) {
        await onSuccess(data, variables, context as TContext)
      }
    },
    onError: async (error, variables, context) => {

      if (showToast) {
        const message = errorMessage
          ? (typeof errorMessage === 'function' ? errorMessage(error) : errorMessage)
          : (error instanceof Error ? error.message : 'An error occurred')
        toast.error(message)
      }

      if (onError) {
        await onError(error, variables, context)
      }
    },
  })
}
