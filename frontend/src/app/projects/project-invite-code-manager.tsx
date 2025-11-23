import { useState, useEffect, useCallback } from 'react'
import { useAuthContext } from '@/contexts/auth-context'
import { isOwner } from '@/lib/rbac-utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { generateProjectInviteCode, getProjectInviteCodes, getLatestProjectInviteCode, deleteUnusedProjectInviteCodes } from '@/entities/user'
import { Copy, Plus, Loader2, Trash2, RefreshCw, Filter, FolderPlus } from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectInviteCode, CreateProjectInviteCodeData } from '@/entities/user';
import type { Project } from '@/entities/project';

export function ProjectInviteCodeManager() {
  const { token, user } = useAuthContext()
  const [inviteCodes, setInviteCodes] = useState<ProjectInviteCode[]>([])
  const [latestCode, setLatestCode] = useState<ProjectInviteCode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [showOnlyUnused, setShowOnlyUnused] = useState(false)

  const fetchInviteCodes = useCallback(async () => {
    setIsLoading(true)
    try {
      const codes = await getProjectInviteCodes()
      setInviteCodes(codes)
    } catch (error) {

      if (error instanceof Error) {

        if (!error.message.includes('must be assigned to a project')) {
          toast.error(`Error loading project creation codes: ${error.message}`)
        }
      } else {
        toast.error('Error loading project creation codes')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchLatestCode = useCallback(async () => {
    try {
      const response = await getLatestProjectInviteCode()
      setLatestCode(response.invite_code)
    } catch (error) {

      if (error instanceof Error && !error.message.includes('must be assigned to a project')) {

      }
    }
  }, [])

  const handleGenerateCode = async () => {
    setIsGenerating(true)
    try {

      const data: CreateProjectInviteCodeData = {
        expires_in_days: expiresInDays
      }

      const result = await generateProjectInviteCode(data)

      toast.success('Project creation code generated successfully!')
      setShowGenerateDialog(false)
      await fetchInviteCodes()
      await fetchLatestCode()
    } catch (error) {

      if (error instanceof Error) {
        toast.error(`Error creating project code: ${error.message}`)
      } else {
        toast.error('Failed to create project creation code.')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteUnusedCodes = async () => {
    setIsDeleting(true)
    try {

      const unusedCodes = inviteCodes.filter(code => !code.used)

      if (unusedCodes.length === 0) {
        toast.info('No unused project creation codes to delete.')
        return
      }

      const result = await deleteUnusedProjectInviteCodes()

      const remainingCodes = inviteCodes.filter(code => code.used)

      setInviteCodes(remainingCodes)

      toast.success(result.message || `Deleted ${result.deleted_count || 0} project creation codes`)
    } catch (error) {

      if (error instanceof Error) {
        toast.error(`Error deleting: ${error.message}`)
      } else {
        toast.error('Failed to delete unused project creation codes.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Code copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy code.')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusBadge = (code: ProjectInviteCode) => {
    if (code.used) {
      return <Badge variant="secondary">Used</Badge>
    }

    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>
    }

    return <Badge variant="default">Active</Badge>
  }

  const getUnusedCodesCount = () => {
    return inviteCodes.filter(code => !code.used).length
  }

  const getFilteredCodes = () => {
    if (showOnlyUnused) {
      return inviteCodes.filter(code => !code.used)
    }
    return inviteCodes
  }

  useEffect(() => {
    if (isOwner(user)) {
      fetchInviteCodes()
      fetchLatestCode()
    }
  }, [user, fetchInviteCodes, fetchLatestCode])

  if (!isOwner(user)) {
    return null
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Project Creation Codes</h2>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage codes that allow users to create new projects</p>
        </div>
      </div>

      {latestCode && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <FolderPlus className="h-4 w-4 sm:h-5 sm:w-5" />
              Latest Project Creation Code
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={latestCode.code}
                className="font-mono text-xs sm:text-sm flex-1 min-w-0"
                placeholder="Project creation code"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(latestCode.code)}
                aria-label="Copy invite code to clipboard"
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 text-xs sm:text-sm text-gray-600 flex flex-col sm:flex-row gap-1 sm:gap-4">
              <span>Created: {formatDate(latestCode.created_at)}</span>
              {latestCode.expires_at && (
                <span>
                  Expires: {formatDate(latestCode.expires_at)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="flex flex-wrap gap-2">
            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Project Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Project Creation Code</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label htmlFor="expiresInDays">Expiration Days</Label>
                    <Input
                      id="expiresInDays"
                      type="number"
                      min="1"
                      max="365"
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      className="mt-2"
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    This code will allow users to create new projects in the system.
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleGenerateCode} disabled={isGenerating}>
                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Code
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteUnusedCodes}
              disabled={isDeleting || getUnusedCodesCount() === 0}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Unused ({getUnusedCodesCount()})
            </Button>

            <Button
              variant={showOnlyUnused ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyUnused(!showOnlyUnused)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {showOnlyUnused ? 'Show All' : 'Only Unused'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchInviteCodes}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh List
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">
            {showOnlyUnused ? 'Unused Project Codes' : 'All Project Codes'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {isLoading ? (
            <div className="flex flex-col sm:flex-row items-center justify-center py-8 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm sm:text-base text-muted-foreground">Loading codes...</span>
            </div>
          ) : getFilteredCodes().length > 0 ? (
            <div className="space-y-3">
              {getFilteredCodes().map((code, index) => (
                <div key={`${code.code}-${index}`} className="flex items-center justify-between gap-2 p-3 border rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="font-mono text-xs sm:text-sm font-medium truncate">{code.code}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {getStatusBadge(code)}
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 hidden sm:inline-flex">
                        Project Creation
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {code.created_at && formatDate(code.created_at)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(code.code)}
                    className="shrink-0 h-8 w-8"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground px-4">
              <FolderPlus className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-base sm:text-lg font-medium mb-2">
                {showOnlyUnused ? 'No unused project creation codes' : 'No project creation codes'}
              </p>
              <p className="text-xs sm:text-sm">
                {showOnlyUnused 
                  ? 'All codes have been used or there are no codes yet.'
                  : 'Create your first project creation code to get started.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}