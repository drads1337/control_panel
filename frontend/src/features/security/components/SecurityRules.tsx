import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityAPI, SecurityRule } from '@/shared/api/security'
import { toast } from 'sonner'
import { useSecurityPermissions } from '@/contexts/security-permissions-context'
import SecuritySettings from './SecuritySettings'
import { Shield, Globe, Cpu, AlertTriangle, Settings2 } from 'lucide-react'

interface SecurityRulesProps {
  onRefresh?: () => void
  loading?: boolean
}

// Константы
const CONFIGURABLE_RULES = [
  'Geo-blocking',
  'Brute Force Protection',
  'Auto-block Suspicious IPs',
  'Rate Limiting Protection',
  'Suspicious Activity Monitor'
] as const

const VIRTUALIZATION_THRESHOLD = 30
const REFRESH_INTERVAL = 60000

// Утилиты
const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'low':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
    case 'medium':
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20'
    case 'high':
      return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20'
    case 'critical':
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
    default:
      return 'bg-muted/30 text-foreground border border-muted-foreground/20'
  }
}

const getTypeIcon = (type: string): React.ReactElement => {
  const iconClass = 'h-3 w-3'
  switch (type) {
    case 'ip':
      return <Globe className={iconClass} />
    case 'hwid':
      return <Cpu className={iconClass} />
    case 'behavior':
      return <AlertTriangle className={iconClass} />
    case 'geo':
      return <Globe className={iconClass} />
    default:
      return <Shield className={iconClass} />
  }
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Компоненты
interface RuleItemProps {
  rule: SecurityRule
  onToggle: (ruleId: number) => void
  onRuleClick: (rule: SecurityRule) => void
  canManage: boolean
  isLoading: boolean
}

const RuleItem = React.memo(({
  rule,
  onToggle,
  onRuleClick,
  canManage,
  isLoading
}: RuleItemProps) => {
  const isConfigurable = CONFIGURABLE_RULES.includes(rule.name as any)

  return (
    <div className="flex items-center justify-between p-3 border-b border-border/50 hover:bg-muted/30 transition-colors group">
      <div
        className={`flex items-center gap-2 flex-1 min-w-0 ${isConfigurable ? 'cursor-pointer' : ''}`}
        onClick={() => isConfigurable && onRuleClick(rule)}
      >
        <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
          {getTypeIcon(rule.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h4 className="font-semibold text-xs text-foreground">
              {rule.name}
            </h4>
            <Badge
              className={`${getSeverityColor(rule.severity)} font-medium text-[10px]`}
              variant="outline"
            >
              {rule.severity}
            </Badge>
            {!rule.isActive && (
              <Badge variant="secondary" className="text-[10px]">
                Inactive
              </Badge>
            )}
            {isConfigurable && (
              <Settings2 className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1 mb-0.5">
            {rule.description}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {rule.triggerCount > 0 && (
              <span>Triggered {rule.triggerCount} time{rule.triggerCount !== 1 ? 's' : ''}</span>
            )}
            {rule.lastTriggered && (
              <span>• Last: {formatDate(rule.lastTriggered)}</span>
            )}
          </div>
        </div>
      </div>
      <div
        className="flex items-center gap-2 shrink-0 ml-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          checked={rule.isActive}
          onCheckedChange={() => onToggle(rule.id)}
          disabled={!canManage || isLoading}
        />
      </div>
    </div>
  )
})

RuleItem.displayName = 'RuleItem'

interface RulesListProps {
  rules: SecurityRule[]
  onToggle: (ruleId: number) => void
  onRuleClick: (rule: SecurityRule) => void
  canManage: boolean
  isLoading: boolean
}

const RulesList: React.FC<RulesListProps> = ({
  rules,
  onToggle,
  onRuleClick,
  canManage,
  isLoading
}) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = rules.length > VIRTUALIZATION_THRESHOLD

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? rules.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, 
    overscan: 5,
    enabled: shouldVirtualize
  })

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px', contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rule = rules[virtualRow.index]
            return (
              <div
                key={rule.id}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <RuleItem
                  rule={rule}
                  onToggle={onToggle}
                  onRuleClick={onRuleClick}
                  canManage={canManage}
                  isLoading={isLoading}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/50">
      {rules.map((rule) => (
        <RuleItem
          key={rule.id}
          rule={rule}
          onToggle={onToggle}
          onRuleClick={onRuleClick}
          canManage={canManage}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}

// Основной компонент
export default function SecurityRules({ onRefresh, loading = false }: SecurityRulesProps) {
  const { canManageRules } = useSecurityPermissions()
  const queryClient = useQueryClient()

  const { data: rules = [], isLoading, refetch } = useQuery<SecurityRule[]>({
    queryKey: ['security-rules'],
    queryFn: () => securityAPI.getSecurityRules(),
    staleTime: 30000
  })

  const toggleMutation = useMutation({
    mutationFn: (ruleId: number) => securityAPI.toggleSecurityRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-rules'] })
      toast.success('Security rule updated')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update security rule')
    }
  })

  const [selectedRule, setSelectedRule] = useState<SecurityRule | null>(null)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  // Автообновление
  useEffect(() => {
    if (onRefresh) {
      const interval = setInterval(() => {
        refetch()
      }, REFRESH_INTERVAL)
      return () => clearInterval(interval)
    }
  }, [onRefresh, refetch])

  const handleRuleClick = useCallback((rule: SecurityRule) => {
    if (CONFIGURABLE_RULES.includes(rule.name as any)) {
      setSelectedRule(rule)
      setSettingsDialogOpen(true)
    }
  }, [])

  const toggleRule = useCallback(
    (ruleId: number) => {
      if (!canManageRules) return
      toggleMutation.mutate(ruleId)
    },
    [canManageRules, toggleMutation]
  )

  const isDataLoading = isLoading || loading

  // Filter out HWID Blacklist rule
  const filteredRules = rules.filter(rule => rule.name !== 'HWID Blacklist')

  return (
    <div className="space-y-4">
      <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Security Rules</CardTitle>
              <CardDescription className="text-xs">
                {filteredRules.length} {filteredRules.length === 1 ? 'rule' : 'rules'} configured
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 pt-0 -mt-4">
          {isDataLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Shield className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-xs font-medium text-foreground mb-1">
                No security rules configured
              </p>
              <p className="text-[10px] text-muted-foreground text-center">
                Security rules will appear here once they are set up
              </p>
            </div>
          ) : (
            <RulesList
              rules={filteredRules}
              onToggle={toggleRule}
              onRuleClick={handleRuleClick}
              canManage={canManageRules}
              isLoading={isDataLoading}
            />
          )}
        </CardContent>
      </Card>

      <SecuritySettings
        rule={selectedRule}
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        onRefresh={onRefresh}
        loading={loading}
      />
    </div>
  )
}
