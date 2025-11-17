import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Server, Copy, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { Project } from '@/entities/project'

interface CurrentProjectInfoProps {
  currentProject: Project | null
}

export default function CurrentProjectInfo({ currentProject }: CurrentProjectInfoProps) {
  const { toast } = useToast()

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${type} copied`)
  }

  if (!currentProject) {
    return null
  }

  // Calculate days until expiry
  const calculateDaysUntilExpiry = (): number | null => {
    // First try to use server-provided value if available
    if (typeof currentProject.days_until_expiry === 'number') {
      return currentProject.days_until_expiry
    }
    
    // If not available, calculate from subscription_expires_at
    if (currentProject.subscription_expires_at) {
      try {
        const expiresAt = new Date(currentProject.subscription_expires_at)
        if (isNaN(expiresAt.getTime())) {
          return null
        }
        const now = new Date()
        const diffTime = expiresAt.getTime() - now.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
      } catch (e) {
        return null
      }
    }
    
    return null
  }

  const daysUntilExpiry = calculateDaysUntilExpiry()

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <CardTitle>Current Project</CardTitle>
        </div>
        <CardDescription>
          Project information and subscription status
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Project IDs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Unique ID</span>
              <code className="text-sm font-mono font-medium">{currentProject.unique_id}</code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(currentProject.unique_id, 'Unique ID')}
              className="h-7 w-7 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Project ID</span>
              <code className="text-sm font-mono font-medium">{currentProject.id}</code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(String(currentProject.id), 'Project ID')}
              className="h-7 w-7 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Subscription & Status */}
        <div className="pt-2 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subscription</span>
            <Badge 
              variant={
                currentProject.subscription_status_display === 'trial' ? 'secondary' :
                currentProject.subscription_status_display === 'active' ? 'default' :
                'destructive'
              }
            >
              {currentProject.subscription_status_display.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <div className="flex items-center gap-2">
              {daysUntilExpiry !== null && (
                <span className="text-sm font-medium">
                  {daysUntilExpiry >= 0 ? `${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'}` : 'Expired'}
                </span>
              )}
              <Badge 
                variant={currentProject.is_active ? 'default' : 'destructive'}
                className={currentProject.is_active ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {currentProject.status === 'active' ? 'Active' : 
                 currentProject.status === 'inactive' ? 'Inactive' :
                 'Expired'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Expiration Warning */}
        {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
          <div className="pt-2 border-t border-border/50">
            <div className="p-2.5 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/50">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-orange-700 dark:text-orange-300">
                    {daysUntilExpiry <= 0 
                      ? 'Subscription Expired' 
                      : `Expires in ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'}`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
