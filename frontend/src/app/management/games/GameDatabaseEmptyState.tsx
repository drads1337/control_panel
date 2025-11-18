import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package, Plus } from 'lucide-react'

interface GameDatabaseEmptyStateProps {
  onCreateGame: () => void
  canCreateGames: boolean
}

export function GameDatabaseEmptyState({ onCreateGame, canCreateGames }: GameDatabaseEmptyStateProps) {
  return (
    <Card className="border-dashed border-2 border-muted-foreground/25">
      <CardContent className="p-12">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold mb-3">No Applications Yet</h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
            Get started by creating your first application. You can manage settings, upload files, and track usage.
          </p>
          {canCreateGames && (
            <Button 
              onClick={onCreateGame}
              className="gap-2"
              size="lg"
            >
              <Plus className="h-5 w-5" />
              Create Your First Application
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
