import { useState, useEffect } from "react"
import { ColorFormat } from "@/lib/colors"
type Config = {
  format: ColorFormat
  lastCopied: string
}
export function useColors() {
  const [colors, setColors] = useState<Config>({
    format: "hsl",
    lastCopied: "",
  })
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return {
    isLoading: !mounted,
    format: colors.format,
    lastCopied: colors.lastCopied,
    setFormat: (format: ColorFormat) => setColors({ ...colors, format }),
    setLastCopied: (lastCopied: string) => setColors({ ...colors, lastCopied }),
  }
} 