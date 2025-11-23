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
        <div className="relative mb-2 xs:mb-3 sm:mb-4 overflow-x-auto -mx-2 xs:-mx-2 sm:mx-0 px-2 xs:px-2 sm:px-0">
          <TabsList
            className={`grid w-full min-w-max sm:min-w-0 h-10 xs:h-11 sm:h-12 md:h-14 bg-muted border border-border rounded-lg p-0.5 xs:p-1 gap-0.5 xs:gap-1`}
            style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(100px, 1fr))` }}
          >
            {availableTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center justify-center gap-1 xs:gap-1.5 sm:gap-2 text-[10px] xs:text-xs sm:text-sm px-1.5 xs:px-2 sm:px-3 md:px-4 py-1.5 xs:py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
                >
                  <Icon className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <Card className="@container/card border-border bg-card mt-2 xs:mt-3 sm:mt-4">
          <CardContent className="p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6 min-h-[300px] xs:min-h-[350px] sm:min-h-[400px] md:min-h-[500px] lg:min-h-[600px]">
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

  return (
    <Card className="@container/card border-border bg-card mt-2 xs:mt-3 sm:mt-4">
      <CardContent className="p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6 min-h-[300px] xs:min-h-[350px] sm:min-h-[400px] md:min-h-[500px] lg:min-h-[600px]">
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
