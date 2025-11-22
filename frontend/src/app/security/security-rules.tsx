import React, { useState, useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
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

interface SecurityRulesProps {
  onRefresh?: () => void
  loading?: boolean
}

export default function SecurityRules({ onRefresh, loading = false }: SecurityRulesProps) {
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

  const toggleRule = useCallback((ruleId: number) => {
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    ))
  }, [rules]);

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
  }> = ({ rules, onToggle, canManage, getSeverityColor, getTypeIcon }) => {
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

  const activeRulesCount = useMemo(() => rules.filter(r => r.isActive).length, [rules]);

  return (
    <ConditionalRender permission="security.manage_rules" fallback={null}>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Security Rules</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {activeRulesCount} of {rules.length} active
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {onRefresh && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={onRefresh}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 -mt-3">
            {rules.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">No security rules configured</div>
                </div>
              </div>
            ) : (
              <RulesList
                rules={rules}
                onToggle={toggleRule}
                canManage={canManage}
                getSeverityColor={getSeverityColor}
                getTypeIcon={getTypeIcon}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </ConditionalRender>
  )
}
