import { useState, useCallback, useEffect } from 'react'

export interface UseControlledStateOptions<T> {
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
}

/**
 * Hook for managing controlled/uncontrolled component state
 * Similar to React's built-in controlled component pattern
 */
export function useControlledState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
}: UseControlledStateOptions<T>): [T, (newValue: T) => void] {
  const [internalValue, setInternalValue] = useState<T | undefined>(defaultValue)
  
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const setValue = useCallback(
    (newValue: T) => {
      if (!isControlled) {
        setInternalValue(newValue)
      }
      onChange?.(newValue)
    },
    [isControlled, onChange]
  )

  // Sync internal value when defaultValue changes (uncontrolled mode only)
  useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue, isControlled])

  return [value as T, setValue]
}


