import type { BlockFormData } from '../AddBlockDialog'

export interface BlockFormValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateBlockForm(
  formData: BlockFormData,
  fieldName: string
): BlockFormValidationResult {
  const errors: string[] = []
  const fieldValue = formData[fieldName] as string

  if (!fieldValue?.trim()) {
    errors.push(`${fieldName} is required`)
  }

  if (!formData.reason?.trim()) {
    errors.push('Reason is required')
  }

  const threatScore = formData.threat_score
  if (threatScore !== undefined && (threatScore < 0 || threatScore > 100)) {
    errors.push('Threat score must be between 0 and 100')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
