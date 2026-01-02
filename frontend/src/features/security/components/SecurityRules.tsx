import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
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

interface SecurityRulesProps {
  onRefresh?: () => void
  loading?: boolean
}

export default function SecurityRules({ onRefresh, loading = false }: SecurityRulesProps) {
  const { canManageRules } = useSecurityPermissions()
  const queryClient = useQueryClient()

  const { data: rules = [], isLoading, refetch } = useQuery<SecurityRule[]>({
    queryKey: ['security-rules'],
    queryFn: () => securityAPI.getSecurityRules(),
    staleTime: 30000,
  })

  const toggleMutation = useMutation({
    mutationFn: (ruleId: number) => securityAPI.toggleSecurityRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-rules'] })
      toast.success('Security rule updated')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update security rule')
    },
  })

  useEffect(() => {
    if (onRefresh) {
      const interval = setInterval(() => {
        refetch()
      }, 60000)
      return () => clearInterval(interval)
    }
  }, [onRefresh, refetch])

  const [localRules, setLocalRules] = useState<SecurityRule[]>([])
  const [selectedRule, setSelectedRule] = useState<SecurityRule | null>(null)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  useEffect(() => {
    if (rules.length > 0) {
      setLocalRules(rules)
    }
  }, [rules])

  const handleRuleClick = useCallback((rule: SecurityRule) => {
    // Only open settings for rules that have configurable settings
    const configurableRules = ['Geo-blocking', 'Brute Force Protection', 'Failed Login Protection']
    if (configurableRules.includes(rule.name)) {
      setSelectedRule(rule)
      setSettingsDialogOpen(true)
    }
  }, [])

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'medium': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'high': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      case 'critical': return 'bg-muted/30 text-foreground border border-muted-foreground/20'
      default: return 'bg-muted/30 text-foreground border border-muted-foreground/20'
    }
  }, []);

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'ip': return <span className="text-xs text-foreground">IP</span>
      case 'hwid': return <span className="text-xs text-foreground">HW</span>
      case 'behavior': return <span className="text-xs text-foreground">!</span>
      case 'geo': return <span className="text-xs text-foreground">G</span>
      default: return <span className="text-xs text-foreground">?</span>
    }
  }, []);

  const toggleRule = useCallback((ruleId: number) => {
    if (!canManageRules) return
    toggleMutation.mutate(ruleId)
  }, [canManageRules, toggleMutation]);

  const RuleItem = React.memo(({ 
    rule, 
    onToggle,
    onRuleClick,
    canManage,
    getSeverityColor,
    getTypeIcon
  }: { 
    rule: SecurityRule;
    onToggle: (ruleId: number) => void;
    onRuleClick: (rule: SecurityRule) => void;
    canManage: boolean;
    getSeverityColor: (severity: string) => string;
    getTypeIcon: (type: string) => React.ReactElement;
  }) => {
    const configurableRules = ['Geo-blocking', 'Brute Force Protection', 'Failed Login Protection']
    const isConfigurable = configurableRules.includes(rule.name)

    return (
      <div className="flex items-center justify-between p-2.5 border-b hover:bg-muted/50 transition-colors">
        <div 
          className={`flex items-center gap-3 flex-1 min-w-0 ${isConfigurable ? 'cursor-pointer' : ''}`}
          onClick={() => isConfigurable && onRuleClick(rule)}
        >
          <div className="h-9 w-9 rounded-full bg-muted/30 border border-muted-foreground/20 flex items-center justify-center">
            {getTypeIcon(rule.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm">
                {rule.name}
              </h4>
              <Badge className={getSeverityColor(rule.severity)} variant="outline">
                {rule.severity}
              </Badge>
              {!rule.isActive && (
                <span className="text-xs text-muted-foreground">• Inactive</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground truncate">
                {rule.description}
              </p>
              <span className="text-xs text-muted-foreground">
                • {rule.triggerCount} triggers
              </span>
              {rule.lastTriggered && (
                <span className="text-xs text-muted-foreground">
                  • Last: {new Date(rule.lastTriggered).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={rule.isActive}
            onCheckedChange={() => onToggle(rule.id)}
            disabled={!canManage || loading}
          />
        </div>
      </div>
    );
  });

  RuleItem.displayName = 'RuleItem';

  const RulesList: React.FC<{
    rules: SecurityRule[];
    onToggle: (ruleId: number) => void;
    onRuleClick: (rule: SecurityRule) => void;
    canManage: boolean;
    getSeverityColor: (severity: string) => string;
    getTypeIcon: (type: string) => React.ReactElement;
  }> = ({ rules, onToggle, onRuleClick, canManage, getSeverityColor, getTypeIcon }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const shouldVirtualize = rules.length > 30;

    const rowVirtualizer = useVirtualizer({
      count: shouldVirtualize ? rules.length : 0,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 100,
      overscan: 5,
      enabled: shouldVirtualize,
    });

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
              position: 'relative',
            }}
          >
            <div className="divide-y">
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rule = rules[virtualRow.index];
                return (
                  <div
                    key={rule.id}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <RuleItem
                      rule={rule}
                      onToggle={onToggle}
                      onRuleClick={onRuleClick}
                      canManage={canManage}
                      getSeverityColor={getSeverityColor}
                      getTypeIcon={getTypeIcon}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="divide-y">
        {rules.map((rule) => (
          <RuleItem
            key={rule.id}
            rule={rule}
            onToggle={onToggle}
            onRuleClick={onRuleClick}
            canManage={canManage}
            getSeverityColor={getSeverityColor}
            getTypeIcon={getTypeIcon}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="p-3 border rounded-lg bg-background shadow-sm">
        <CardHeader className="p-0 pb-0">
          <div>
            <CardTitle className="text-base sm:text-lg">Security Rules</CardTitle>
            <CardDescription className="mt-1 text-xs sm:text-sm">
              {localRules.length} total rules
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 pt-0 pb-4 sm:pb-6 -mt-4">
          {isLoading || loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : localRules.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="p-2 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-center text-xs text-muted-foreground">
                No security rules configured
              </div>
            </div>
          ) : (
            <RulesList
              rules={localRules}
              onToggle={toggleRule}
              onRuleClick={handleRuleClick}
              canManage={canManageRules}
              getSeverityColor={getSeverityColor}
              getTypeIcon={getTypeIcon}
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
