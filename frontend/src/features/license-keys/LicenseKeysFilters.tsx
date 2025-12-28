"use client"

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  viewMode?: 'my' | 'all';
  onViewModeChange?: (mode: 'my' | 'all') => void;
  canViewAll?: boolean;
}

const LicenseKeysFilters = React.memo<LicenseKeysFiltersProps>(({
  filters,
  onFiltersChange,
  products,
  onClearFilters,
  viewMode,
  onViewModeChange,
  canViewAll
}) => {
  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const isFiltered = filters.status !== 'all' || filters.productId !== 'all' || filters.search !== '';
  const showViewToggle = canViewAll && onViewModeChange;

  return (
    <div className="w-full space-y-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        
        {/* LEFTSIDE: Search & View Mode */}
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center lg:flex-none">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-[320px]">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by key or note..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              // Изменено на h-9 для компактности
              className="h-9 w-full pl-9 bg-background"
            />
          </div>

          {/* View Mode Tabs */}
          {showViewToggle && (
            <Tabs 
              value={viewMode} 
              onValueChange={(value) => onViewModeChange?.(value as 'my' | 'all')}
              className="w-full sm:w-auto sm:min-w-[200px]"
            >
              <Label htmlFor="view-mode-selector" className="sr-only">
                View Mode
              </Label>
              <Select value={viewMode} onValueChange={(value) => onViewModeChange?.(value as 'my' | 'all')}>
                <SelectTrigger
                  className="flex w-fit h-7 text-xs md:hidden"
                  size="sm"
                  id="view-mode-selector"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="my" className="text-xs">My Keys</SelectItem>
                  <SelectItem value="all" className="text-xs">All Keys</SelectItem>
                </SelectContent>
              </Select>
              <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden h-8 **:data-[slot=badge]:size-4 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 **:data-[slot=tabs-trigger]:text-xs md:flex">
                <TabsTrigger value="my">My Keys</TabsTrigger>
                <TabsTrigger value="all">All Keys</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {/* RIGHTSIDE: Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap lg:justify-end">
          
          {/* Product Filter */}
          <div className="w-full sm:w-[200px]">
            <Select
              value={filters.productId}
              onValueChange={(value) => handleFilterChange('productId', value)}
            >
              {/* Изменено на h-9 */}
              <SelectTrigger className="h-9 w-full bg-background text-xs">
                <SelectValue placeholder="All Products" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all" className="text-xs">All Products</SelectItem>
                {products?.map((product) => (
                  <SelectItem key={product.id} value={product.id.toString()} className="text-xs">
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-[160px]">
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              {/* Изменено на h-9 */}
              <SelectTrigger className="h-9 w-full bg-background text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="active" className="text-xs">Active</SelectItem>
                <SelectItem value="expired" className="text-xs">Expired</SelectItem>
                <SelectItem value="paused" className="text-xs">Paused</SelectItem>
                <SelectItem value="blocked" className="text-xs">Blocked</SelectItem>
                <SelectItem value="archived" className="text-xs">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Button */}
          {isFiltered && (
             <Button
               variant="outline"
               onClick={onClearFilters}
               // Изменено на h-9, чтобы совпадать с Select.
               // sm:w-auto предотвращает растягивание на мобильных, если не нужно
               className="h-9 px-3 w-full sm:w-auto mt-1 sm:mt-0"
             >
               Reset
             </Button>
           )}
        </div>
      </div>

      {/* ACTIVE FILTERS ROW (Badges) */}
      {isFiltered && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground mr-1">Active filters:</span>
          
          {filters.search && (
            <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
              Search: <span className="font-medium text-foreground">{filters.search}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                onClick={() => handleFilterChange('search', '')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filters.productId !== 'all' && (
            <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
              Product: <span className="font-medium text-foreground">{products.find(p => p.id.toString() === filters.productId)?.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                onClick={() => handleFilterChange('productId', 'all')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          
          {filters.status !== 'all' && (
            <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal capitalize">
              Status: <span className="font-medium text-foreground">{filters.status}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 ml-1 hover:bg-transparent text-muted-foreground hover:text-foreground"
                onClick={() => handleFilterChange('status', 'all')}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

           <Button
             variant="ghost"
             onClick={onClearFilters}
             className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground sm:hidden"
           >
             Reset all
           </Button>
        </div>
      )}
    </div>
  );
});

LicenseKeysFilters.displayName = 'LicenseKeysFilters';

export default LicenseKeysFilters;