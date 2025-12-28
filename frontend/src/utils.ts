/**
 * Copy text to clipboard
 * @param text - The text to copy
 * @returns Promise that resolves when text is copied
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof window === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard API is not available');
  }

  if (!text) {
    throw new Error('Text to copy is empty');
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    throw new Error(`Failed to copy to clipboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

