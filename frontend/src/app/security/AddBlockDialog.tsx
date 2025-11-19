import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { BlockFormFields } from './components/BlockFormFields'
import { useBlockForm } from './hooks/useBlockForm'

export type BlockFormDataBase = {
  reason: string
  expires_at?: string
  block_type: string
  category: string
  severity: string
  threat_score: number
}

export type BlockFormData<T extends string = string> = BlockFormDataBase & {
  [K in T]?: string | number
}

export interface AddBlockDialogConfig {

  fieldName: string
  fieldLabel: string
  fieldPlaceholder: string

  title: string
  description: string
  buttonText: string
  submitButtonText: string
  icon: LucideIcon
  iconColor?: string

  dialogMaxWidth?: string
  fieldLayout?: 'single' | 'grid'

  blockTypeOptions?: Array<{ value: string; label: string }>
  categoryOptions?: Array<{ value: string; label: string }>

  permission: string
}

interface AddBlockDialogProps {
  config: AddBlockDialogConfig
  onAdd: (data: BlockFormData<string>) => void
  loading?: boolean
}

export default function AddBlockDialog({ config, onAdd, loading = false }: AddBlockDialogProps) {
  const [open, setOpen] = useState(false)
  const {
    formData,
    expiresDate,
    isValid,
    handleInputChange,
    setExpiresDate,
    resetForm,
    getFormDataForSubmit,
  } = useBlockForm(config)

  const Icon = config.icon

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValid) {
      return
    }

    onAdd(getFormDataForSubmit())
    resetForm()
    setOpen(false)
  }

  return (
    <ConditionalRender permission={config.permission} fallback={null}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="default" size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            {config.buttonText}
          </Button>
        </DialogTrigger>
        <DialogContent className={config.dialogMaxWidth || "sm:max-w-[700px]"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={cn("h-5 w-5", config.iconColor || "text-blue-500")} />
              {config.title}
            </DialogTitle>
            <DialogDescription>
              {config.description}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <BlockFormFields
              config={config}
              formData={formData}
              expiresDate={expiresDate}
              onInputChange={handleInputChange}
              onExpiresDateChange={setExpiresDate}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !isValid}>
                {loading ? 'Blocking...' : config.submitButtonText}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConditionalRender>
  )
}
