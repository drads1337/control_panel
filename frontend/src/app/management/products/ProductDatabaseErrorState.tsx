import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ProductDatabaseErrorStateProps {
  error: string
  onRetry: () => void
}

export function ProductDatabaseErrorState({ error, onRetry }: ProductDatabaseErrorStateProps) {
  return (
    <Card className="text-center p-8">
      <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
      <h3 className="text-lg font-semibold mb-2">Error loading products</h3>
      <p className="text-muted-foreground mb-4">{error}</p>
      <Button onClick={onRetry}>Try Again</Button>
    </Card>
  )
}
