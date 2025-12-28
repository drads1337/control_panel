import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database } from 'lucide-react';

interface ProductSelectorProps {
  products: Array<{ id: number; name: string }>;
  value: string;
  onChange: (value: string) => void;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({ products, value, onChange }) => {
  if (products.length === 0) {
    return (
      <div className="space-y-1">
        <Label className="text-xs">Product</Label>
        <div className="h-8 px-2 flex items-center border border-dashed border-muted-foreground/25 rounded-md bg-muted/20 text-[10px] text-muted-foreground leading-tight">
          Create the product
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs">Product</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="text-xs h-8">
          <SelectValue placeholder="Select Product" />
        </SelectTrigger>
        <SelectContent className="text-xs">
          {products.map((product) => (
            <SelectItem key={product.id} value={product.id.toString()} className="text-xs">
              {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

