import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Spinner } from '@/components/ui/spinner';
import { enhancedApi, getErrorMessage } from '@/shared/api/enhanced-client';
import { createUser } from '@/entities/user/api/user';
import { getProducts } from '@/entities/product/api/product';
import { type Product } from '@/entities/product';
import { toast } from 'sonner';
import { createUserSchema, type CreateUserInput } from '@/lib/validations/user';
import { measurePerformance } from '@/lib/sentry-config';
import { sanitizeString } from '@/lib/sanitization';
import { cn } from '@/lib/utils';

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

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      username: '',
      password: '',
      first_name: '',
      last_name: '',
      email: '',
      token_balance: 0,
      work_duration_days: 7,
      selected_products: [],
      selected_rbac_role: undefined,
    },
  });

  const [loading, setLoading] = useState(false);
  const [rbacLoading, setRbacLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);

  const [rbacError, setRbacError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const loadRoles = useCallback(async () => {
    try {
      setRbacLoading(true);
      setRbacError(null);
      const response = await enhancedApi.get('/api/rbac/roles');
      setRoles(response.data.roles || []);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setRbacError(errorMessage);
    } finally {
      setRbacLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      setProductsError(null);
      const response = await getProducts('all');
      setProducts(response.products || []);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setProductsError(errorMessage);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadRoles();
      loadProducts();
    }
  }, [open, loadRoles, loadProducts]);

  useEffect(() => {
    if (!open) {
      form.reset({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        token_balance: 0,
        work_duration_days: 7,
        selected_products: [],
        selected_rbac_role: undefined,
      });
      setRbacError(null);
      setProductsError(null);
    }
  }, [open, form]);

  const handleCreate = form.handleSubmit(
    async (data) => {
      try {
        setLoading(true);

        const userData = {
          username: data.username,
          password: data.password,
          first_name: data.first_name || undefined,
          last_name: data.last_name || undefined,
          email: data.email || undefined,
          token_balance: data.token_balance,
          work_duration_days: data.work_duration_days,
          product_ids: Array.isArray(data.selected_products) ? data.selected_products : [],
          rbac_role_ids: data.selected_rbac_role ? [data.selected_rbac_role] : []
        };
        
        await measurePerformance(
          'user_creation',
          () => createUser(userData),
          {
            has_email: !!data.email,
            has_products: data.selected_products.length > 0,
            has_role: !!data.selected_rbac_role,
            token_balance: data.token_balance,
          }
        );

        toast.success('Employee created successfully');
        onOpenChange(false);
        onSuccess();
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    (errors) => {
      toast.error('Please fill in all required fields');
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 sm:p-6 border-b flex-shrink-0">
          <DialogTitle className="text-base">Create Employee</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Create a new employee in the system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleCreate} className="flex-1 flex flex-col min-h-0">
            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter username"
                        disabled={loading}
                        className="text-base sm:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Min 8 chars"
                        disabled={loading}
                        className="text-base sm:text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="First name"
                          disabled={loading}
                          className="text-base sm:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Last name"
                          disabled={loading}
                          className="text-base sm:text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter email"
                        disabled={loading}
                        className="text-base sm:text-sm"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="token_balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token Balance</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          disabled={loading}
                          className="text-base sm:text-sm"
                          {...field}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="work_duration_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Duration (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="365"
                          disabled={loading}
                          className="text-base sm:text-sm"
                          {...field}
                          value={field.value}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="selected_rbac_role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RBAC Role *</FormLabel>
                    {rbacLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded-md">
                        <Spinner className="h-4 w-4 animate-spin" />
                        Loading roles...
                      </div>
                    ) : rbacError ? (
                      <div className="text-sm text-red-500 p-2 bg-red-50 dark:bg-red-900/10 rounded">Error: {rbacError}</div>
                    ) : (
                      <FormControl>
                        <Select
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(value) => {
                            const numValue = parseInt(value, 10);
                            if (!isNaN(numValue) && numValue > 0) {
                              field.onChange(numValue);
                              setTimeout(() => form.trigger('selected_rbac_role'), 0);
                            }
                          }}
                          disabled={loading}
                        >
                          <SelectTrigger className="text-base sm:text-sm w-full">
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
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="selected_products"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Access</FormLabel>
                    {productsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded-md">
                        <Spinner className="h-4 w-4 animate-spin" />
                        Loading products...
                      </div>
                    ) : productsError ? (
                      <div className="text-sm text-red-500 p-2 bg-red-50 dark:bg-red-900/10 rounded">Error: {productsError}</div>
                    ) : (
                      <div className="max-h-[200px] overflow-y-auto border rounded-md bg-card p-1">
                        {products.length === 0 ? (
                          <div className="text-center p-4 text-sm text-muted-foreground">No products available</div>
                        ) : (
                          products.map((product) => (
                            <div 
                              key={product.id} 
                              className="flex items-start space-x-3 p-2 hover:bg-accent/50 rounded transition-colors cursor-pointer"
                              onClick={() => {
                                if (loading) return;
                                const currentProducts = Array.isArray(field.value) ? field.value : [];
                                const productId = typeof product.id === 'number' ? product.id : parseInt(String(product.id), 10);
                                const isSelected = currentProducts
                                  .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
                                  .includes(productId);

                                if (isSelected) {
                                  field.onChange(currentProducts.filter(id => id !== productId));
                                } else {
                                  field.onChange([...currentProducts, productId]);
                                }
                              }}
                            >
                              <Checkbox
                                id={`product-${product.id}`}
                                checked={
                                  (Array.isArray(field.value) ? field.value : [])
                                    .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
                                    .includes(typeof product.id === 'number' ? product.id : parseInt(String(product.id), 10))
                                }
                                onCheckedChange={() => {}} // Handled by parent div click
                                disabled={loading}
                                className="mt-1"
                              />
                              <Label 
                                htmlFor={`product-${product.id}`} 
                                className="text-sm flex-1 cursor-pointer"
                                onClick={(e) => e.stopPropagation()} // Prevent double toggle
                              >
                                <div>
                                  <div className="font-medium">{sanitizeString(product.name)}</div>
                                  <div className="text-xs text-muted-foreground">{product.description ? sanitizeString(product.description) : 'No description'}</div>
                                </div>
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Fixed Footer */}
            <DialogFooter className="p-4 sm:p-6 border-t bg-background flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || rbacLoading || productsLoading}
                className="w-full sm:w-auto"
              >
                {loading ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : 'Create Employee'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;