import React from 'react'
import { CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Database, Loader2, RefreshCw } from 'lucide-react'
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

export function RemoteControlHeader({
  selectedProductId,
  products,
  productsLoading,
  loading,
  onProductChange,
  onRefresh
}: RemoteControlHeaderProps) {
  return (
    <CardHeader className="border-b bg-muted/30 pt-3 px-3 xs:px-4 pb-3 sm:pb-0 sm:px-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 xs:gap-2.5 flex-1 min-w-0">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 sm:pt-1 sm:-mb-4">
              <Database className="h-4 w-4" />
            </div>
            
            <div className="flex-1 sm:flex-none sm:pt-1 sm:-mb-4 min-w-0">
              <Select
                value={selectedProductId?.toString() || ''}
                onValueChange={(value) => onProductChange(parseInt(value))}
                disabled={productsLoading}
              >
                <SelectTrigger id="product-select" className="w-full sm:w-[280px] h-9 border-border/50 bg-background !mt-0 !mb-0">
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
            </div>
          </div>
        </div>

        <Button 
          variant="ghost" 
          size="icon"
          onClick={onRefresh}
          disabled={loading || !selectedProductId}
          className="shrink-0 sm:pt-1 sm:-mb-4"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
    </CardHeader>
  )
}
