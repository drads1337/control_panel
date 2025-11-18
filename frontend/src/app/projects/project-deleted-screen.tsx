import React from 'react'
import { AlertTriangle, Trash2, RefreshCw, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthContext } from '@/contexts/auth-context'
import type { Project } from '@/entities/project';

interface ProjectDeletedScreenProps {
  projectName: string
  onContactSupport?: () => void
}

export function ProjectDeletedScreen({ 
  projectName, 
  onContactSupport 
}: ProjectDeletedScreenProps) {
  const { logout } = useAuthContext()

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport()
    } else {
      window.open('mailto:support@yourcompany.com?subject=Project Recovery Request', '_blank')
    }
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <Trash2 className="h-8 w-8 text-destructive" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Project Deleted</h1>
                <p className="text-muted-foreground">
                  Your project "{projectName}" has been permanently deleted
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Data Deletion Complete
                    </p>
                    <p className="text-sm">
                      All project data including keys, users, games, and settings 
                      have been permanently deleted and cannot be recovered.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <h4 className="font-semibold text-destructive mb-3 text-sm">What was deleted:</h4>
                <ul className="text-xs text-destructive/80 space-y-1">
                  <li>• All license keys have been deleted</li>
                  <li>• All user accounts have been removed</li>
                  <li>• All games and configurations deleted</li>
                  <li>• All project settings removed</li>
                </ul>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-sm">What happened?</h4>
                <p className="text-xs text-muted-foreground">
                  Your project subscription expired and was not renewed within the 
                  14-day grace period. As a result, all project data has been 
                  permanently deleted to comply with our data retention policy.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button 
                    onClick={handleContactSupport}
                    className="flex-1"
                  >
                    Contact Support
                  </Button>
                  <Button 
                    onClick={handleRefresh}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                <Button 
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Выйти
                </Button>
              </div>

              <div className="text-center pt-4">
                <p className="text-xs text-muted-foreground">
                  Need to start fresh? Contact support to discuss creating a new project.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
