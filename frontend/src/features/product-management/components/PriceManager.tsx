"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { useAuthContext } from '@/app/providers/auth-provider';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { getProducts } from '@/entities/product/api/product';
import { enhancedApi } from '@/shared/api/enhanced-client';
import { getErrorMessage } from '@/shared/lib/utils/error-utils';

// --- Types & Constants ---

interface ProductData {
  id: number;
  name: string;
  is_multi_app: boolean;
}

interface PriceManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: number;
}

const COMMON_DURATIONS = [
  { value: '1', label: '1 hour' },
    { value: '6', label: '6 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '1 day' },
  { value: '72', label: '3 days' },
  { value: '168', label: '1 week' },
  { value: '336', label: '2 weeks' },
  { value: '720', label: '1 month' },
  { value: '1440', label: '2 months' },
  { value: '2160', label: '3 months' },
  { value: '4320', label: '6 months' },
  { value: '8760', label: '1 year' },
] as const;

// --- Helper Functions ---

/**
 * Validates and cleans the price input string.
 * Allows digits, one dot, and max 4 decimal places.
 */
const cleanPriceInput = (value: string): string | null => {
  if (value === '') return '';

  // Remove all characters except digits and dot
  const cleanValue = value.replace(/[^0-9.]/g, '');

  // Prevent multiple dots
  const dotCount = (cleanValue.match(/\./g) || []).length;
  if (dotCount > 1) return null;

  // Limit decimal places to 4
  if (cleanValue.includes('.')) {
    const parts = cleanValue.split('.');
    if (parts[1] && parts[1].length > 4) return null;
  }

  return cleanValue;
};

// --- Sub-Components ---

interface PriceRowProps {
  label: string;
  period: string;
  displayValue: string | undefined; // undefined means not active
  isActive: boolean;
  disabled: boolean;
  onAdd: (period: string) => void;
  onRemove: (period: string) => void;
  onChange: (period: string, value: string) => void;
}

const PriceRow = ({
  label,
  period,
  displayValue,
  isActive,
  disabled,
  onAdd,
  onRemove,
  onChange
}: PriceRowProps) => {
  return (
    <div className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-between">
        <Label className="font-medium text-xs">{label}</Label>
        
        {isActive && (
          <ConditionalRender permission="products.edit" fallback={null}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(period)}
              className="text-destructive hover:text-destructive h-6 w-6 p-0"
              disabled={disabled}
            >
              ×
            </Button>
          </ConditionalRender>
        )}
      </div>

      {isActive ? (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="0"
            value={displayValue || ''}
            onChange={(e) => onChange(period, e.target.value)}
            className="flex-1 h-8 text-xs"
            disabled={disabled}
            inputMode="decimal"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">tokens</span>
        </div>
      ) : (
        <ConditionalRender permission="products.edit" fallback={null}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdd(period)}
            className="w-full h-8 text-xs"
            disabled={disabled}
          >
            Add Price
          </Button>
        </ConditionalRender>
      )}
    </div>
  );
};

// --- Main Component ---

export default function PriceManager({ open, onOpenChange, productId }: PriceManagerProps) {
  const { user } = useAuthContext();
  const { hasPermission } = usePermissions();
  const canEditProducts = hasPermission('products.edit');

  // State
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // We keep two states: 
  // 1. `editingPrices` (Number) for API logic
  // 2. `editingPricesDisplay` (String) for UI input control
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [editingPricesDisplay, setEditingPricesDisplay] = useState<Record<string, string>>({});

  // --- Data Loading Logic ---

  const fetchProductAndPrices = useCallback(async () => {
    if (!productId || !user) return;

    try {
      setLoading(true);

      // 1. Fetch Product Info
      const productsResponse = await getProducts('all');
      const foundProduct = productsResponse.products.find(g => g.id === productId);

      if (!foundProduct) throw new Error('Product not found');
      setProduct(foundProduct);

      // 2. Fetch Prices
      const pricesResponse = await enhancedApi.get(`/api/products/${productId}/prices`, {
        timeout: 10000,
      });

      const pricesData = pricesResponse.data.prices || {};

      // 3. Initialize State
      const nextNumericState: Record<string, number> = {};
      const nextDisplayState: Record<string, string> = {};

      Object.entries(pricesData).forEach(([period, price]) => {
        const numPrice = price as number;
        nextNumericState[period] = numPrice;
        // Format: preserve integer looking like int, float looking like float (max 4 decimals)
        nextDisplayState[period] = numPrice % 1 === 0 
          ? numPrice.toString() 
          : numPrice.toFixed(4).replace(/\.?0+$/, '');
      });

      setEditingPrices(nextNumericState);
      setEditingPricesDisplay(nextDisplayState);

    } catch (error: unknown) {
      toast.warning(`Failed to load prices: ${getErrorMessage(error)}. Using empty state.`);
      setEditingPrices({});
      setEditingPricesDisplay({});
    } finally {
      setLoading(false);
    }
  }, [productId, user]);

  useEffect(() => {
    if (!open) {
      setLoading(false); 
      return;
    }
    fetchProductAndPrices();
  }, [open, fetchProductAndPrices]);

  // --- Handlers ---

  const handlePriceChange = (period: string, rawValue: string) => {
    const cleanValue = cleanPriceInput(rawValue);
    if (cleanValue === null) return; // Invalid input ignored

    // Update UI state
    setEditingPricesDisplay(prev => ({
      ...prev,
      [period]: cleanValue
    }));

    // Update Data state (handle empty string or just "." as 0)
    const numValue = (cleanValue === '' || cleanValue === '.') 
      ? 0 
      : Math.max(0, parseFloat(cleanValue) || 0);

    setEditingPrices(prev => ({
      ...prev,
      [period]: numValue
    }));
  };

  const handleAddPeriod = (period: string) => {
    setEditingPrices(prev => ({ ...prev, [period]: 0 }));
    setEditingPricesDisplay(prev => ({ ...prev, [period]: '0' }));
  };

  const handleRemovePeriod = (period: string) => {
    const removeKey = <T extends Record<string, any>>(obj: T, key: string): T => {
      const { [key]: _, ...rest } = obj;
      return rest as T;
    };

    setEditingPrices(prev => removeKey(prev, period));
    setEditingPricesDisplay(prev => removeKey(prev, period));
  };

  const handleSavePrices = async () => {
    if (!productId || !user) {
      toast.error('Authentication or Product ID missing');
      return;
    }

    const hasValidPrices = Object.values(editingPrices).some(p => p > 0);
    if (!hasValidPrices) {
      toast.warning('Set at least one price greater than 0');
      return;
    }

    try {
      setSaving(true);
      await enhancedApi.put(`/api/products/${productId}/prices`, {
        prices: editingPrices
      });
      toast.success('Prices saved successfully');
      
      // Refresh data to ensure sync
      await fetchProductAndPrices();
    } catch (error: unknown) {
      toast.error(`Failed to save prices: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  // --- Render Helpers ---

  const renderContent = () => {
    if (!canEditProducts) {
      return (
        <div className="p-4 text-center text-xs text-muted-foreground">
          You don't have permission to manage prices.
        </div>
      );
    }

    if (loading) {
      return (
        <div className="p-4 flex items-center justify-center min-h-[200px] gap-2">
          <Spinner />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
          {COMMON_DURATIONS.map((duration) => (
            <PriceRow
              key={duration.value}
              period={duration.value}
              label={duration.label}
              isActive={editingPrices[duration.value] !== undefined}
              displayValue={editingPricesDisplay[duration.value]}
              disabled={saving}
              onAdd={handleAddPeriod}
              onRemove={handleRemovePeriod}
              onChange={handlePriceChange}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              handleSavePrices();
            }}
            disabled={saving}
            className="h-8 text-xs min-w-[80px]"
          >
            {saving ? (
              <>
                <Spinner className="mr-2 h-3 w-3" />
                Saving...
              </>
            ) : (
              'Save Prices'
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              {!canEditProducts ? 'Access Denied' : 'Price Management'}
            </DialogTitle>
            <DialogDescription className="text-xs break-words">
              {!canEditProducts 
                ? "You don't have permission to manage prices."
                : product 
                  ? <>Configure prices for <span className="font-medium">"{product.name}"</span></>
                  : 'Configure prices for the product'
              }
            </DialogDescription>
          </div>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}