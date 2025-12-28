import { useEffect, useState } from "react"

/**
 * Hook to detect if the user is on a Mac
 * @returns true if the platform is Mac
 */
export function useIsMac() {
  const [isMac, setIsMac] = useState(true)
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"))
  }, [])
  return isMac
}

