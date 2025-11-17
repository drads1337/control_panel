import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { BlockFormFields } from './components/BlockFormFields'
import { useBlockForm } from './hooks/useBlockForm'

/**
 * Base block form data with all required and optional fields
 * The dynamic field (e.g., ip_address, user_id) is added via intersection
 */
export type BlockFormDataBase = {
  reason: string
  expires_at?: string
  block_type: string
  category: string
  severity: string
  threat_score: number
}

/**
 * BlockFormData with a dynamic field specified by the field name
 * This provides type safety while allowing flexibility for different field types
 */
export type BlockFormData<T extends string = string> = BlockFormDataBase & {
  [K in T]?: string | number
}

export interface AddBlockDialogConfig {
  // Field configuration
  fieldName: string
  fieldLabel: string
  fieldPlaceholder: string
  
  // UI configuration
  title: string
  description: string
  buttonText: string
  submitButtonText: string
  icon: LucideIcon
  iconColor?: string
  
  // Dialog configuration
  dialogMaxWidth?: string
  fieldLayout?: 'single' | 'grid' // How to layout the main field
  
  // Options
  blockTypeOptions?: Array<{ value: string; label: string }>
  categoryOptions?: Array<{ value: string; label: string }>
  
  // Permission
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
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
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

