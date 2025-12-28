import React from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { RemoteFeature } from '@/lib/remote-control-api'
import { ConditionalRender } from '@/components/rbac/conditional-render'

interface FeatureListProps {
  features: RemoteFeature[]
  loading: boolean
  onFeatureToggle: (featureId: string) => void
  onEditFeature: (feature: RemoteFeature) => void
  onDeleteFeature: (featureId: string) => void
  onAddFeature: () => void
}

const FeatureItem = React.memo(({ 
  feature, 
  loading, 
  onFeatureToggle,
  onEditFeature,
  onDeleteFeature
}: { 
  feature: RemoteFeature;
  loading: boolean;
  onFeatureToggle: (featureId: string) => void;
  onEditFeature: (feature: RemoteFeature) => void;
  onDeleteFeature: (featureId: string) => void;
}) => {
  return (
    <div className="group flex items-center justify-between py-1.5 px-1 border-b last:border-0 hover:bg-muted/30 transition-colors rounded-sm">
      <div className="flex-1 min-w-0 pr-2 space-y-0.5">
        <h4 className="font-medium text-xs leading-none">{feature.name}</h4>
        <p className="text-[10px] text-muted-foreground truncate leading-none">
          {feature.description}
        </p>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <ConditionalRender permission="remote_control.edit" fallback={null}>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onEditFeature(feature)}
              disabled={loading}
            >
              <Edit className="h-3 w-3" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="remote_control.delete" fallback={null}>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteFeature(feature.id)}
              disabled={loading}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </ConditionalRender>
        </div>

        <ConditionalRender permission="remote_control.toggle" fallback={null}>
          <Switch
            className="scale-75 origin-right data-[state=checked]:bg-primary"
            checked={feature.enabled}
            onCheckedChange={() => onFeatureToggle(feature.id)}
            disabled={loading}
          />
        </ConditionalRender>
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
  onAddFeature
}: FeatureListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" /> 
      </div>
    )
  }

  if (features.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 border border-dashed rounded-md bg-muted/10">
        <p className="text-xs text-muted-foreground mb-2">No features here</p>
        <ConditionalRender permission="remote_control.create" fallback={null}>
          <Button
            onClick={onAddFeature}
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2.5"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Feature
          </Button>
        </ConditionalRender>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {features.map((feature) => (
        <FeatureItem
          key={feature.id}
          feature={feature}
          loading={loading}
          onFeatureToggle={onFeatureToggle}
          onEditFeature={onEditFeature}
          onDeleteFeature={onDeleteFeature}
        />
      ))}
    </div>
  )
}