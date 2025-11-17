import { useLayoutEffect } from 'react'
import { useCustomColor } from '@/hooks/use-custom-color'

/**
 * Компонент для инициализации кастомных цветов при загрузке приложения
 * Гарантирует, что цвета применяются сразу, а не только при переходе в settings
 * 
 * Использует CSS-переменные напрямую на document.documentElement вместо
 * инъекции style тегов в document.head, что является более чистым подходом
 */
export function ColorInitializer() {
  const { customColor } = useCustomColor()

  // Применяем цвета синхронно до первого рендера, чтобы избежать мерцания
  // useLayoutEffect выполняется синхронно после всех DOM мутаций, но до отрисовки
  useLayoutEffect(() => {
    const root = document.documentElement
    
    // Устанавливаем CSS-переменные напрямую на root элемент
    // Это более чистый подход, чем инъекция style тегов в document.head
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
