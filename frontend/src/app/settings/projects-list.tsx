import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Server, Copy } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/use-toast'
import type { Project } from '@/entities/project'

interface ProjectsListProps {
  projects: Project[]
  loadingProjects: boolean
}

export default function ProjectsList({ projects, loadingProjects }: ProjectsListProps) {
  const { toast } = useToast()

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${type} copied`)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <CardTitle>All Projects</CardTitle>
        </div>
        <CardDescription>
          Manage all projects and their subscriptions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingProjects ? (
          <Spinner message="Loading projects..." />
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Server className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No projects found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div key={project.id} className="p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-base">{project.name}</div>
                    {project.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {project.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="font-mono">
                      {project.unique_id}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(project.unique_id, 'Project ID')}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {}
                <div className="flex items-center flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={project.is_active ? 'default' : 'destructive'} className="text-xs">
                      {project.status === 'active' ? 'Active' : 
                       project.status === 'inactive' ? 'Inactive' :
                       project.status === 'expired' ? 'Expired' :
                       project.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Subscription:</span>
                    <Badge 
                      variant={
                        project.subscription_status_display === 'trial' ? 'secondary' :
                        project.subscription_status_display === 'active' ? 'default' :
                        project.subscription_status_display === 'expired' ? 'destructive' :
                        'outline'
                      }
                      className="text-xs"
                    >
                      {project.subscription_status_display === 'trial' ? 'Trial' :
                       project.subscription_status_display === 'active' ? 'Active' :
                       project.subscription_status_display === 'expired' ? 'Expired' :
                       project.subscription_status_display === 'expiring_soon' ? 'Expiring Soon' :
                       project.subscription_status_display.replace('_', ' ')}
                    </Badge>
                  </div>

                  {project.days_until_expiry !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Expires:</span>
                      <Badge 
                        variant={
                          project.days_until_expiry <= 3 ? 'destructive' :
                          project.days_until_expiry <= 7 ? 'secondary' :
                          'outline'
                        }
                        className="text-xs"
                      >
                        {project.days_until_expiry} {project.days_until_expiry === 1 ? 'day' : 'days'}
                      </Badge>
                    </div>
                  )}
                </div>

                {project.subscription_expires_at && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(project.subscription_expires_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
