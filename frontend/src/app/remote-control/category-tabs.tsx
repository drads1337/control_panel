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
    // АДАПТАЦИЯ: flex-col для мобильных, sm:flex-row для планшетов/десктопа
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
      
      {/* Контейнер табов */}
      <div className="relative w-full sm:mr-2 sm:flex-1 min-w-0">
        {/* 
           АДАПТАЦИЯ TabsList: 
           1. Убрали inline gridTemplateColumns, заменили на Flexbox логику.
           2. overflow-x-auto: позволяет скроллить табы на мобильном.
           3. sm:overflow-visible: убирает скролл на десктопе (где места достаточно).
           4. scrollbar-hide (опционально): скрывает полосу прокрутки для красоты.
        */}
        <TabsList 
          className={`
            flex w-full h-14 bg-muted border border-border rounded-lg p-1
            overflow-x-auto sm:overflow-visible
          `}
        >
          {categories.map(category => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              // АДАПТАЦИЯ TabsTrigger:
              // flex-shrink-0: на мобильном не сжимать элементы (включается скролл).
              // min-w-[100px]: минимальная ширина на мобильном для читаемости.
              // sm:flex-1: на десктопе занимать равное пространство (аналог grid repeat 1fr).
              // sm:min-w-0: позволяет тексту обрезаться через truncate, если нужно, вместо раздувания контейнера.
              className="flex items-center justify-center gap-2 flex-shrink-0 min-w-[100px] px-3 sm:px-0 sm:flex-1 sm:min-w-0"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: category.color }}
              />
              <span className="truncate">{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* Кнопки управления */}
      {/* АДАПТАЦИЯ: w-full и justify-end на мобильных для выравнивания кнопок */}
      <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
        <ConditionalRender permission="remote_control.create" fallback={null}>
          <Button
            variant="default"
            size="sm"
            onClick={onAddCategory}
            disabled={categories.length >= 8 || !canCreate}
            title={categories.length >= 8 ? "Maximum of 8 sections allowed" : !canCreate ? "You don't have permission to create sections" : ""}
            // На мобильных можно сделать кнопку шире, если хочется
            className="flex-1 sm:flex-none" 
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