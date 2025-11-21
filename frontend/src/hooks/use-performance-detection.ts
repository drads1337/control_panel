import { useState, useEffect } from 'react'

interface PerformanceInfo {
  isLowEndDevice: boolean
  recommendedSettings: {
    lowPowerMode: boolean
    maxFPS: number
    adaptiveQuality: boolean
    reducedEffects: boolean
  }
}

/**
 * Упрощенный хук для определения производительности устройства.
 * Использует только Navigator API, без создания Canvas/WebGL контекста.
 * Подходит для базовой оптимизации UI компонентов.
 */
export function usePerformanceDetection(): PerformanceInfo {
  const [performanceInfo, setPerformanceInfo] = useState<PerformanceInfo>({
    isLowEndDevice: false,
    recommendedSettings: {
      lowPowerMode: false,
      maxFPS: 60,
      adaptiveQuality: true,
      reducedEffects: false
    }
  })

  useEffect(() => {
    const detectPerformance = () => {
      // Определяем мобильное устройство через User Agent
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      // Определяем количество ядер CPU (fallback на 4 если недоступно)
      const cores = navigator.hardwareConcurrency || 4

      // Определяем количество памяти устройства (fallback на 4 GB если недоступно)
      // deviceMemory доступен только в Chrome/Edge
      const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory || 4

      // Определяем наличие touch-экрана (косвенный признак мобильного устройства)
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      // Определяем низкопроизводительное устройство на основе:
      // - Мобильное устройство
      // - Мало памяти (< 4 GB)
      // - Мало ядер (< 4)
      const isLowEnd = isMobile || 
                      deviceMemory < 4 || 
                      cores < 4 ||
                      hasTouchScreen // Считаем touch-устройства потенциально менее производительными

      setPerformanceInfo({
        isLowEndDevice: isLowEnd,
        recommendedSettings: {
          lowPowerMode: isLowEnd,
          maxFPS: isLowEnd ? 30 : 60,
          adaptiveQuality: true,
          reducedEffects: isLowEnd
        }
      })
    }

    detectPerformance()
  }, [])

  return performanceInfo
}
