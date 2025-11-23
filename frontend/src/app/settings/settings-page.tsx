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
    try {

      if (user?.project_id && canAccessFeature(user, 'project_settings')) {
        const response = await api.get(`/api/projects/${user.project_id}`)
        setCurrentProject(response.data)
      }
    } catch (error) {

      if (error instanceof AxiosError && error.response?.status !== 403) {
        toast.error('Failed to load current project')
      }
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

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {}
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-1">Settings</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage product settings and configuration
        </p>
      </div>

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