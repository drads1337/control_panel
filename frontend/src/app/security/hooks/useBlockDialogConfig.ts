import { AlertTriangle, Monitor, LucideIcon } from 'lucide-react'
import type { AddBlockDialogConfig } from '../AddBlockDialog'

export type BlockType = 'ip' | 'hwid'

interface BlockTypeConfig {
  fieldName: string
  fieldLabel: string
  fieldPlaceholder: string
  title: string
  description: string
  buttonText: string
  submitButtonText: string
  icon: LucideIcon
  iconColor: string
  dialogMaxWidth: string
  fieldLayout: 'single' | 'grid'
  permission: string
  blockTypeOptions: Array<{ value: string; label: string }>
  categoryOptions: Array<{ value: string; label: string }>
}

const BLOCK_CONFIGS: Record<BlockType, BlockTypeConfig> = {
  ip: {
    fieldName: 'ip_address',
    fieldLabel: 'IP Address',
    fieldPlaceholder: '192.168.1.100',
    title: 'Block IP Address',
    description: 'Add a new IP address to the block list. This will prevent the IP from accessing your system.',
    buttonText: 'Block IP Address',
    submitButtonText: 'Block IP Address',
    icon: AlertTriangle,
    iconColor: 'text-orange-500',
    dialogMaxWidth: 'sm:max-w-[600px]',
    fieldLayout: 'grid',
    permission: 'security.block_ips',
    blockTypeOptions: [
      { value: 'manual', label: 'Manual' },
      { value: 'automatic', label: 'Automatic' },
      { value: 'behavioral', label: 'Behavioral' },
      { value: 'geo', label: 'Geographic' },
      { value: 'rate_limit', label: 'Rate Limit' },
    ],
    categoryOptions: [
      { value: 'general', label: 'General' },
      { value: 'spam', label: 'Spam' },
      { value: 'abuse', label: 'Abuse' },
      { value: 'fraud', label: 'Fraud' },
      { value: 'malware', label: 'Malware' },
      { value: 'suspicious', label: 'Suspicious' },
      { value: 'violation', label: 'Policy Violation' },
      { value: 'rate_limit', label: 'Rate Limit' },
      { value: 'geo_block', label: 'Geographic Block' },
    ],
  },
  hwid: {
    fieldName: 'hwid',
    fieldLabel: 'Hardware ID',
    fieldPlaceholder: 'HWID-ABC123-DEF456-GHI789',
    title: 'Block Hardware ID',
    description: 'Add a new hardware ID to the block list. This will prevent the device from accessing your system.',
    buttonText: 'Block HWID',
    submitButtonText: 'Block HWID',
    icon: Monitor,
    iconColor: 'text-blue-500',
    dialogMaxWidth: 'sm:max-w-[700px]',
    fieldLayout: 'single',
    permission: 'security.block_hwids',
    blockTypeOptions: [
      { value: 'manual', label: 'Manual' },
      { value: 'automatic', label: 'Automatic' },
      { value: 'behavioral', label: 'Behavioral' },
      { value: 'rate_limit', label: 'Rate Limit' },
    ],
    categoryOptions: [
      { value: 'general', label: 'General' },
      { value: 'spam', label: 'Spam' },
      { value: 'abuse', label: 'Abuse' },
      { value: 'fraud', label: 'Fraud' },
      { value: 'malware', label: 'Malware' },
      { value: 'suspicious', label: 'Suspicious' },
      { value: 'violation', label: 'Policy Violation' },
      { value: 'rate_limit', label: 'Rate Limit' },
    ],
  },
}

/**
 * Hook to get block dialog configuration based on block type
 * This centralizes all block type configurations to avoid duplication
 */
export function useBlockDialogConfig(blockType: BlockType): AddBlockDialogConfig {
  return BLOCK_CONFIGS[blockType]
}

