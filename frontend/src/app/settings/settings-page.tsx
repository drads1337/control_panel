import React from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { useSettingsQuery } from '@/entities/settings'
import { useToast } from '@/hooks/use-toast'
import type { Project } from '@/entities/project'
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { canAccessFeature } from '@/lib/rbac-utils'
import { AxiosError } from 'axios'
import { LoadingState } from '@/app/dashboard/loading-state'
import { ErrorState } from '@/app/dashboard/error-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Copy, Clock, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CryptographicKeys from './cryptographic-keys'
import AppearanceSettings from './appearance-settings'
import CurrentProjectInfo from './current-project-info'
import ProjectsList from './projects-list'
import OfflineAuthSettings from './offline-auth-settings'

export default function SettingsPage() {
  const { user } = useAuthContext()
  const { toast } = useToast()
  const {
    settings,
    isLoading,
    isSaving,
    error
  } = useSettingsQuery()

  const [projects, setProjects] = React.useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = React.useState(false)
  const [currentProject, setCurrentProject] = React.useState<Project | null>(null)
  const [loadingCurrentProject, setLoadingCurrentProject] = React.useState(false)

  const loadProjects = async () => {
    try {
      setLoadingProjects(true)
      const response = await api.get('/api/projects')
      setProjects(response.data.projects || [])
    } catch (error) {

      toast.error('Failed to load projects')
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadCurrentProject = async () => {
    if (!user?.project_id) return
    
    try {
      setLoadingCurrentProject(true)
      const response = await api.get(`/api/projects/${user.project_id}`)
      // Handle cached response format: {data: {...}, cache_type: ..., cached_at: ..., ttl: ...}
      const projectData = response.data?.data || response.data
      setCurrentProject(projectData)
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status !== 403) {
        toast.error('Failed to load current project')
      }
    } finally {
      setLoadingCurrentProject(false)
    }
  }

  React.useEffect(() => {
    if (user?.roles?.includes('owner')) {
      loadProjects()
    }
    loadCurrentProject()
  }, [user])

  if (isLoading) {
    return <LoadingState message="Loading settings..." />
  }

  if (error) {
    return (
      <ErrorState 
        error={error} 
        onRetry={() => window.location.reload()} 
      />
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Settings not available</h3>
          <p className="text-muted-foreground">Unable to load settings. Please try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const calculateDaysUntilExpiry = (): number | null => {
    if (!currentProject) return null

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

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${type} copied`)
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-1">Settings</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage product settings and configuration
        </p>
      </div>

      {}
      {user?.project_id && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base sm:text-lg">Project Information</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Current project details and subscription status
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 sm:space-y-4">
            {loadingCurrentProject ? (
              <div className="text-xs sm:text-sm text-muted-foreground">Loading project information...</div>
            ) : (
              <div className="space-y-2">
                {(currentProject?.unique_id || currentProject?.id) && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Unique ID</span>
                      <code className="text-xs sm:text-sm font-mono font-medium truncate">
                        {currentProject.unique_id || currentProject.id}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        currentProject.unique_id || String(currentProject.id), 
                        'Unique ID'
                      )}
                      className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {daysUntilExpiry !== null && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">Time Remaining</span>
                    </div>
                    <Badge 
                      variant={
                        daysUntilExpiry <= 0 ? 'destructive' :
                        daysUntilExpiry <= 7 ? 'secondary' :
                        'default'
                      }
                      className="text-xs"
                    >
                      {daysUntilExpiry <= 0 
                        ? 'Expired' 
                        : `${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'} left`
                      }
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4 sm:space-y-6">
        {}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          <div className="md:col-span-2 lg:col-span-3">
            <CryptographicKeys settings={settings} isSaving={isSaving} />
          </div>
          <div className="md:col-span-2 lg:col-span-2 space-y-4 sm:space-y-6">
            <AppearanceSettings />
            {canAccessFeature(user, 'project_settings') && (
              <CurrentProjectInfo currentProject={currentProject} />
            )}
          </div>
        </div>

        {}
        <OfflineAuthSettings />

        {}
        {user?.roles?.includes('owner') && (
          <ProjectsList projects={projects} loadingProjects={loadingProjects} />
        )}
      </div>
    </div>
  )
}