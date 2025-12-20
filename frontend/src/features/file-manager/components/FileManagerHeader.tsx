import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RefreshCw, Database, Container } from 'lucide-react';
import { ProductAgentItem } from './ProductAgentItem';
import { formatFileSize } from '../utils/file-utils';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';

interface DisplayItem {
  type: 'product' | 'agent';
  item: Product | Agent;
}

export interface FileManagerHeaderProps {
  targetType: 'product' | 'agent';
  filteredProductsCount: number;
  agentsCount: number;
  isLoadingProducts: boolean;
  showTargetTypeToggle: boolean;
  displayItems: DisplayItem[];
  selectedProduct: Product | null;
  selectedAgent: Agent | null;
  stats: {
    total: number;
    totalSize: number;
  };
  onTargetTypeChange: (value: 'product' | 'agent') => void;
  onRefresh: () => void;
  onSelectProduct: (product: Product) => void;
  onSelectAgent: (agent: Agent) => void;
  onClearSelection: () => void;
}

/**
 * Заголовок FileManager с селектором продукта/агента.
 * Содержит переключатель типа, список элементов и кнопку обновления.
 */
export function FileManagerHeader({
  targetType,
  filteredProductsCount,
  agentsCount,
  isLoadingProducts,
  showTargetTypeToggle,
  displayItems,
  selectedProduct,
  selectedAgent,
  stats,
  onTargetTypeChange,
  onRefresh,
  onSelectProduct,
  onSelectAgent,
  onClearSelection,
}: FileManagerHeaderProps) {
  const itemsCount =
    targetType === 'product'
      ? filteredProductsCount
      : agentsCount + filteredProductsCount;

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Select Product</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {itemsCount} {targetType === 'product' ? 'products' : 'items'} available
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isLoadingProducts}
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {showTargetTypeToggle && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type</Label>
            <ToggleGroup
              type="single"
              value={targetType}
              onValueChange={(value) => value && onTargetTypeChange(value as 'product' | 'agent')}
              className="grid grid-cols-2 w-full"
            >
              <ToggleGroupItem
                value="product"
                className="flex items-center justify-center gap-2 h-8 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Database className="h-3 w-3" /> Product
              </ToggleGroupItem>
              <ToggleGroupItem
                value="agent"
                className="flex items-center justify-center gap-2 h-8 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Container className="h-3 w-3" /> Agent
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        <div className="divide-y max-h-[200px] overflow-y-auto">
          {displayItems.map(({ type, item }) => {
            const isSelected =
              type === 'agent'
                ? selectedAgent?.id === item.id
                : selectedProduct?.id === item.id;

            const handleClick = () => {
              if (type === 'agent') {
                onSelectAgent(item as Agent);
                onClearSelection();
              } else {
                onSelectProduct(item as Product);
                onClearSelection();
              }
            };

            return (
              <ProductAgentItem
                key={`${type}-${item.id}`}
                item={item}
                type={type}
                isSelected={isSelected}
                stats={isSelected ? stats : undefined}
                formatFileSize={formatFileSize}
                onClick={handleClick}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
