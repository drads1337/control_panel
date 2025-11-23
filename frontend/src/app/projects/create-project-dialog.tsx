import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Loader2 } from 'lucide-react'
import type { CreateProjectData, Project } from '@/entities/project';
interface CreateProjectDialogProps {
  onCreateProject: (data: CreateProjectData) => Promise<void>
  isLoading?: boolean
}
export function CreateProjectDialog({
  onCreateProject,
  isLoading,
}: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState<CreateProjectData>({
    name: '',
    description: '',
    status: 'active',
    subscription_days: 7,
    storage_limit_gb: 3,
  })
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onCreateProject(formData)
      setFormData({
        name: '',
        description: '',
        status: 'active',
        subscription_days: 7,
        storage_limit_gb: 3,
      })
      setOpen(false)
    } catch (error) {
    }
  }
  const handleInputChange = (
    field: keyof CreateProjectData,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Create a New Project</DialogTitle>
          <DialogDescription className="text-sm">
            Fill in the details for your new project. Click 'Create Project' when
            you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                placeholder="My Awesome Project"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange('description', e.target.value)
                }
                rows={3}
                placeholder="A short description of the project."
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm">
                Status
              </Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="subscription_days" className="text-sm sm:text-right">
                Subscription
              </Label>
              <Input
                id="subscription_days"
                type="number"
                value={formData.subscription_days}
                onChange={(e) =>
                  handleInputChange(
                    'subscription_days',
                    parseInt(e.target.value) || 7
                  )
                }
                className="col-span-1 sm:col-span-3 text-sm"
                min="1"
                required
                placeholder="e.g., 30"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-4">
              <Label htmlFor="storage_limit_gb" className="text-sm sm:text-right">
                Storage (GB)
              </Label>
              <Input
                id="storage_limit_gb"
                type="number"
                value={formData.storage_limit_gb}
                onChange={(e) =>
                  handleInputChange(
                    'storage_limit_gb',
                    parseFloat(e.target.value) || 3
                  )
                }
                className="col-span-1 sm:col-span-3 text-sm"
                min="0.1"
                step="0.1"
                required
                placeholder="e.g., 5"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
              {isLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isLoading ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}