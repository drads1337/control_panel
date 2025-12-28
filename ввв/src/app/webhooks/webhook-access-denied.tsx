import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Webhook } from 'lucide-react'

interface WebhookAccessDeniedProps {
  message: string
}

export function WebhookAccessDenied({ message }: WebhookAccessDeniedProps) {
  return (
    // АДАПТАЦИЯ: p-4 для мобильных, p-6 для планшетов+
    <div className="container mx-auto p-4 sm:p-6">
      <Card className="@container/card">
        {/* АДАПТАЦИЯ: p-4 внутри карточки на мобильных */}
        <CardContent className="p-4 sm:p-6">
          <div className="text-center">
            {/* АДАПТАЦИЯ: уменьшение иконки и отступа на мобильных */}
            <Webhook className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
            
            {/* АДАПТАЦИЯ: размер текста для мобильных */}
            <h2 className="text-lg sm:text-xl font-semibold mb-2">Access Denied</h2>
            
            {/* АДАПТАЦИЯ: размер шрифта описания */}
            <p className="text-sm sm:text-base text-muted-foreground">{message}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


