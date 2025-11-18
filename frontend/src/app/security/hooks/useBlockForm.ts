import { useState } from 'react'
import { format } from 'date-fns'
import type { BlockFormData, AddBlockDialogConfig } from '../AddBlockDialog'
import { validateBlockForm } from '../components/BlockFormValidation'

const initialFormData = <T extends string>(fieldName: T): BlockFormData<T> => ({
  [fieldName]: '',
  reason: '',
  expires_at: '',
  block_type: 'manual',
  category: 'general',
  severity: 'medium',
  threat_score: 50
} as BlockFormData<T>)

export function useBlockForm(config: AddBlockDialogConfig) {
  const [formData, setFormData] = useState<BlockFormData<string>>(() => 
    initialFormData(config.fieldName)
  )
  const [expiresDate, setExpiresDate] = useState<Date | undefined>(undefined)

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const resetForm = () => {
    setFormData(initialFormData(config.fieldName))
    setExpiresDate(undefined)
  }

  const getFormDataForSubmit = (): BlockFormData<string> => {
    return {
      ...formData,
      expires_at: expiresDate 
        ? format(expiresDate, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'') 
        : undefined
    }
  }

  const validation = validateBlockForm(formData, config.fieldName)
  const fieldValue = formData[config.fieldName] as string
  const isValid = fieldValue?.trim() && formData.reason?.trim() && validation.isValid

  return {
    formData,
    expiresDate,
    isValid,
    validation,
    handleInputChange,
    setExpiresDate,
    resetForm,
    getFormDataForSubmit,
  }
}
