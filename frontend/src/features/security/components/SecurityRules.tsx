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
  useEffect(() => {
    if (rules.length > 0) {
      setLocalRules(rules)
    }
  }, [rules])

  const getSeverityColor = useCallback((severity: string) => {
    switch (severity.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }, []);

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case 'ip': return <span className="text-xs text-primary">IP</span>
      case 'hwid': return <span className="text-xs text-primary">HW</span>
      case 'behavior': return <span className="text-xs text-primary">!</span>
      case 'geo': return <span className="text-xs text-primary">G</span>
      default: return <span className="text-xs text-primary">?</span>
    }
  }, []);

  const toggleRule = useCallback((ruleId: number) => {
    if (!canManageRules) return
    toggleMutation.mutate(ruleId)
  }, [canManageRules, toggleMutation]);

  const RuleItem = React.memo(({ 
    rule, 
    onToggle,
    canManage,
    getSeverityColor,
    getTypeIcon
  }: { 
    rule: SecurityRule;
    onToggle: (ruleId: number) => void;
    canManage: boolean;
    getSeverityColor: (severity: string) => string;
    getTypeIcon: (type: string) => React.ReactElement;
  }) => {
    return (
      <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            {getTypeIcon(rule.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm">
                {rule.name}
              </h4>
              <Badge className={getSeverityColor(rule.severity)} variant="secondary">
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
        <div className="flex items-center gap-2">
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
    canManage: boolean;
    getSeverityColor: (severity: string) => string;
    getTypeIcon: (type: string) => React.ReactElement;
  }> = ({ rules, onToggle, canManage, getSeverityColor, getTypeIcon }) => {
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
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <div>
            <CardTitle className="text-base sm:text-lg">Security Rules</CardTitle>
            <CardDescription className="mt-1 text-xs sm:text-sm">
              {localRules.length} total rules
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 pb-4 sm:pb-6">
          {isLoading || loading ? (
            <Spinner message="Loading security rules..." />
          ) : localRules.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">
                  No security rules configured
                </div>
              </div>
            </div>
          ) : (
            <RulesList
              rules={localRules}
              onToggle={toggleRule}
              canManage={canManageRules}
              getSeverityColor={getSeverityColor}
              getTypeIcon={getTypeIcon}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

