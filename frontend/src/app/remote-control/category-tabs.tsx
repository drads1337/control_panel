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
        <div className="flex items-center justify-center py-6">
          <div className="text-center">
            <Plus className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <div className="text-sm text-muted-foreground">No sections yet</div>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first section to start organizing features
            </p>
            <ConditionalRender permission="remote_control.create" fallback={null}>
              <Button
                variant="default"
                size="sm"
                onClick={onAddCategory}
                disabled={categories.length >= 8 || !canCreate}
                className="mt-3"
                title={categories.length >= 8 ? "Maximum of 8 sections allowed" : !canCreate ? "You don't have permission to create sections" : ""}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add
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
            variant="default"
            size="sm"
            onClick={onAddCategory}
            disabled={categories.length >= 8 || !canCreate}
            title={categories.length >= 8 ? "Maximum of 8 sections allowed" : !canCreate ? "You don't have permission to create sections" : ""}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </Button>
        </ConditionalRender>
        <ConditionalRender permission="remote_control.view" fallback={null}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onManageCategories}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </ConditionalRender>
      </div>
    </div>
  )
}
