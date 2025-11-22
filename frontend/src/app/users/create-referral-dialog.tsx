import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { sanitizeString } from '@/lib/sanitization';

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  is_system_role: boolean;
  user_count: number;
  created_at: string;
  updated_at?: string;
}

interface CreateReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
  onGenerate: () => void;
  loading: boolean;
  form: {
    code: string;
    expires_days: number;
    work_duration_days: number;
    selected_products: number[];
    selected_rbac_role: number | null;
    token_balance: number;
  };
  onFormChange: (form: any) => void;
  roles: Role[];
  products: any[];
  rbacLoading: boolean;
  rbacError: string | null;
  productsLoading: boolean;
  productsError: string | null;
}

const CreateReferralDialog: React.FC<CreateReferralDialogProps> = ({
  open,
  onOpenChange,
  onCreate,
  onGenerate,
  loading,
  form,
  onFormChange,
  roles,
  products,
  rbacLoading,
  rbacError,
  productsLoading,
  productsError
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Create Referral Code</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Create a referral code. Users will enter their own username and information when they register with this code.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="referral-code">Referral Code *</Label>
            <div className="flex space-x-2">
              <Input
                id="referral-code"
                value={form.code}
                onChange={(e) => onFormChange({...form, code: e.target.value})}
                placeholder="Enter a code or generate automatically"
                disabled={loading}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={onGenerate}
                disabled={loading}
              >
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Users will use this code to register and will enter their own username, password, etc.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires-days">Code Expires in (days)</Label>
            <Input
              id="expires-days"
              type="number"
              value={form.expires_days}
              onChange={(e) => onFormChange({...form, expires_days: parseInt(e.target.value) || 7})}
              min="1"
              max="365"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              How many days until the referral code expires (optional, default: 7 days)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="work-duration-days">Employee Work Duration (days)</Label>
            <Input
              id="work-duration-days"
              type="number"
              value={form.work_duration_days}
              onChange={(e) => onFormChange({...form, work_duration_days: parseInt(e.target.value) || 7})}
              min="1"
              max="365"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              How long the employee will work (when their access expires)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token-balance">Token Balance</Label>
            <Input
              id="token-balance"
              type="number"
              value={form.token_balance}
              onChange={(e) => onFormChange({...form, token_balance: parseInt(e.target.value) || 0})}
              min="0"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>RBAC Role *</Label>
            {rbacLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4 animate-spin" />
                Loading roles...
              </div>
            ) : rbacError ? (
              <div className="text-sm text-red-500">Error loading roles: {rbacError}</div>
            ) : (
              <Select 
                value={form.selected_rbac_role?.toString() || ""} 
                onValueChange={(value) => 
                  onFormChange({
                    ...form,
                    selected_rbac_role: value ? parseInt(value) : null
                  })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles
                    .filter(role => role.name !== 'client')
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id.toString()}>
                        {role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Product Access</Label>
            {productsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4 animate-spin" />
                Loading products...
              </div>
            ) : productsError ? (
              <div className="text-sm text-red-500">Error loading products: {productsError}</div>
            ) : (
              <div className="max-h-[150px] overflow-y-auto border rounded-md p-2 space-y-2">
                {products.map((product) => (
                  <div key={product.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`referral-code-product-${product.id}`}
                      checked={form.selected_products.includes(product.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onFormChange({
                            ...form,
                            selected_products: [...form.selected_products, product.id]
                          })
                        } else {
                          onFormChange({
                            ...form,
                            selected_products: form.selected_products.filter(id => id !== product.id)
                          })
                        }
                      }}
                      disabled={loading}
                    />
                    <Label htmlFor={`referral-code-product-${product.id}`} className="text-sm">
                      <div>
                        <div className="font-medium">{sanitizeString(product.name)}</div>
                        <div className="text-xs text-muted-foreground">{product.description ? sanitizeString(product.description) : 'No description'}</div>
                      </div>
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={loading}>
            {loading ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : 'Create Referral Code'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReferralDialog;
