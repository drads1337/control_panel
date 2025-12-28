import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface LicenseKeysFiltersProps {
  filters: {
    status: string;
    productId: string;
    search: string;
  };
  onFiltersChange: (filters: { status: string; productId: string; search: string }) => void;
  products: Array<{ id: number; name: string; is_multi_app: boolean }>;
  onClearFilters: () => void;
}

const LicenseKeysFilters: React.FC<LicenseKeysFiltersProps> = React.memo(({
  filters,
  onFiltersChange,
  products,
  onClearFilters
}) => {
  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const hasActiveFilters = filters.status !== 'all' || filters.productId !== 'all' || filters.search !== '';

  return (
    <div className="space-y-4">
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Search</Label>
          <div className="relative ml-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              placeholder="Search by key, product, or user..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 h-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => handleFilterChange('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Product</Label>
          <Select
            value={filters.productId}
            onValueChange={(value) => handleFilterChange('productId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id.toString()}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.status !== 'all' && (
            <div className="flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
              <span>Status: {filters.status}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFilterChange('status', 'all')}
                className="h-auto p-0 ml-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {filters.productId !== 'all' && (
            <div className="flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
              <span>Product: {products.find(p => p.id.toString() === filters.productId)?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFilterChange('productId', 'all')}
                className="h-auto p-0 ml-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {filters.search && (
            <div className="flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
              <span>Search: {filters.search}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleFilterChange('search', '')}
                className="h-auto p-0 ml-1"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

LicenseKeysFilters.displayName = 'LicenseKeysFilters';

export default LicenseKeysFilters;

