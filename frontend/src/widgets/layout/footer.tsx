import React from 'react'

export function AppFooter() {
  const currentYear = new Date().getFullYear()
  return (
    // АДАПТАЦИЯ: p-4 для мобильных, p-[26px] для планшетов/ПК
    <footer className="flex shrink-0 items-center border-t border-border dark:border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 sm:p-[26px]">
      <div className="flex w-full flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          {/* text-center для мобильных, чтобы длинный текст смотрелся ровно */}
          <span className="text-center sm:text-left">© {currentYear} SaaS Manager. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs">Version 1.0.0</span>
        </div>
      </div>
    </footer>
  )
}
