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
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">Product</Label>
        <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md bg-muted/20">
          <div className="text-center">
            <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Create the product</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">Product</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
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
  );
};

