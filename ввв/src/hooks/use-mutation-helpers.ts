import { useMutation, useQueryClient, UseMutationOptions, QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

export interface CreateMutationOptions<TData, TVariables, TError = Error> {

  mutationFn: (variables: TVariables) => Promise<TData>

  invalidateQueries?: QueryKey[]

  successMessage?: string
  errorMessage?: string | ((error: TError) => string)

  mutationOptions?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn' | 'onSuccess' | 'onError'>

  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>

  onError?: (error: TError, variables: TVariables) => void | Promise<void>
}

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

      if (invalidateQueries.length > 0) {
        await Promise.all(
          invalidateQueries.map(queryKey =>
            queryClient.invalidateQueries({ queryKey })
          )
        )
      }

      if (successMessage) {
        toast.success(successMessage)
      }

      if (customOnSuccess) {
        await customOnSuccess(data, variables)
      }
    },
    onError: async (error, variables) => {

      let errorMsg = errorMessage
      if (typeof errorMessage === 'function') {
        errorMsg = errorMessage(error)
      } else if (!errorMsg) {
        errorMsg = 'An error occurred'
      }

      const apiMessage = (error as any)?.response?.data?.message || (error as any)?.message
      const finalMessage = apiMessage || errorMsg

      toast.error(finalMessage)

      if (customOnError) {
        await customOnError(error, variables)
      }
    },
    ...mutationOptions,
  })
}
