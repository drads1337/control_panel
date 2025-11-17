import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ManagementTabContent } from './ManagementTabContent'
import { useManagementStore } from '@/stores/management-store'
import type { ManagementTab } from '@/hooks/use-management-data'

interface ManagementTabsProps {
  availableTabs: ManagementTab[]
}

export function ManagementTabs({ availableTabs }: ManagementTabsProps) {
  const { activeTab, setActiveTab } = useManagementStore()

  if (availableTabs.length === 0) {
    return null
  }

  if (availableTabs.length > 1) {
    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid w-full h-14 bg-muted border border-border rounded-lg`}
          style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}
        >
          {availableTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <Card className="@container/card border-border bg-card mt-4">
          <CardContent className="p-6 min-h-[600px]">
            {availableTabs.map((tab) => (
              <ManagementTabContent
                key={tab.value}
                tabValue={tab.value}
                wrapInTabsContent={true}
              />
            ))}
          </CardContent>
        </Card>
      </Tabs>
    )
  }

  // Single tab - show content directly without tabs
  return (
    <Card className="@container/card border-border bg-card mt-4">
      <CardContent className="p-6 min-h-[600px]">
        {availableTabs.map((tab) => (
          <ManagementTabContent
            key={tab.value}
            tabValue={tab.value}
            wrapInTabsContent={false}
          />
        ))}
      </CardContent>
    </Card>
  )
}

