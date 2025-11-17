import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Calendar, Pause, Play, Trash2, Save } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Project } from '@/entities/project';

// --- PROPS INTERFACE ---

interface ProjectManagementDialogProps {
  project: Project | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (projectId: number, data: any) => Promise<void>
  onDelete: (projectId: number) => Promise<void>
  isLoading?: boolean
}

// --- HELPER FUNCTIONS ---

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'inactive':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'expired':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
  }
}

// --- SUB-COMPONENTS ---

const StatusSelect = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="active">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          Active
        </div>
      </SelectItem>
      <SelectItem value="inactive">
        <div className="flex items-center gap-2">
          <Pause className="h-4 w-4" />
          Inactive
        </div>
      </SelectItem>
      <SelectItem value="expired">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Expired
        </div>
      </SelectItem>
    </SelectContent>
  </Select>
)

const ProjectInfo = ({ project }: { project: Project }) => (
  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
    <h4 className="font-medium">Current Information</h4>
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-muted-foreground">Subscription Status:</span>
        <Badge className={cn("ml-2", getStatusColor(project.subscription_status_display))}>
          {project.subscription_status_display}
        </Badge>
      </div>
      <div>
        <span className="text-muted-foreground">Days until expiry:</span>
        <span className="ml-2 font-medium">
          {project.days_until_expiry || 'N/A'}
        </span>
      </div>
      <div>
        <span className="text-muted-foreground">Users:</span>
        <span className="ml-2 font-medium">{project.stats.users}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Keys:</span>
        <span className="ml-2 font-medium">{project.stats.keys}</span>
      </div>
    </div>
  </div>
)

const DeleteConfirmation = ({ 
  project, 
  isSubmitting, 
  onCancel, 
  onConfirm 
}: { 
  project: Project
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
}) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
      <div>
        <h4 className="font-medium text-red-900 dark:text-red-100">
          Confirm Deletion
        </h4>
        <p className="text-sm text-red-700 dark:text-red-300">
          Are you sure you want to delete the project "{project.name}"? This action cannot be undone.
          All project data will be permanently deleted.
        </p>
      </div>
    </div>

    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={onConfirm}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Deleting...
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Project
          </>
        )}
      </Button>
    </DialogFooter>
  </div>
)

interface FormData {
  name: string
  description: string
  status: string
  subscription_days: number
  storage_limit_gb: number
}

const ProjectForm = ({ 
  project, 
  formData, 
  setFormData, 
  isSubmitting, 
  onSubmit, 
  onDelete, 
  onClose 
}: {
  project: Project
  formData: FormData
  setFormData: (data: FormData | ((prev: FormData) => FormData)) => void
  isSubmitting: boolean
  onSubmit: (e: React.FormEvent) => void
  onDelete: () => void
  onClose: () => void
}) => (
  <form onSubmit={onSubmit} className="space-y-6">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter project name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <StatusSelect
          value={formData.status}
          onChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        placeholder="Enter project description"
        rows={3}
      />
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="subscription_days">Extend for (days)</Label>
        <Input
          id="subscription_days"
          type="number"
          min="1"
          value={formData.subscription_days}
          onChange={(e) => setFormData(prev => ({ ...prev, subscription_days: parseInt(e.target.value) || 30 }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="storage_limit_gb">Storage Limit (GB)</Label>
        <Input
          id="storage_limit_gb"
          type="number"
          min="1"
          value={formData.storage_limit_gb}
          onChange={(e) => setFormData(prev => ({ ...prev, storage_limit_gb: parseInt(e.target.value) || 3 }))}
        />
      </div>
    </div>

    <ProjectInfo project={project} />

    <DialogFooter className="flex justify-between">
      <Button
        type="button"
        variant="destructive"
        onClick={onDelete}
        disabled={isSubmitting}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Project
      </Button>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>
    </DialogFooter>
  </form>
)

// --- MAIN COMPONENT ---

export function ProjectManagementDialog({
  project,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  isLoading = false
}: ProjectManagementDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    status: 'active',
    subscription_days: 30,
    storage_limit_gb: 3
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Update form data when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        status: project.status,
        subscription_days: project.days_until_expiry || 30,
        storage_limit_gb: project.storage_limit_gb
      })
    }
  }, [project])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return

    setIsSubmitting(true)
    try {
      await onUpdate(project.id, formData)
      toast.success('Project updated successfully')
      onClose()
    } catch (error) {
      console.error('Failed to update project:', error)
      toast.error('Failed to update project')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!project) return

    setIsSubmitting(true)
    try {
      await onDelete(project.id)
      toast.success('Project deleted successfully')
      onClose()
    } catch (error) {
      console.error('Failed to delete project:', error)
      toast.error('Failed to delete project')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!project) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Manage Project
          </DialogTitle>
          <DialogDescription>
            Modify project settings or perform administrative actions.
          </DialogDescription>
        </DialogHeader>

        {!showDeleteConfirm ? (
          <ProjectForm
            project={project}
            formData={formData}
            setFormData={setFormData}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onDelete={() => setShowDeleteConfirm(true)}
            onClose={onClose}
          />
        ) : (
          <DeleteConfirmation
            project={project}
            isSubmitting={isSubmitting}
            onCancel={() => setShowDeleteConfirm(false)}
            onConfirm={handleDelete}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}