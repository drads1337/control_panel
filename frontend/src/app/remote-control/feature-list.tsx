import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Edit, Trash2, Settings } from 'lucide-react'
import { RemoteFeature } from '@/lib/remote-control-api'
import { ConditionalRender } from '@/components/rbac/conditional-render'

interface FeatureListProps {
  features: RemoteFeature[]
  loading: boolean
  onFeatureToggle: (featureId: string) => void
  onEditFeature: (feature: RemoteFeature) => void
  onDeleteFeature: (featureId: string) => void
  onAddFeature: (categoryId: string) => void
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canToggle: boolean
}

export default function FeatureList({
  features,
  loading,
  onFeatureToggle,
  onEditFeature,
  onDeleteFeature,
  onAddFeature,
  canCreate,
  canEdit,
  canDelete,
  canToggle
}: FeatureListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner message="Loading features..." />
      </div>
    )
  }

  if (features.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <Settings className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">
            No features in this category
          </p>
          <ConditionalRender permission="remote_control.create" fallback={null}>
            <Button
              onClick={() => onAddFeature('')}
              variant="outline"
              size="sm"
              disabled={!canCreate}
              title={!canCreate ? "You don't have permission to create features" : ""}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Feature
            </Button>
          </ConditionalRender>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      {features.map((feature) => (
        <Card key={feature.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">{feature.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {feature.description}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ConditionalRender permission="remote_control.toggle" fallback={null}>
                  <Switch
                    checked={feature.enabled}
                    onCheckedChange={() => onFeatureToggle(feature.id)}
                    disabled={!canToggle}
                    title={!canToggle ? "You don't have permission to toggle features" : ""}
                  />
                </ConditionalRender>

                <ConditionalRender permission="remote_control.edit" fallback={null}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditFeature(feature)}
                    disabled={!canEdit}
                    title={!canEdit ? "You don't have permission to edit features" : ""}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </ConditionalRender>

                <ConditionalRender permission="remote_control.delete" fallback={null}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteFeature(feature.id)}
                    disabled={!canDelete}
                    title={!canDelete ? "You don't have permission to delete features" : ""}
                    className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </ConditionalRender>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
