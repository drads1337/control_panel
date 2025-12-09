import React from 'react'
import { TabsList, TabsTrigger } from '@/components/animate-ui/components/radix/tabs'
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
}

export default function CategoryTabs({
  categories,
  activeTab,
  setActiveTab,
  onAddCategory,
  onManageCategories
}: CategoryTabsProps) {
  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">No sections yet</p>
          <ConditionalRender permission="remote_control.create" fallback={null}>
            <Button
              variant="default"
              size="sm"
              onClick={onAddCategory}
              disabled={categories.length >= 8}
              title={categories.length >= 8 ? "Maximum of 8 sections allowed" : ""}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Section
            </Button>
          </ConditionalRender>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:flex-1 min-w-0">
          <TabsList 
            className={`grid w-full h-12 xs:h-14 bg-muted border border-border rounded-lg p-1`}
            style={{gridTemplateColumns: `repeat(${categories.length}, 1fr)`}}
          >
            {categories.map(category => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="flex items-center justify-center gap-2"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate hidden md:inline">
                  {category.name ? category.name : <span className="text-muted-foreground italic">Unnamed</span>}
                </span>
                <span className="truncate md:hidden">
                  {category.name ? category.name.substring(0, 8) : <span className="text-muted-foreground italic">Unnamed</span>}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex gap-2 shrink-0">
          <ConditionalRender permission="remote_control.create" fallback={null}>
            <Button
              variant="default"
              size="sm"
              onClick={onAddCategory}
              disabled={categories.length >= 8}
              title={categories.length >= 8 ? "Maximum of 8 sections allowed" : ""}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="remote_control.view" fallback={null}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onManageCategories}
              className="h-9 w-9"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </ConditionalRender>
        </div>
      </div>
    </div>
  )
}