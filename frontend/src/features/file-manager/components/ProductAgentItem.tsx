import { Database, Container, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';

interface ProductAgentItemProps {
  item: Product | Agent;
  type: 'product' | 'agent';
  isSelected: boolean;
  stats?: {
    total: number;
    totalSize: number;
  };
  formatFileSize: (bytes: number) => string;
  onClick: () => void;
}

/**
 * Компонент элемента продукта/агента в списке выбора
 */
export function ProductAgentItem({
  item,
  type,
  isSelected,
  stats,
  formatFileSize,
  onClick,
}: ProductAgentItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-2.5 cursor-pointer transition-colors hover:bg-accent/50',
        isSelected && 'bg-primary/5'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/10 rounded flex items-center justify-center flex-shrink-0">
          {type === 'agent' ? (
            <Container className="h-4 w-4 text-primary" />
          ) : (
            <Database className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm truncate">{item.name}</h4>
            {isSelected && <Check className="h-3 w-3 text-primary" />}
          </div>
          {isSelected && stats && (
            <p className="text-xs text-muted-foreground">
              {stats.total} files • {formatFileSize(stats.totalSize)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
