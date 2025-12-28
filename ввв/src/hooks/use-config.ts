import { useState, useEffect } from "react"
type Config = {
  style: "new-york" | "default"
  theme: "light" | "dark" | "system"
  layout: "sidebar" | "topbar"
  packageManager: "npm" | "yarn" | "pnpm"
}
export function useConfig() {
  const [config, setConfig] = useState<Config>({
    style: "new-york",
    theme: "system",
    layout: "sidebar",
    packageManager: "pnpm",
  })
  useEffect(() => {
    const savedConfig = localStorage.getItem("config")
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig))
      } catch {
      }
    }
  }, [])
  const updateConfig = (newConfig: Partial<Config>) => {
    const updatedConfig = { ...config, ...newConfig }
    setConfig(updatedConfig)
    localStorage.setItem("config", JSON.stringify(updatedConfig))
  }
  return [config, updateConfig] as const
} 