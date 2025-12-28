import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ProductDatabaseErrorStateProps {
  error: string
  onRetry: () => void
}

export function ProductDatabaseErrorState({ error, onRetry }: ProductDatabaseErrorStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center text-center p-6 sm:p-8">
      <AlertTriangle className="h-10 w-10 sm:h-12 sm:w-12 mb-4 text-red-500" />
      <h3 className="text-lg font-semibold mb-2">Error loading products</h3>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-xs sm:max-w-md mx-auto break-words">
        {error}
      </p>
      <Button 
        onClick={onRetry} 
        className="w-full sm:w-auto"
      >
        Try Again
      </Button>
    </Card>
  )
}