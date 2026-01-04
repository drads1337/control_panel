import React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Plus, Settings } from 'lucide-react'
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render'
import type { RemoteCategory } from './CategoryDialog'

interface CategoryTabsProps {
  categories: RemoteCategory[]
  activeTab: string
  setActiveTab: (tab: string) => void
  onAddCategory: () => void
  onManageCategories: () => void
}

export function CategoryTabs({
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

  const activeCategory = categories.find(cat => cat.id === activeTab)
  const displayName = activeCategory 
    ? (activeCategory.name || 'Unnamed')
    : 'Select section'

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex items-center justify-between">
        <Label htmlFor="category-selector" className="sr-only">
          Section
        </Label>
        <div className="flex items-center gap-2 flex-1">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger
              className="flex w-fit h-8 text-xs @4xl/main:hidden"
              size="sm"
              id="category-selector"
            >
              <SelectValue>
                {activeCategory && (
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: activeCategory.color }}
                    />
                    <span>{displayName}</span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="text-xs">
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <span>{category.name || 'Unnamed'}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TabsList className="hidden h-8 **:data-[slot=tabs-trigger]:text-xs @4xl/main:flex">
            {categories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <span>{category.name || 'Unnamed'}</span>
                </div>
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
              className="h-8"
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
              className="h-8 w-8"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </ConditionalRender>
        </div>
      </div>
    </Tabs>
  )
}

