import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Globe, Monitor, AlertTriangle } from 'lucide-react'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { usePermissions } from '@/hooks/use-permissions'

interface SecurityRule {
  id: number
  name: string
  description: string
  type: 'ip' | 'hwid' | 'behavior' | 'geo'
  action: 'block' | 'allow' | 'monitor'
  severity: 'low' | 'medium' | 'high' | 'critical'
  isActive: boolean
  createdAt: string
  updatedAt: string
  triggerCount: number
  lastTriggered?: string
}

export default function SecurityRules() {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('security.manage_rules')
  
  const [rules, setRules] = useState<SecurityRule[]>([
    {
      id: 1,
      name: 'Auto-block Suspicious IPs',
      description: 'Automatically block IPs with high threat score',
      type: 'ip',
      action: 'block',
      severity: 'high',
      isActive: true,
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      triggerCount: 24,
      lastTriggered: '2024-01-20T14:22:00Z'
    },
    {
      id: 2,
      name: 'Rate Limiting Protection',
      description: 'Limit requests per minute per IP',
      type: 'behavior',
      action: 'monitor',
      severity: 'medium',
      isActive: true,
      createdAt: '2024-01-10T09:15:00Z',
      updatedAt: '2024-01-18T16:45:00Z',
      triggerCount: 89,
      lastTriggered: '2024-01-20T08:45:00Z'
    },
    {
      id: 3,
      name: 'Failed Login Protection',
      description: 'Block after 5 failed login attempts',
      type: 'behavior',
      action: 'block',
      severity: 'high',
      isActive: true,
      createdAt: '2024-01-05T14:20:00Z',
      updatedAt: '2024-01-05T14:20:00Z',
      triggerCount: 8,
      lastTriggered: '2024-01-19T09:15:00Z'
    },
    {
      id: 4,
      name: 'HWID Blacklist',
      description: 'Block known malicious hardware IDs',
      type: 'hwid',
      action: 'block',
      severity: 'critical',
      isActive: true,
      createdAt: '2024-01-12T11:00:00Z',
      updatedAt: '2024-01-12T11:00:00Z',
      triggerCount: 3,
      lastTriggered: '2024-01-18T16:30:00Z'
    },
    {
      id: 5,
      name: 'Geo-blocking',
      description: 'Block connections from specific countries',
      type: 'geo',
      action: 'block',
      severity: 'medium',
      isActive: false,
      createdAt: '2024-01-12T11:00:00Z',
      updatedAt: '2024-01-12T11:00:00Z',
      triggerCount: 0
    },
    {
      id: 6,
      name: 'VPN Detection',
      description: 'Detect and block VPN connections',
      type: 'ip',
      action: 'monitor',
      severity: 'medium',
      isActive: false,
      createdAt: '2024-01-08T13:30:00Z',
      updatedAt: '2024-01-08T13:30:00Z',
      triggerCount: 0
    },
    {
      id: 7,
      name: 'Brute Force Protection',
      description: 'Temporary block after multiple failed attempts',
      type: 'behavior',
      action: 'block',
      severity: 'high',
      isActive: true,
      createdAt: '2024-01-06T10:15:00Z',
      updatedAt: '2024-01-06T10:15:00Z',
      triggerCount: 12,
      lastTriggered: '2024-01-19T14:20:00Z'
    },
    {
      id: 8,
      name: 'Suspicious Activity Monitor',
      description: 'Monitor unusual access patterns',
      type: 'behavior',
      action: 'monitor',
      severity: 'low',
      isActive: true,
      createdAt: '2024-01-04T09:00:00Z',
      updatedAt: '2024-01-04T09:00:00Z',
      triggerCount: 45,
      lastTriggered: '2024-01-20T10:15:00Z'
    }
  ])


  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ip': return <Globe className="h-4 w-4" />
      case 'hwid': return <Monitor className="h-4 w-4" />
      case 'behavior': return <AlertTriangle className="h-4 w-4" />
      case 'geo': return <Globe className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  const toggleRule = (ruleId: number) => {
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    ))
  }


  return (
    <ConditionalRender permission="security.manage_rules" fallback={null}>
      <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Security Rules</h2>
        <div className="text-sm text-muted-foreground">
          {rules.filter(r => r.isActive).length} of {rules.length} active
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getTypeIcon(rule.type)}
                <div>
                  <div className="font-medium">{rule.name}</div>
                  <div className="text-sm text-muted-foreground">{rule.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={getSeverityColor(rule.severity)} variant="secondary">
                  {rule.severity}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {rule.triggerCount} triggers
                </div>
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={() => toggleRule(rule.id)}
                  disabled={!canManage}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
    </ConditionalRender>
  )
}
