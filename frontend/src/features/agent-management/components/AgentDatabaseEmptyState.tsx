import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Container, Plus } from 'lucide-react'

interface AgentDatabaseEmptyStateProps {
  onCreateAgent: () => void
  canCreateAgents: boolean
}

export function AgentDatabaseEmptyState({ onCreateAgent, canCreateAgents }: AgentDatabaseEmptyStateProps) {
  return (
    <Card className="border-dashed border-2 border-muted-foreground/25">
      <CardContent className="p-6 sm:p-12">
        <div className="text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Container className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
          </div>
          <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">No Agents Yet</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 max-w-xs sm:max-w-md mx-auto leading-relaxed">
            Get started by creating your first agent. You can manage settings, upload files, and track usage.
          </p>
          {canCreateAgents && (
            <Button 
              onClick={onCreateAgent}
              className="gap-2 w-full sm:w-auto"
              size="lg"
            >
              <Plus className="h-5 w-5" />
              Create Your First Agent
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

