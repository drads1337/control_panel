import { useLayoutEffect } from 'react'
import { useCustomColor } from '@/hooks/use-custom-color'

export function ColorInitializer() {
  const { customColor } = useCustomColor()

  useLayoutEffect(() => {
    const root = document.documentElement

    root.style.setProperty('--primary', customColor.primary)
    root.style.setProperty('--ring', customColor.primary)
    root.style.setProperty('--sidebar-primary', customColor.primary)
    root.style.setProperty('--sidebar-ring', customColor.primary)
    root.style.setProperty('--chart-1', customColor.primary)
    root.style.setProperty('--chart-2', customColor.primaryHover)
    root.style.setProperty('--chart-3', customColor.primaryLight)
    root.style.setProperty('--chart-4', customColor.primary)
    root.style.setProperty('--chart-5', customColor.primaryHover)
  }, [customColor])

  return null
}
