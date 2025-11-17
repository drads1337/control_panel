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
      // Check for low-end device indicators
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      
      if (!gl) {
        // No WebGL support - definitely low-end
        setPerformanceInfo({
          isLowEndDevice: true,
          recommendedSettings: {
            lowPowerMode: true,
            maxFPS: 30,
            adaptiveQuality: true,
            reducedEffects: true
          }
        })
        return
      }

      // Get WebGL renderer info
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
      const renderer = debugInfo ? (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown'
      
      // Check for integrated graphics (usually lower performance)
      const isIntegratedGraphics = renderer.toLowerCase().includes('intel') || 
                                  renderer.toLowerCase().includes('amd') ||
                                  renderer.toLowerCase().includes('mali') ||
                                  renderer.toLowerCase().includes('adreno')
      
      // Check device memory (if available)
      const deviceMemory = (navigator as any).deviceMemory || 4 // Default to 4GB if not available
      
      // Check CPU cores
      const cores = navigator.hardwareConcurrency || 4
      
      // Check for mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      // Determine if it's a low-end device
      const isLowEnd = isMobile || 
                      isIntegratedGraphics || 
                      deviceMemory < 4 || 
                      cores < 4 ||
                      renderer.toLowerCase().includes('software')
      
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
