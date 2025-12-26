import React from 'react'
import { Tabs, TabsContent, TabsContents, TabsHighlight, TabsHighlightItem, TabsList, TabsTrigger } from '@/components/animate-ui/primitives/radix/tabs'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { RemoteCategory } from '@/lib/remote-control-api'

interface RemoteControlCategoriesProps {
  categories: RemoteCategory[]
  activeTab: string
  onTabChange: (tab: string) => void
  onEditCategory: (category: RemoteCategory) => void
  onDeleteCategory: (categoryId: string) => void
  canEdit: boolean
  canDelete: boolean
  loading: boolean
}

export function RemoteControlCategories({
  categories,
  activeTab,
  onTabChange,
  onEditCategory,
  onDeleteCategory,
  canEdit,
  canDelete,
  loading,
}: RemoteControlCategoriesProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [categoryToDelete, setCategoryToDelete] = React.useState<RemoteCategory | null>(null)

  const handleDeleteClick = (category: RemoteCategory, e: React.MouseEvent) => {
    e.stopPropagation()
    setCategoryToDelete(category)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (categoryToDelete) {
      onDeleteCategory(categoryToDelete.id)
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    }
  }

  const handleEditClick = (category: RemoteCategory, e: React.MouseEvent) => {
    e.stopPropagation()
    onEditCategory(category)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[100px] border rounded-lg bg-muted/50">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No categories yet. Create one to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Tabs value={activeTab || categories[0]?.id} onValueChange={onTabChange} className="relative">
        <TabsHighlight className="bg-background absolute z-0 inset-0">
          <TabsList className="h-7 inline-flex p-0.5 bg-muted">
            {categories.map((category) => (
              <TabsHighlightItem key={category.id} value={category.id}>
                <TabsTrigger
                  value={category.id}
                  className="h-full px-2.5 py-1 leading-0 text-xs flex items-center gap-2 group"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                  {(canEdit || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 ml-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <DropdownMenuItem onClick={(e) => handleEditClick(category, e)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteClick(category, e)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TabsTrigger>
              </TabsHighlightItem>
            ))}
          </TabsList>
        </TabsHighlight>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{categoryToDelete?.name}"? This will also delete all features in this category. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

