import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

interface ProductSelectionCheckboxProps {
  productId: number;
  isSelected: boolean;
  onToggleSelection: (productId: number) => void;
}

export const ProductSelectionCheckbox: React.FC<ProductSelectionCheckboxProps> = React.memo(({
  productId,
  isSelected,
  onToggleSelection,
}) => {
  return (
    <Checkbox
      checked={isSelected}
      onCheckedChange={() => onToggleSelection(productId)}
      onClick={(e) => e.stopPropagation()}
    />
  );
});

ProductSelectionCheckbox.displayName = 'ProductSelectionCheckbox';



