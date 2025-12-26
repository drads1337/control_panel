import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Edit, Trash2, Power } from 'lucide-react'
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
import type { RemoteCategory, RemoteFeature } from '@/lib/remote-control-api'

interface RemoteControlFeaturesProps {
  categories: RemoteCategory[]
  features: RemoteFeature[]
  activeTab: string
  getCategoryFeatures: (categoryId: string) => RemoteFeature[]
  onToggleFeature: (featureId: string) => void
  onAddFeature: () => void
  onEditFeature: (feature: RemoteFeature) => void
  onDeleteFeature: (featureId: string) => void
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canToggle: boolean
  loading: boolean
}

export function RemoteControlFeatures({
  categories,
  features,
  activeTab,
  getCategoryFeatures,
  onToggleFeature,
  onAddFeature,
  onEditFeature,
  onDeleteFeature,
  canCreate,
  canEdit,
  canDelete,
  canToggle,
  loading,
}: RemoteControlFeaturesProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [featureToDelete, setFeatureToDelete] = React.useState<RemoteFeature | null>(null)

  const activeCategory = categories.find((cat) => cat.id === activeTab)
  const categoryFeatures = activeTab ? getCategoryFeatures(activeTab) : []

  const handleDeleteClick = (feature: RemoteFeature) => {
    setFeatureToDelete(feature)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (featureToDelete) {
      onDeleteFeature(featureToDelete.id)
      setDeleteDialogOpen(false)
      setFeatureToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!activeTab || !activeCategory) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[200px]">
          <p className="text-sm text-muted-foreground">Select a category to view features</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: activeCategory.color }}
                />
                {activeCategory.name} Features
              </CardTitle>
              <CardDescription className="mt-1">
                {categoryFeatures.length} feature{categoryFeatures.length !== 1 ? 's' : ''} in this category
              </CardDescription>
            </div>
            {canCreate && (
              <Button onClick={onAddFeature} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {categoryFeatures.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
              <p className="text-sm text-muted-foreground mb-4">No features in this category yet.</p>
              {canCreate && (
                <Button onClick={onAddFeature} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Feature
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {categoryFeatures.map((feature) => (
                <div
                  key={feature.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{feature.name}</h4>
                      <Badge
                        variant={feature.enabled ? 'default' : 'secondary'}
                        className={feature.enabled ? 'bg-green-500' : ''}
                      >
                        {feature.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      {feature.status && (
                        <Badge variant="outline" className="text-xs">
                          {feature.status}
                        </Badge>
                      )}
                    </div>
                    {feature.description && (
                      <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                    )}
                    {feature.usage_count !== undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Used {feature.usage_count} time{feature.usage_count !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canToggle && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={feature.enabled}
                          onCheckedChange={() => onToggleFeature(feature.id)}
                          disabled={!canToggle}
                        />
                      </div>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditFeature(feature)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(feature)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feature</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{featureToDelete?.name}"? This action cannot be undone.
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

