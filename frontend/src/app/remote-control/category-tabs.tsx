import React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Plus, Settings } from 'lucide-react'
import { RemoteCategory } from '@/lib/remote-control-api'
import { ConditionalRender } from '@/components/rbac/conditional-render'

interface CategoryTabsProps {
  categories: RemoteCategory[]
  activeTab: string
  setActiveTab: (tab: string) => void
  onAddCategory: () => void
  onManageCategories: () => void
  canCreate: boolean
}

export default function CategoryTabs({
  categories,
  activeTab,
  setActiveTab,
  onAddCategory,
  onManageCategories,
  canCreate
}: CategoryTabsProps) {
  if (categories.length === 0) {
    return (
      <div className="w-full">
        <div className="bg-muted/30 border border-dashed border-border rounded-lg p-6 text-center">
          <div className="flex flex-col items-center space-y-3">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No Sections Yet</h3>
              <p className="text-muted-foreground text-sm">
                Create your first section to start organizing features
              </p>
            </div>
            <ConditionalRender permission="remote_control.create" fallback={null}>
              <Button
                variant="default"
                size="sm"
                onClick={onAddCategory}
                disabled={categories.length >= 8 || !canCreate}
                title={categories.length >= 8 ? "Maximum of 8 sections allowed" : !canCreate ? "You don't have permission to create sections" : ""}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Section
              </Button>
            </ConditionalRender>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <TabsList 
        className="grid w-full h-14 bg-muted border border-border rounded-lg mr-2" 
        style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}
      >
        {categories.map(category => (
          <TabsTrigger
            key={category.id}
            value={category.id}
            className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200"
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span>{category.name}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex gap-2 shrink-0">
        <ConditionalRender permission="remote_control.create" fallback={null}>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddCategory}
            disabled={categories.length >= 8 || !canCreate}
            title={categories.length >= 8 ? "Maximum of 8 sections allowed" : !canCreate ? "You don't have permission to create sections" : ""}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Section ({categories.length}/8)
          </Button>
        </ConditionalRender>
        <ConditionalRender permission="remote_control.view" fallback={null}>
          <Button
            variant="outline"
            size="sm"
            onClick={onManageCategories}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </ConditionalRender>
      </div>
    </div>
  )
}
