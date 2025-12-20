import { useState, useEffect } from 'react'
import { useAuthContext } from '@/app/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { generateInviteCode, getInviteCodes, getLatestInviteCode, updateInviteCodeDuration, deleteUnusedInviteCodes } from '@/entities/user'
import { formatDate as formatDateUtil } from '@/lib/utils/date-utils'
import { Copy, Plus, Clock, Loader2, Trash2, RefreshCw, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { isOwner } from '@/lib/rbac'
import type { InviteCode, CreateInviteCodeData, User } from '@/entities/user';
import type { Project } from '@/entities/project';

interface InviteCodeManagerProps {
  projectId?: number
}

export function InviteCodeManager({ projectId }: InviteCodeManagerProps) {
  const { token, user } = useAuthContext()
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [latestCode, setLatestCode] = useState<InviteCode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [showOnlyUnused, setShowOnlyUnused] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'seller' | 'developer' | 'moderator'>('seller')

  const fetchInviteCodes = async () => {
    if (!token) return

    setIsLoading(true)
    try {
      const codes = await getInviteCodes()
      setInviteCodes(codes)
    } catch (error) {

      if (error instanceof Error) {
        toast.error(`Error loading invite codes: ${error.message}`)
      } else {
        toast.error('Error loading invite codes')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchLatestCode = async () => {
    if (!token) return

    try {
      const response = await getLatestInviteCode()
      setLatestCode(response.invite_code)
    } catch (error) {

    }
  }

  const handleGenerateCode = async () => {
    if (!token) {

      toast.error('Authentication token not found')
      return
    }

    setIsGenerating(true)
    try {
      const data: CreateInviteCodeData = {
        expires_in_days: expiresInDays,
        project_id: projectId,
        product_ids: []
      }

      const result = await generateInviteCode(data)

      toast.success(`Invite code for role "${selectedRole}" created successfully.`)
      setShowGenerateDialog(false)
      await fetchInviteCodes()
      await fetchLatestCode()
    } catch (error) {

      if (error instanceof Error) {
        toast.error(`Error creating invite code: ${error.message}`)
      } else {
        toast.error('Failed to create invite code.')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUpdateDuration = async () => {
    if (!token) return

    setIsUpdating(true)
    try {
      await updateInviteCodeDuration(expiresInDays)
      toast.success('Code duration updated.')
      await fetchInviteCodes()
      await fetchLatestCode()
    } catch (error) {
      toast.error('Failed to update code duration.')

    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteUnusedCodes = async () => {
    if (!token) return

    setIsDeleting(true)
    try {

      const unusedCodes = inviteCodes.filter(code => !(code.used || code.is_used))

      if (unusedCodes.length === 0) {
        toast.info('No unused codes to delete.')
        return
      }

      const result = await deleteUnusedInviteCodes()

      const remainingCodes = inviteCodes.filter(code => code.used || code.is_used)

      setInviteCodes(remainingCodes)

      toast.success(result.msg || `Deleted ${result.deleted_count || 0} codes`)
    } catch (error) {

      if (error instanceof Error) {
        toast.error(`Error deleting: ${error.message}`)
      } else {
        toast.error('Failed to delete unused codes.')
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

  // Using centralized date formatting utility
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return formatDateUtil(dateString, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusBadge = (code: InviteCode) => {
    if (code.used || code.is_used) {
      return <Badge variant="secondary">Used</Badge>
    }

    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>
    }

    return <Badge variant="default">Active</Badge>
  }

  const getUnusedCodesCount = () => {
    return inviteCodes.filter(code => !(code.used || code.is_used)).length
  }

  const getFilteredCodes = () => {
    if (showOnlyUnused) {
      return inviteCodes.filter(code => !(code.used || code.is_used))
    }
    return inviteCodes
  }

  useEffect(() => {
    if (token && isOwner(user)) {
      fetchInviteCodes()
      fetchLatestCode()
    }
  }, [token, user])

  if (!isOwner(user)) {
    return null
  }

  return (
    <div className="space-y-4 px-2 sm:px-0">
      <Card>
        <CardHeader className="pb-2 p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Invite Codes (for inviting users)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
          {latestCode && (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={latestCode.code}
                className="font-sans text-xs sm:text-sm flex-1 min-w-0"
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
          )}
          <div className="flex gap-2 flex-wrap">
            <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-3 w-3" />
                  New Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Invite Code for Inviting Users</DialogTitle>
                  <DialogDescription>
                    Generate a new invite code to allow users to join this project with a specific role.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label htmlFor="selectedRole">User Role</Label>
                    <Select value={selectedRole} onValueChange={(value: 'seller' | 'developer' | 'moderator') => setSelectedRole(value)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seller">Seller</SelectItem>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateDuration}
              disabled={isUpdating || !latestCode}
            >
              {isUpdating ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Clock className="mr-2 h-3 w-3" />
              )}
              Update
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInviteCodes}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3 w-3" />
              )}
              Refresh List
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteUnusedCodes}
              disabled={isDeleting || getUnusedCodesCount() === 0}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-3 w-3" />
              )}
              Delete Unused ({getUnusedCodesCount()})
            </Button>
            <Button
              variant={showOnlyUnused ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyUnused(!showOnlyUnused)}
            >
              <Filter className="mr-2 h-3 w-3" />
              {showOnlyUnused ? 'Show All' : 'Only Unused'}
            </Button>
          </div>

          {}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : inviteCodes.length > 0 ? (
            <div className="pt-3 border-t">
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                {showOnlyUnused ? 'Unused Codes' : 'All Codes'} ({getFilteredCodes().length}) - Unused: {getUnusedCodesCount()}
              </div>
              <div className="space-y-1">
                {getFilteredCodes().map((code, index) => (
                  <div key={`${code.code}-${index}`}>
                    <div className="flex items-center justify-between gap-2 py-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                        <span className="font-sans text-xs truncate">{code.code}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {getStatusBadge(code)}
                          {code.role && (
                            <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                              {code.role}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {code.created_at && formatDate(code.created_at)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(code.code)}
                        className="shrink-0 h-7 w-7 sm:h-8 sm:w-8"
                      >
                        <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                    {index < inviteCodes.length - 1 && (
                      <div className="border-t border-gray-100 my-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm sm:text-base">
              {showOnlyUnused ? 'No unused invite codes' : 'No invite codes'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}