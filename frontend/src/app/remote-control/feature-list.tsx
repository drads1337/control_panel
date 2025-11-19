import React from 'react'
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

const FeatureItem = React.memo(({ 
  feature, 
  loading, 
  onFeatureToggle,
  onEditFeature,
  onDeleteFeature,
  canEdit,
  canDelete,
  canToggle
}: { 
  feature: RemoteFeature;
  loading: boolean;
  onFeatureToggle: (featureId: string) => void;
  onEditFeature: (feature: RemoteFeature) => void;
  onDeleteFeature: (featureId: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canToggle: boolean;
}) => {
  return (
    <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm truncate">
              {feature.name}
            </h4>
            {feature.enabled && (
              <span className="text-xs text-muted-foreground">• Enabled</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {feature.description}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ConditionalRender permission="remote_control.toggle" fallback={null}>
          <Switch
            checked={feature.enabled}
            onCheckedChange={() => onFeatureToggle(feature.id)}
            disabled={!canToggle || loading}
          />
        </ConditionalRender>
        {canEdit && (
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            onClick={() => onEditFeature(feature)}
            disabled={loading}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
        {canDelete && (
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onDeleteFeature(feature.id)}
            disabled={loading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});

FeatureItem.displayName = 'FeatureItem';

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
      <Spinner message="Loading features..." />
    )
  }

  if (features.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="text-center">
          <Settings className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <div className="text-sm text-muted-foreground">No features in this category</div>
          <ConditionalRender permission="remote_control.create" fallback={null}>
            <Button
              onClick={() => onAddFeature('')}
              variant="default"
              size="sm"
              className="mt-3"
              disabled={!canCreate}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Feature
            </Button>
          </ConditionalRender>
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y">
      {features.map((feature) => (
        <FeatureItem
          key={feature.id}
          feature={feature}
          loading={loading}
          onFeatureToggle={onFeatureToggle}
          onEditFeature={onEditFeature}
          onDeleteFeature={onDeleteFeature}
          canEdit={canEdit}
          canDelete={canDelete}
          canToggle={canToggle}
        />
      ))}
    </div>
  )
}
