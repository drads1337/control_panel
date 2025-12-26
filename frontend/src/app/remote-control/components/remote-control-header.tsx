import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, Package } from 'lucide-react'
import type { Product } from '@/entities/product'

interface RemoteControlHeaderProps {
  products: Product[]
  selectedProductId: number | null
  onProductChange: (productId: number) => void
  onAddCategory: () => void
  canCreate: boolean
}

export function RemoteControlHeader({
  products,
  selectedProductId,
  onProductChange,
  onAddCategory,
  canCreate,
}: RemoteControlHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Remote Control</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={selectedProductId?.toString() || ''}
          onValueChange={(value) => onProductChange(parseInt(value))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id.toString()}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canCreate && selectedProductId && (
          <Button onClick={onAddCategory} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        )}
      </div>
    </div>
  )
}

