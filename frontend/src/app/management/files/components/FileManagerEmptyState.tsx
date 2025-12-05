import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus } from 'lucide-react';

export interface FileManagerEmptyStateProps {
  targetType: 'product' | 'agent';
  onSwitchToProductDatabase?: () => void;
}

/**
 * Компонент пустого состояния FileManager.
 * Отображается когда нет продуктов/агентов.
 */
export function FileManagerEmptyState({
  targetType,
  onSwitchToProductDatabase,
}: FileManagerEmptyStateProps) {
  return (
    <Card className="border-dashed border-2 border-muted-foreground/25">
      <CardContent className="p-12">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FolderOpen className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold mb-3">
            {targetType === 'product' ? 'No Products Yet' : 'No Agents Yet'}
          </h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
            {targetType === 'product'
              ? 'Get started by creating your first product.'
              : 'Get started by creating your first agent.'}
          </p>
          {onSwitchToProductDatabase && (
            <Button onClick={onSwitchToProductDatabase} className="gap-2" size="lg">
              <Plus className="h-5 w-5" />
              {targetType === 'product' ? 'Create Product' : 'Create Agent'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
