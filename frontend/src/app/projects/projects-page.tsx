import { useAuthContext } from '@/contexts/auth-context'
import { useProjectsQuery } from '@/hooks/use-projects-query'
import { CreateProjectDialog } from '@/app/projects/create-project-dialog'
import { ProjectCard } from '@/app/projects/project-card'
import { ProjectManagementDialog } from '@/app/projects/project-management-dialog'
import { Pagination } from '@/app/shared/pagination'
import { ProjectInviteCodeManager } from '@/app/projects/project-invite-code-manager'
import { ProjectsNavigation } from '@/app/projects/projects-navigation'
import { Button } from '@/components/ui/button'
import { Search, AlertCircle, Loader2 } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'
import type { Project } from '@/entities/project'

export default function Projects() {
  const { user } = useAuthContext()
  const {
    projects,
    loading: isLoading,
    error,
    pagination,
    setPage: handlePageChange,
    createProject: handleCreateProject,
    updateProject: handleUpdateProject,
    deleteProject: handleDeleteProject,
    refetch
  } = useProjectsQuery()
  
  // Wrapper for clearError (react-query handles errors internally)
  const clearError = () => {
    // React Query handles errors internally, but we can refetch to clear stale errors
    refetch()
  }
  
  // Component state logging
  useEffect(() => {
    console.log('[COMPONENT] Projects component mounted')
    console.log('[COMPONENT] User:', user ? { 
      id: user.id, 
      username: user.username, 
      roles: user.roles,
      project_id: user.project_id 
    } : 'null')
  }, [user])
  
  useEffect(() => {
    console.log('[COMPONENT] Projects state changed:', {
      projectsCount: projects.length,
      projects: projects.map(p => ({ id: p.id, name: p.name })),
      isLoading,
      error,
      pagination
    })
  }, [projects, isLoading, error, pagination])
  
  useEffect(() => {
    console.log('[COMPONENT] Render conditions:', {
      isLoading,
      hasProjects: projects.length > 0,
      hasError: !!error,
      showEmptyState: !isLoading && projects.length === 0 && !error,
      showProjectsGrid: !isLoading && projects.length > 0
    })
  }, [isLoading, projects.length, error])
  
  const [isCreating, setIsCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'projects' | 'project-codes'>('projects')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isManagementDialogOpen, setIsManagementDialogOpen] = useState(false)


  const handleCreateProjectWrapper = useCallback(async (data: any) => {
    setIsCreating(true)
    try {
      await handleCreateProject(data)
    } finally {
      setIsCreating(false)
    }
  }, [handleCreateProject])

  const handleProjectClick = useCallback((projectId: number) => {
    // You can add navigation to the project detail page here
    console.log('Project clicked:', projectId)
  }, [])

  const handleManageProject = useCallback((project: Project) => {
    setSelectedProject(project)
    setIsManagementDialogOpen(true)
  }, [])

  const handleQuickAction = useCallback(async (project: Project, action: 'activate' | 'deactivate' | 'extend') => {
    try {
      switch (action) {
        case 'activate':
          await handleUpdateProject(project.id, { status: 'active' })
          break
        case 'deactivate':
          await handleUpdateProject(project.id, { status: 'inactive' })
          break
        case 'extend':
          await handleUpdateProject(project.id, { subscription_days: 30 })
          break
      }
    } catch (error) {
      console.error('Failed to perform quick action:', error)
    }
  }, [handleUpdateProject])

  const handleUpdateProjectWrapper = useCallback(async (projectId: number, data: any) => {
    try {
      await handleUpdateProject(projectId, data)
      setIsManagementDialogOpen(false)
      setSelectedProject(null)
    } catch (error) {
      console.error('Failed to update project:', error)
      throw error
    }
  }, [handleUpdateProject])

  const handleDeleteProjectWrapper = useCallback(async (projectId: number) => {
    try {
      await handleDeleteProject(projectId)
      setIsManagementDialogOpen(false)
      setSelectedProject(null)
    } catch (error) {
      console.error('Failed to delete project:', error)
      throw error
    }
  }, [handleDeleteProject])

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <>
          {console.error('[COMPONENT] Rendering error alert:', error)}
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <span className="text-red-800">{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearError}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                ✕
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Navigation and Tabs */}
      <ProjectsNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Content based on active tab */}
      {activeTab === 'projects' ? (
        <>

          {/* Loading State */}
          {isLoading && (
            <>
              {console.log('[COMPONENT] Rendering loading state')}
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
                <span className="text-muted-foreground">Loading projects...</span>
              </div>
            </>
          )}

          {/* Projects Grid */}
          {!isLoading && projects.length > 0 && (
            <>
              {console.log('[COMPONENT] Rendering projects grid with', projects.length, 'projects')}
              <div 
                className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {projects.map((project) => {
                  console.log('[COMPONENT] Rendering project card:', project.id, project.name)
                  return (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => handleProjectClick(project.id)}
                      onManage={handleManageProject}
                      onQuickAction={handleQuickAction}
                    />
                  )
                })}
              </div>
              
              {/* Pagination */}
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.pages}
                onPageChange={handlePageChange}
              />
            </>
          )}

          {/* Empty State */}
          {!isLoading && projects.length === 0 && !error && (
            <>
              {console.warn('[COMPONENT] Rendering empty state - no projects found!', {
                isLoading,
                projectsLength: projects.length,
                error,
                pagination
              })}
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No projects found</h3>
                <p className="text-muted-foreground mb-4">
                  You don't have any projects yet. Create your first project to get started.
                </p>
                <CreateProjectDialog 
                  onCreateProject={handleCreateProjectWrapper}
                  isLoading={isCreating}
                />
              </div>
            </>
          )}
        </>
      ) : (
        /* Project Codes Tab */
        <ProjectInviteCodeManager />
      )}

      {/* Project Management Dialog */}
      <ProjectManagementDialog
        project={selectedProject}
        isOpen={isManagementDialogOpen}
        onClose={() => {
          setIsManagementDialogOpen(false)
          setSelectedProject(null)
        }}
        onUpdate={handleUpdateProjectWrapper}
        onDelete={handleDeleteProjectWrapper}
        isLoading={isCreating}
      />
    </div>
  )
}