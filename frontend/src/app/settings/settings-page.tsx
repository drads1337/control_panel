import React from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { useSettingsQuery } from '@/hooks/use-settings-query'
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

  // State for projects and games
  const [projects, setProjects] = React.useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = React.useState(false)
  const [currentProject, setCurrentProject] = React.useState<Project | null>(null)

  // Functions for loading projects and games
  const loadProjects = async () => {
    try {
      setLoadingProjects(true)
      const response = await api.get('/api/projects')
      setProjects(response.data.projects || [])
    } catch (error) {
      console.error('Failed to load projects:', error)
      toast.error('Failed to load projects')
    } finally {
      setLoadingProjects(false)
    }
  }

  const loadCurrentProject = async () => {
    try {
      // Only load current project for users with project settings permissions
      if (user?.project_id && canAccessFeature(user, 'project_settings')) {
        const response = await api.get(`/api/projects/${user.project_id}`)
        setCurrentProject(response.data)
      }
    } catch (error) {
      console.error('Failed to load current project:', error)
      // Don't show error to user if they don't have permissions
      if (error instanceof AxiosError && error.response?.status !== 403) {
        toast.error('Failed to load current project')
      }
    }
  }

  // Load projects and current project on component mount
  React.useEffect(() => {
    if (user?.roles?.includes('owner')) {
      loadProjects()
    }
    loadCurrentProject()
  }, [user])

  // Show loading indicator if data is not yet loaded
  if (isLoading) {
    return <LoadingState message="Loading settings..." />
  }

  // Show an error if settings failed to load
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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-semibold mb-1">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage application settings and configuration
        </p>
      </div>

      <div className="space-y-6">
        {/* Top Row - Security Keys and Appearance/Current Project */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <CryptographicKeys settings={settings} isSaving={isSaving} />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <AppearanceSettings />
            {canAccessFeature(user, 'project_settings') && (
              <CurrentProjectInfo currentProject={currentProject} />
            )}
          </div>
        </div>

        {/* Offline Authentication Settings */}
        <OfflineAuthSettings />

        {/* Projects IDs Section */}
        {user?.roles?.includes('owner') && (
          <ProjectsList projects={projects} loadingProjects={loadingProjects} />
        )}
      </div>
    </div>
  )
}