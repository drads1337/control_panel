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

  // Watch form state for debugging
  const formState = form.formState;

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

      // Use universal API function - it uses /api/products endpoint
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
      // This callback is called when validation fails
      // Show specific error messages for each field
      const errorMessages: string[] = [];
      
      if (errors.username) {
        errorMessages.push(`Username: ${errors.username.message || 'required'}`);
      }
      if (errors.password) {
        errorMessages.push(`Password: ${errors.password.message || 'required'}`);
      }
      if (errors.selected_rbac_role) {
        errorMessages.push(`RBAC Role: ${errors.selected_rbac_role.message || 'required'}`);
      }
      if (errors.token_balance) {
        errorMessages.push(`Token Balance: ${errors.token_balance.message || 'invalid'}`);
      }
      if (errors.work_duration_days) {
        errorMessages.push(`Work Duration: ${errors.work_duration_days.message || 'invalid'}`);
      }
      if (errors.first_name) {
        errorMessages.push(`First Name: ${errors.first_name.message || 'invalid'}`);
      }
      if (errors.last_name) {
        errorMessages.push(`Last Name: ${errors.last_name.message || 'invalid'}`);
      }
      if (errors.email) {
        errorMessages.push(`Email: ${errors.email.message || 'invalid'}`);
      }
      if (errors.selected_products) {
        errorMessages.push(`Products: ${errors.selected_products.message || 'invalid'}`);
      }
      
      if (errorMessages.length > 0) {
        toast.error(errorMessages.join(', '));
      } else {
        toast.error('Please fill in all required fields');
      }
    }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Create Employee</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Create a new employee in the system (not for clients)
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
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
                      placeholder="Enter password (minimum 8 characters)"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter first name"
                      disabled={loading}
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
                      placeholder="Enter last name"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      {...field}
                      value={field.value}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    How long the employee will work (when their access expires)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="selected_rbac_role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RBAC Role *</FormLabel>
                  {rbacLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="h-4 w-4 animate-spin" />
                      Loading roles...
                    </div>
                  ) : rbacError ? (
                    <div className="text-sm text-red-500">Error loading roles: {rbacError}</div>
                  ) : (
                    <FormControl>
                      <Select
                        value={field.value ? field.value.toString() : ""}
                        onValueChange={(value) => {
                          const numValue = parseInt(value, 10);
                          
                          if (!isNaN(numValue) && numValue > 0) {
                            field.onChange(numValue);
                            
                            // Trigger validation after value change
                            setTimeout(() => {
                              form.trigger('selected_rbac_role');
                            }, 0);
                          }
                        }}
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
                            id={`product-${product.id}`}
                            checked={
                              (Array.isArray(field.value) ? field.value : [])
                                .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
                                .includes(typeof product.id === 'number' ? product.id : parseInt(String(product.id), 10))
                            }
                            onCheckedChange={(checked) => {
                              const currentProducts = Array.isArray(field.value) ? field.value : [];
                              // Ensure product.id is a number
                              const productId = typeof product.id === 'number' ? product.id : parseInt(String(product.id), 10);
                              
                              if (checked) {
                                // Convert all IDs to numbers and add the new one
                                const newProducts = [
                                  ...currentProducts.map(id => typeof id === 'number' ? id : parseInt(String(id), 10)),
                                  productId
                                ].filter(id => !isNaN(id) && id > 0);
                                field.onChange(newProducts);
                              } else {
                                // Remove the product ID (convert to number for comparison)
                                const newProducts = currentProducts
                                  .map(id => typeof id === 'number' ? id : parseInt(String(id), 10))
                                  .filter(id => !isNaN(id) && id > 0 && id !== productId);
                                field.onChange(newProducts);
                              }
                            }}
                            disabled={loading}
                          />
                          <Label htmlFor={`product-${product.id}`} className="text-sm">
                            <div>
                              <div className="font-medium">{sanitizeString(product.name)}</div>
                              <div className="text-xs text-muted-foreground">{product.description ? sanitizeString(product.description) : 'No description'}</div>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || rbacLoading || productsLoading}
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
