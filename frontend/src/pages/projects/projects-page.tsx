import { useAuthContext } from '@/app/providers/auth-provider'
import { useProjectsQuery } from '@/entities/project'
import { CreateProjectDialog } from "@/features/project-settings/create-project-dialog"
import { ProjectCard } from "@/features/project-settings/project-card"
import { ProjectManagementDialog } from "@/features/project-settings/project-management-dialog"
import { Pagination } from "@/components/shared/pagination"
import { ProjectInviteCodeManager } from "@/features/project-settings/project-invite-code-manager"
import { ProjectsNavigation } from "@/features/project-settings/projects-navigation"
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

  const clearError = () => {

    refetch()
  }

  useEffect(() => {

  }, [user])

  useEffect(() => {

  }, [projects, isLoading, error, pagination])

  useEffect(() => {

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

    }
  }, [handleUpdateProject])

  const handleUpdateProjectWrapper = useCallback(async (projectId: number, data: any) => {
    try {
      await handleUpdateProject(projectId, data)
      setIsManagementDialogOpen(false)
      setSelectedProject(null)
    } catch (error) {

      throw error
    }
  }, [handleUpdateProject])

  const handleDeleteProjectWrapper = useCallback(async (projectId: number) => {
    try {
      await handleDeleteProject(projectId)
      setIsManagementDialogOpen(false)
      setSelectedProject(null)
    } catch (error) {

      throw error
    }
  }, [handleDeleteProject])

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {}
      {error && (
        <>
          {}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start sm:items-center gap-2">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-400 mt-0.5 sm:mt-0 shrink-0" />
              <span className="text-sm sm:text-base text-red-800 flex-1 break-words">{error}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearError}
                className="ml-auto text-red-600 hover:text-red-800 shrink-0 h-6 w-6 sm:h-8 sm:w-8 p-0"
              >
                ✕
              </Button>
            </div>
          </div>
        </>
      )}

      {}
      <ProjectsNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {}
      {activeTab === 'projects' ? (
        <>

          {}
          {isLoading && (
            <>
              {}
              <div className="flex flex-col sm:flex-row items-center justify-center py-8 sm:py-12 gap-2 sm:gap-3">
                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                <span className="text-sm sm:text-base text-muted-foreground">Loading projects...</span>
              </div>
            </>
          )}

          {}
          {!isLoading && projects.length > 0 && (
            <>
              {}
              <div 
                className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {projects.map((project) => {

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

              <div className="mt-4 sm:mt-6">
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.pages}
                  onPageChange={handlePageChange}
                />
              </div>
            </>
          )}

          {}
          {!isLoading && projects.length === 0 && !error && (
            <>
              {}
              <div className="text-center py-8 sm:py-12 px-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Search className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                </div>
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">No projects found</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 px-2">
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

        <ProjectInviteCodeManager />
      )}

      {}
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