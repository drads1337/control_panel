import React from 'react';

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
    <input
      type="checkbox"
      className="rounded border-gray-300"
      checked={isSelected}
      onChange={() => onToggleSelection(productId)}
      onClick={(e) => e.stopPropagation()}
    />
  );
});

ProductSelectionCheckbox.displayName = 'ProductSelectionCheckbox';

