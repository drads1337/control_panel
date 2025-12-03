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
import { generateProjectInviteCode, getProjectInviteCodes, getLatestProjectInviteCode, deleteUnusedProjectInviteCodes } from '@/entities/user'
import { Copy, Plus, Loader2, Trash2, Filter } from 'lucide-react'
import { toast } from 'sonner'
import type { ProjectInviteCode, CreateProjectInviteCodeData } from '@/entities/user';

export function ProjectInviteCodeManager() {
  const { user } = useAuthContext()
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
      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        toast.success('Code copied!')
        return
      }
      
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      
      try {
        const successful = document.execCommand('copy')
        if (successful) {
          toast.success('Code copied!')
        } else {
          throw new Error('execCommand failed')
        }
      } finally {
        document.body.removeChild(textArea)
      }
    } catch (error) {
      console.error('Copy failed:', error)
      toast.error('Failed to copy. Please select and copy manually.')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Project Creation Codes</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={showOnlyUnused ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyUnused(!showOnlyUnused)}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            {showOnlyUnused ? 'All' : 'Unused'}
          </Button>
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Code</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="expiresInDays">Expiration (days)</Label>
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateCode} disabled={isGenerating}>
                  {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {latestCode && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="text-sm text-muted-foreground">Latest Code</div>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={latestCode.code}
              className="font-sans text-sm cursor-pointer"
              onClick={(e) => {
                (e.target as HTMLInputElement).select()
                copyToClipboard(latestCode.code)
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(latestCode.code)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {latestCode.created_at && <span>{formatDate(latestCode.created_at)}</span>}
            {latestCode.expires_at && <span>Expires {formatDate(latestCode.expires_at)}</span>}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {getFilteredCodes().length} {showOnlyUnused ? 'unused' : ''} code{getFilteredCodes().length !== 1 ? 's' : ''}
          </div>
          {getUnusedCodesCount() > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteUnusedCodes}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Delete Unused
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : getFilteredCodes().length > 0 ? (
          <div className="space-y-1">
            {getFilteredCodes().map((code, index) => (
              <div
                key={`${code.code}-${index}`}
                className="flex items-center justify-between gap-3 p-3 border rounded hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span 
                    className="font-sans text-sm truncate cursor-pointer select-all hover:text-primary"
                    onClick={() => copyToClipboard(code.code)}
                    title="Click to copy"
                  >
                    {code.code}
                  </span>
                  {getStatusBadge(code)}
                  {code.created_at && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {formatDate(code.created_at)}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(code.code)}
                  className="h-8 w-8"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">
              {showOnlyUnused ? 'No unused codes' : 'No codes yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}