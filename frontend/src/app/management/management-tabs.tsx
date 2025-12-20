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

  // Если таб всего один, показываем просто контент без переключателей
  if (availableTabs.length === 1) {
    return (
      <Card className="border-border bg-card mt-4">
        <CardContent className="p-4 sm:p-6 min-h-[400px]">
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList
        className="grid w-full h-14 bg-muted border border-border rounded-lg p-1"
        style={{gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)`}}
      >
        {availableTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center justify-center gap-2"
            >
              <Icon className="h-4 w-4 md:h-4 md:w-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>

      <Card className="border-border bg-card mt-4">
        <CardContent className="p-4 sm:p-6 min-h-[400px]">
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