import { toast } from 'sonner';

export interface HandleErrorOptions {
  category?: 'authentication' | 'client' | 'server' | 'network';
  userMessage?: string;
  metadata?: Record<string, unknown>;
  skipToast?: boolean;
}

/**
 * Handle errors with optional toast notification and authentication redirect
 */
export async function handleError(
  error: unknown,
  options: HandleErrorOptions = {}
): Promise<void> {
  const {
    category = 'client',
    userMessage,
    metadata,
    skipToast = false,
  } = options;

  // Check if this is an authentication error (401)
  const isAuthError =
    category === 'authentication' ||
    (error &&
      typeof error === 'object' &&
      'response' in error &&
      (error as { response?: { status?: number } }).response?.status === 401);

  // Handle authentication errors - redirect to login
  if (isAuthError) {
    // The global error handler in enhanced-client will handle the redirect
    // We just need to ensure the error is properly formatted
    if (!skipToast && userMessage) {
      toast.error(userMessage);
    }
    return;
  }

  // Show error toast if not skipped
  if (!skipToast) {
    const message =
      userMessage ||
      (error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'An error occurred');

    toast.error(message);
  }

  // Log error with metadata for debugging
  if (metadata) {
    console.error('Error with metadata:', {
      error,
      category,
      metadata,
    });
  }
}

