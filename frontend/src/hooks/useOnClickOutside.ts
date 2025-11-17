import { useEffect, useRef } from 'react';

/**
 * Hook that handles click outside of the passed ref
 * @param ref - The ref to detect clicks outside of
 * @param handler - The callback function to call when clicking outside
 */
export const useOnClickOutside = (ref: React.RefObject<HTMLElement>, handler: (event: Event) => void) => {
  useEffect(() => {
    const listener = (event: Event) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};
