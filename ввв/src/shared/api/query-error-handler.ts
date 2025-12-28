import { QueryClient } from '@tanstack/react-query';
import { getErrorMessage } from './enhanced-client';
import { handleQueryError, handleMutationError } from '@/lib/error-handler';

function shouldHandleError(queryKey: unknown, error: any): boolean {
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return false;
  }

  const keyString = Array.isArray(queryKey) ? queryKey.join('/') : String(queryKey);

  const ignoredKeys = [
    'sessions/realtime', 
    'api/metrics',
    'navigation/config',
  ];
  
  if (ignoredKeys.some(ignored => keyString.includes(ignored))) {
    return false;
  }

  return true;
}

export function setupQueryErrorHandler(queryClient: QueryClient): void {
  const queryCache = queryClient.getQueryCache();
  const mutationCache = queryClient.getMutationCache();

  queryCache.subscribe((event) => {
    if (event?.type === 'updated') {
      const query = event?.query;
      const error = query?.state?.error;

      if (error && query?.state?.status === 'error') {
        const queryKey = query?.queryKey;
        
        if (!shouldHandleError(queryKey, error)) {
          return;
        }

        handleQueryError(error, {
          queryKey: queryKey,
          queryHash: query?.queryHash || '',
          state: { error },
        });
      }
    }
  });

  mutationCache.subscribe((event) => {
    if (event?.type === 'updated') {
      const mutation = event?.mutation;
      const error = mutation?.state?.error;

      if (error && mutation?.state?.status === 'error') {
        const options = (mutation?.options as any) || {};
  
        if (options?.onError) {
          return;
        }

        handleMutationError(error, {
          mutationKey: options?.mutationKey || undefined,
          options,
          state: { error },
        });
      }
    }
  });
}