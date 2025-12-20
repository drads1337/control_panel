import React from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Product } from '@/entities/product'

interface RemoteControlHeaderProps {
  selectedProductId: number | null
  products: Product[]
  productsLoading: boolean
  loading: boolean
  onProductChange: (productId: number) => void
  onRefresh: () => void
}

export default function RemoteControlHeader({
  selectedProductId,
  products,
  productsLoading,
  loading,
  onProductChange,
  onRefresh
}: RemoteControlHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedProductId?.toString() || ''}
        onValueChange={(value) => onProductChange(parseInt(value))}
        disabled={productsLoading}
      >
        <SelectTrigger className="flex-1 h-9 sm:h-10">
          <SelectValue placeholder="Select product" />
        </SelectTrigger>
        <SelectContent>
          {products.map((product) => (
            <SelectItem key={product.id} value={product.id.toString()}>
              {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button 
        variant="ghost" 
        size="icon"
        onClick={onRefresh}
        disabled={loading || !selectedProductId}
        className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
        title="Refresh data"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}