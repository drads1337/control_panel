import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { cn } from '@/lib/utils.ts'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isAnimating, setIsAnimating] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleToggle = () => {
    setIsAnimating(true)
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
    
    // Reset animation state after animation completes
    setTimeout(() => {
      setIsAnimating(false)
    }, 600)
  }

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled
        className={cn("h-8 w-8 p-0", className)}
        aria-label="Loading theme toggle"
      >
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleToggle}
      className={cn(
        "h-8 w-8 p-0 text-muted-foreground hover:text-foreground relative overflow-hidden",
        "transition-all duration-300 ease-in-out",
        isAnimating && "scale-90",
        className
      )}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {/* Sun Icon */}
      <Sun
        className={cn(
          "h-4 w-4 absolute inset-0 m-auto transition-all duration-500 ease-in-out",
          isDark
            ? "opacity-0 rotate-90 scale-0"
            : "opacity-100 rotate-0 scale-100"
        )}
      />
      
      {/* Moon Icon */}
      <Moon
        className={cn(
          "h-4 w-4 absolute inset-0 m-auto transition-all duration-500 ease-in-out",
          isDark
            ? "opacity-100 rotate-0 scale-100"
            : "opacity-0 -rotate-90 scale-0"
        )}
      />
    </Button>
  )
}

