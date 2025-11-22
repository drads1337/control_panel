import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
            {config.buttonText}
          </Button>
        </DialogTrigger>
        <DialogContent className={config.dialogMaxWidth || "sm:max-w-[700px]"}>
          <DialogHeader>
            <DialogTitle className="text-base">{config.title}</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
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
                {loading ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Blocking...</>) : config.submitButtonText}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConditionalRender>
  )
}
