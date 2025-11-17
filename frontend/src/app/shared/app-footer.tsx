import React from 'react'

export function AppFooter() {
  const currentYear = new Date().getFullYear()
  return (
    <footer className="flex shrink-0 items-center border-t border-border dark:border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-[26px]">
      <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>© {currentYear} SaaS Manager. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs">Version 1.0.0</span>
        </div>
      </div>
    </footer>
  )
}

