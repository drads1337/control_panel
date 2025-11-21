import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { getProducts } from '@/entities/product';
import type { Product } from '@/entities/product';
import { enhancedApi } from '@/shared/api/enhanced-client';
import { 
  Coins, 
  Save, 
  RefreshCw, 
  Edit2, 
  Trash2,
  X,
  Plus
} from 'lucide-react';

interface ProductPrice {
  period: string;
  price: number;
}

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

const commonDurations = [
  { value: '1', label: '1 hour' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '1 day' },
  { value: '72', label: '3 days' },
  { value: '168', label: '1 week' },
  { value: '336', label: '2 weeks' },
  { value: '720', label: '1 month' },
  { value: '2160', label: '3 months' },
  { value: '4320', label: '6 months' },
  { value: '8760', label: '1 year' },
] as const;

const PriceManager: React.FC<PriceManagerProps> = ({ open, onOpenChange, productId }) => {
  // All hooks must be called unconditionally and in the same order
  const { user, token } = useAuth();
  const { hasPermission } = usePermissions();

  const canEditProducts = hasPermission('products.edit');

  const [product, setProduct] = useState<ProductData | null>(null);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPrices, setEditingPrices] = useState<{[key: string]: number}>({});
  const [editingPricesDisplay, setEditingPricesDisplay] = useState<{[key: string]: string}>({});

  useEffect(() => {
    // Reset loading state when dialog closes
    if (!open) {
      setLoading(false);
      return;
    }

    // Don't load if missing required data
    if (!productId || !user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadProductData = async () => {
      try {
        setLoading(true);

        const productsResponse = await getProducts('all');
        if (cancelled) return;

        const foundProduct = productsResponse.products.find(g => g.id === productId);

        if (!foundProduct) {
          throw new Error('Product not found');
        }

        if (cancelled) return;
        setProduct(foundProduct);

        const pricesResponse = await enhancedApi.get(`/api/products/${productId}/prices`, {
          timeout: 10000, // 10 second timeout
        });
        if (cancelled) return;

        const pricesData = pricesResponse.data;

        const pricesArray = Object.entries(pricesData.prices || {}).map(([period, price]) => ({
          period,
          price: price as number
        }));
        
        if (cancelled) return;
        setPrices(pricesArray);

        const editingState: {[key: string]: number} = {};
        const editingDisplayState: {[key: string]: string} = {};
        pricesArray.forEach(price => {
          editingState[price.period] = price.price;
          // Preserve decimal representation for display
          editingDisplayState[price.period] = price.price % 1 === 0 
            ? price.price.toString() 
            : price.price.toFixed(4).replace(/\.?0+$/, '');
        });
        setEditingPrices(editingState);
        setEditingPricesDisplay(editingDisplayState);
      } catch (error: any) {
        if (cancelled) return;

        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to load prices';
        toast.warning(`Failed to load prices: ${errorMessage}. Using an empty state.`);
        setPrices([]);
        setEditingPrices({});
        setEditingPricesDisplay({});
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProductData();

    return () => {
      cancelled = true;
    };
  }, [open, productId, user]);

  const handlePriceChange = (period: string, value: string) => {
    // Allow empty string for clearing
    if (value === '') {
      setEditingPricesDisplay(prev => ({
        ...prev,
        [period]: ''
      }));
      setEditingPrices(prev => ({
        ...prev,
        [period]: 0
      }));
      return;
    }

    // Remove all characters except digits and dot
    const cleanValue = value.replace(/[^0-9.]/g, '');

    // Prevent multiple dots
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) return;

    // Limit decimal places to 4
    if (cleanValue.includes('.')) {
      const parts = cleanValue.split('.');
      if (parts[1] && parts[1].length > 4) return;
    }

    // Update display value (keep as string to preserve decimal point)
    setEditingPricesDisplay(prev => ({
      ...prev,
      [period]: cleanValue
    }));

    // Update numeric value for validation and submission
    const numValue = cleanValue === '' || cleanValue === '.' ? 0 : Math.max(0, parseFloat(cleanValue) || 0);
    setEditingPrices(prev => ({
      ...prev,
      [period]: numValue
    }));
  };

  const handleSavePrices = async () => {
    if (!productId) {
      toast.error('Product ID is missing');
      return;
    }
    
    // Token is not required if using cookie-based auth (enhancedApi uses withCredentials: true)
    if (!user) {
      toast.error('You must be logged in to save prices');
      return;
    }

    const hasValidPrices = Object.values(editingPrices).some(price => price > 0);
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

      // Reload prices after saving
      try {
        const pricesResponse = await enhancedApi.get(`/api/products/${productId}/prices`, {
          timeout: 10000,
        });
        const pricesData = pricesResponse.data;
        const pricesArray = Object.entries(pricesData.prices || {}).map(([period, price]) => ({
          period,
          price: price as number
        }));
        setPrices(pricesArray);
        const editingState: {[key: string]: number} = {};
        const editingDisplayState: {[key: string]: string} = {};
        pricesArray.forEach(price => {
          editingState[price.period] = price.price;
          // Preserve decimal representation for display
          editingDisplayState[price.period] = price.price % 1 === 0 
            ? price.price.toString() 
            : price.price.toFixed(4).replace(/\.?0+$/, '');
        });
        setEditingPrices(editingState);
        setEditingPricesDisplay(editingDisplayState);
      } catch (error: any) {
        // Silently fail on reload, prices were already saved
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to save prices';
      toast.error(`Failed to save prices: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPeriod = (period: string) => {
    if (!editingPrices[period]) {
      setEditingPrices(prev => ({
        ...prev,
        [period]: 0
      }));
      setEditingPricesDisplay(prev => ({
        ...prev,
        [period]: '0'
      }));
    }
  };

  const handleRemovePeriod = (period: string) => {
    setEditingPrices(prev => {
      const newPrices = { ...prev };
      delete newPrices[period];
      return newPrices;
    });
    setEditingPricesDisplay(prev => {
      const newDisplay = { ...prev };
      delete newDisplay[period];
      return newDisplay;
    });
  };

  const getPeriodLabel = (period: string) => {
    const duration = commonDurations.find(d => d.value === period);
    return duration ? duration.label : period;
  };

  // Always render Dialog to maintain hook order
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            {!canEditProducts ? 'Access Denied' : 'Price Management'}
          </DialogTitle>
          <DialogDescription>
            {!canEditProducts 
              ? 'You don\'t have permission to manage prices.'
              : (product ? `Configure prices for the product "${product.name}"` : 'Configure prices for the product')
            }
          </DialogDescription>
        </DialogHeader>

        {!canEditProducts ? (
          <div className="p-4 text-center text-muted-foreground">
            You don't have permission to manage prices.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center p-8 min-h-[200px]">
            <Spinner message="Loading..." />
          </div>
        ) : (
          <Card>
          <CardHeader>
            <CardTitle>Prices in Tokens</CardTitle>
            <CardDescription>
              Set prices for different access periods.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {commonDurations.map(duration => (
                <div key={duration.value} className="flex flex-col gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium text-sm">
                      {duration.label}
                    </Label>
                    {editingPrices[duration.value] !== undefined && (
                      <ConditionalRender permission="products.edit" fallback={null}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePeriod(duration.value)}
                          className="text-destructive hover:text-destructive h-6 w-6 p-0"
                          disabled={saving || !canEditProducts}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </ConditionalRender>
                    )}
                  </div>

                  {editingPrices[duration.value] !== undefined ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="0"
                        value={editingPricesDisplay[duration.value] !== undefined ? editingPricesDisplay[duration.value] : ''}
                        onChange={(e) => handlePriceChange(duration.value, e.target.value)}
                        className="flex-1"
                        disabled={saving || !canEditProducts}
                        inputMode="decimal"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">tokens</span>
                    </div>
                  ) : (
                    <ConditionalRender permission="products.edit" fallback={null}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddPeriod(duration.value)}
                        className="flex items-center gap-1 w-full"
                        disabled={saving || !canEditProducts}
                      >
                        <Plus className="h-3 w-3" />
                        Add Price
                      </Button>
                    </ConditionalRender>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSavePrices();
              }}
              disabled={saving || !canEditProducts}
              className="flex items-center gap-2"
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Saving...' : 'Save Prices'}
            </Button>
          </CardFooter>
        </Card>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PriceManager;