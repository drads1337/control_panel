import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Palette, Sun, Moon, Monitor, ChevronDown } from 'lucide-react'
import { ColorPicker } from "@/components/shared/color-picker"
import { useTheme } from 'next-themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const getThemeIcon = () => {
    if (!mounted) return <Monitor className="h-4 w-4" />
    if (theme === 'dark') return <Moon className="h-4 w-4" />
    if (theme === 'light') return <Sun className="h-4 w-4" />
    return <Monitor className="h-4 w-4" />
  }

  const getThemeLabel = () => {
    if (!mounted) return 'System'
    if (theme === 'dark') return 'Dark'
    if (theme === 'light') return 'Light'
    return 'System'
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base sm:text-lg">Appearance</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Theme and color settings
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3 sm:space-y-4">
          {}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-medium text-foreground">Theme</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between text-xs sm:text-sm h-9 sm:h-10"
                  disabled={!mounted}
                >
                  <div className="flex items-center gap-2">
                    {getThemeIcon()}
                    <span>{getThemeLabel()}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="h-4 w-4 mr-2" />
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="h-4 w-4 mr-2" />
                  <span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="h-4 w-4 mr-2" />
                  <span>System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {}
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-medium text-foreground">Accent Color</label>
          <ColorPicker />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
