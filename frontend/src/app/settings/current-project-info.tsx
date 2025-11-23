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

  const calculateDaysUntilExpiry = (): number | null => {

    if (typeof currentProject.days_until_expiry === 'number') {
      return currentProject.days_until_expiry
    }

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
          <CardTitle className="text-base sm:text-lg">Current Project</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Project information and subscription status
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-3 sm:space-y-4">
        {}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Unique ID</span>
              <code className="text-xs sm:text-sm font-mono font-medium truncate">{currentProject.unique_id}</code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(currentProject.unique_id, 'Unique ID')}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Project ID</span>
              <code className="text-xs sm:text-sm font-mono font-medium">{currentProject.id}</code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(String(currentProject.id), 'Project ID')}
              className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {}
        <div className="pt-2 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">Subscription</span>
            <Badge 
              variant={
                currentProject.subscription_status_display === 'trial' ? 'secondary' :
                currentProject.subscription_status_display === 'active' ? 'default' :
                'destructive'
              }
              className="text-xs"
            >
              {currentProject.subscription_status_display.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">Status</span>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              {daysUntilExpiry !== null && (
                <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
                  {daysUntilExpiry >= 0 ? `${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'}` : 'Expired'}
                </span>
              )}
              <Badge 
                variant={currentProject.is_active ? 'default' : 'destructive'}
                className={`text-xs ${currentProject.is_active ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                {currentProject.status === 'active' ? 'Active' : 
                 currentProject.status === 'inactive' ? 'Inactive' :
                 'Expired'}
              </Badge>
            </div>
          </div>
        </div>

        {}
        {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
          <div className="pt-2 border-t border-border/50">
            <div className="p-2 sm:p-2.5 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/50">
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
