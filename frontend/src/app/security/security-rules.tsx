import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { ConditionalRender } from '@/components/rbac/conditional-render'
import { usePermissions } from '@/hooks/use-permissions'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityAPI, SecurityRule } from '@/lib/api/security'
import { toast } from 'sonner'

interface SecurityRulesProps {
  onRefresh?: () => void
  loading?: boolean
}

export default function SecurityRules({ onRefresh, loading = false }: SecurityRulesProps) {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('security.manage_rules')
  const queryClient = useQueryClient()

  const { data: rules = [], isLoading, refetch } = useQuery<SecurityRule[]>({
    queryKey: ['security-rules'],
    queryFn: () => securityAPI.getSecurityRules(),
    staleTime: 30000, // 30 seconds
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
      // Sync with parent refresh
      const interval = setInterval(() => {
        refetch()
      }, 60000) // Refresh every minute
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
    switch (severity) {
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

  const isBetaRule = useCallback((ruleName: string) => {
    const betaRules = [
      'VPN Detection',
      'Auto-block Suspicious IPs',
      'Geo-blocking',
      'Failed Login Protection'
    ];
    return betaRules.includes(ruleName);
  }, []);

  const getBetaWarning = useCallback((ruleName: string) => {
    switch (ruleName) {
      case 'VPN Detection':
        return 'This feature is in beta and may not work correctly. VPN detection accuracy may vary.';
      case 'Auto-block Suspicious IPs':
        return 'This feature is in beta. Auto-blocking may have false positives.';
      case 'Geo-blocking':
        return 'This feature is in beta and may not work correctly. Geographic blocking accuracy may vary.';
      case 'Failed Login Protection':
        return 'This feature is in beta. Blocking behavior may not work as expected.';
      default:
        return 'This feature is in beta and may not work correctly.';
    }
  }, []);

  const toggleRule = useCallback((ruleId: number) => {
    if (!canManage) return
    toggleMutation.mutate(ruleId)
  }, [canManage, toggleMutation]);

  const RuleItem = React.memo(({ 
    rule, 
    onToggle,
    canManage,
    getSeverityColor,
    getTypeIcon,
    isBetaRule,
    getBetaWarning
  }: { 
    rule: SecurityRule;
    onToggle: (ruleId: number) => void;
    canManage: boolean;
    getSeverityColor: (severity: string) => string;
    getTypeIcon: (type: string) => React.ReactElement;
    isBetaRule: (ruleName: string) => boolean;
    getBetaWarning: (ruleName: string) => string;
  }) => {
    const isBeta = isBetaRule(rule.name);
    
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
              {isBeta && (
                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" variant="secondary">
                  BETA
                </Badge>
              )}
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
            {isBeta && (
              <div className="mt-1.5">
                <p className="text-xs text-orange-600 dark:text-orange-400 italic">
                   {getBetaWarning(rule.name)}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={rule.isActive}
            onCheckedChange={() => onToggle(rule.id)}
            disabled={!canManage}
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
    isBetaRule: (ruleName: string) => boolean;
    getBetaWarning: (ruleName: string) => string;
  }> = ({ rules, onToggle, canManage, getSeverityColor, getTypeIcon, isBetaRule, getBetaWarning }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    // Lower threshold for better performance - virtualize when more than 30 items
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
                      isBetaRule={isBetaRule}
                      getBetaWarning={getBetaWarning}
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
            isBetaRule={isBetaRule}
            getBetaWarning={getBetaWarning}
          />
        ))}
      </div>
    );
  };

  const activeRulesCount = useMemo(() => {
    const rulesToCount = localRules.length > 0 ? localRules : rules
    return rulesToCount.filter(r => r.isActive).length
  }, [localRules, rules]);
  
  const displayRules = localRules.length > 0 ? localRules : rules
  const isLoadingData = isLoading || loading

  return (
    <ConditionalRender permission="security.manage_rules" fallback={null}>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Security Rules</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {activeRulesCount} of {displayRules.length} active
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {onRefresh && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      refetch()
                      onRefresh?.()
                    }}
                    disabled={isLoadingData}
                  >
                    Refresh
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 -mt-3">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">Loading security rules...</div>
                </div>
              </div>
            ) : displayRules.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">No security rules configured</div>
                </div>
              </div>
            ) : (
              <RulesList
                rules={displayRules}
                onToggle={toggleRule}
                canManage={canManage}
                getSeverityColor={getSeverityColor}
                getTypeIcon={getTypeIcon}
                isBetaRule={isBetaRule}
                getBetaWarning={getBetaWarning}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </ConditionalRender>
  )
}
