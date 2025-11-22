import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateProduct, getProductClassicUsers, toggleUserProductAccess, type ClassicUser } from '@/entities/product'
import { useAuth } from '@/hooks/use-auth';
import { useCustomNotifications } from '@/hooks/use-custom-notifications';
import { useProductPermissions } from '@/hooks/use-product-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { Checkbox } from '@/components/ui/checkbox';
import type { Product, UpdateProductData } from '@/entities/product';

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess: () => void;
}

const EditProductDialog: React.FC<EditProductDialogProps> = ({ open, onOpenChange, product, onSuccess }) => {
  const { isAuthenticated } = useAuth();
  const { canEditProducts } = useProductPermissions();

  if (!canEditProducts) {
    return null;
  }

  const { showLoadingNotification, showProductUpdateNotification, showErrorNotification, showWarningNotification } = useCustomNotifications();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateProductData>({
    name: '',
    description: '',
    version: '1.0.0',
    is_multi_app: false,
    custom_key_prefix: '',
    key_prefix_format: '',
    login_type: 'license_generation',
    invite_code_required: false
  });

  const [activeTab, setActiveTab] = useState('basic');
  const [users, setUsers] = useState<ClassicUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!product || !product.id) {

      return;
    }

    setUsersLoading(true);

    try {
      const response = await getProductClassicUsers(product.id);

      setUsers(response.users || []);
    } catch (error: unknown) {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (product && open) {
      const initialFormData = {
        name: product.name,
        description: product.description || '',
        version: product.version || '1.0.0',
        is_multi_app: product.is_multi_app || false,
        custom_key_prefix: product.custom_key_prefix || '',
        key_prefix_format: product.key_prefix_format || '{name}-{duration}-{custom}',
        login_type: (product.login_type as 'license_generation' | 'classic_login') || 'license_generation',
        invite_code_required: product.invite_code_required || false
      };

      setFormData(initialFormData);
      setActiveTab('basic');

      if (product && product.login_type === 'classic_login' && !product.is_multi_app) {
        fetchUsers();
      }
    }
  }, [product, open, fetchUsers]);

  const toggleUserAccess = async (userId: number) => {
    if (!product) return;

    try {
      const response = await toggleUserProductAccess(userId, product.id);

      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, has_access: response.has_access } : user
      ));
      showProductUpdateNotification('User access updated');
    } catch (error: unknown) {
      showErrorNotification('Error updating access');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!product) {

      return;
    }

    try {
      setLoading(true);

      showLoadingNotification('Updating product...', 'Please wait', 2000);

      await updateProduct(product.id, formData);

      showProductUpdateNotification(product.name, {
        description: `Product "${formData.name || product.name}" has been updated`,
        action: {
          label: 'View',
          onClick: () => {

          },
          variant: 'primary'
        }
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showErrorNotification('Product update error', errorMessage, {
        duration: 8000,
        action: {
          label: 'Try again',
          onClick: () => {

          },
          variant: 'outline'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!product || !canEditProducts) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base">
            Edit Product
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {product.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className={`grid w-full h-10 bg-muted border border-border rounded-lg ${!formData.is_multi_app && formData.login_type === 'classic_login' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger 
                value="basic" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200 text-sm"
              >
                Basic
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200 text-sm"
              >
                Settings
              </TabsTrigger>
              {!formData.is_multi_app && formData.login_type === 'classic_login' && (
                <TabsTrigger 
                  value="users" 
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg transition-all duration-200 text-sm"
                >
                  Users
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="basic" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Product name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version" className="text-sm">Version</Label>
                  <Input
                    id="version"
                    value={formData.version}
                    onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                    placeholder="1.0.0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Product description"
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="is_multi_app" className="text-sm">Multi App Product</Label>
                    <p className="text-xs text-muted-foreground">
                      Access to multiple products through one account
                    </p>
                  </div>
                  <Switch
                    id="is_multi_app"
                    checked={formData.is_multi_app}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_multi_app: checked }))}
                  />
                </div>

                {!formData.is_multi_app && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="login_type" className="text-sm">Login Type</Label>
                      <Select 
                        value={formData.login_type} 
                        onValueChange={(value: 'license_generation' | 'classic_login') => {
                          setFormData(prev => ({ ...prev, login_type: value }));

                          if (value === 'classic_login' && product && !formData.is_multi_app) {
                            fetchUsers();
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="license_generation">License Generation</SelectItem>
                          <SelectItem value="classic_login">Classic Login</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.login_type === 'classic_login' && (
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="invite_code_required" className="text-sm">Require Invite Code</Label>
                          <p className="text-xs text-muted-foreground">
                            Users must provide an invite code to register
                          </p>
                        </div>
                        <Switch
                          id="invite_code_required"
                          checked={formData.invite_code_required}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, invite_code_required: checked }))}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="custom_key_prefix" className="text-sm">Key Prefix</Label>
                        <Input
                          id="custom_key_prefix"
                          value={formData.custom_key_prefix}
                          onChange={(e) => setFormData(prev => ({ ...prev, custom_key_prefix: e.target.value }))}
                          placeholder="PRODUCT"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="key_prefix_format" className="text-sm">Prefix Format</Label>
                        <Input
                          id="key_prefix_format"
                          value={formData.key_prefix_format}
                          onChange={(e) => setFormData(prev => ({ ...prev, key_prefix_format: e.target.value }))}
                          placeholder="{PREFIX}-{RANDOM}"
                        />
                      </div>
                    </div>
                  </>
                )}

                {formData.is_multi_app && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/30 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Multi App Product</h4>
                    <p className="text-xs text-blue-700 mt-1 dark:text-blue-200">
                      For Multi App products, login type, prefix and key format settings are managed in the agent.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {!formData.is_multi_app && formData.login_type === 'classic_login' && (
              <TabsContent value="users" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">User Access Management</h3>
                      <p className="text-xs text-muted-foreground">
                        Select users who will have access to this product
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchUsers}
                      disabled={usersLoading}
                    >
                      {usersLoading ? 'Loading...' : 'Refresh'}
                    </Button>
                  </div>

                  {usersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-xs text-muted-foreground">Loading users...</div>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-xs text-muted-foreground">No users found</div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {users.map((user) => (
                        <div key={user.id} className="flex items-center space-x-3 p-2 border rounded-lg">
                          <Checkbox
                            id={`user-${user.id}`}
                            checked={user.has_access}
                            onCheckedChange={() => toggleUserAccess(user.id)}
                          />
                          <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{user.username}</span>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                user.has_access 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {user.has_access ? 'Access granted' : 'Access denied'}
                              </span>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <ConditionalRender permission="products.edit" fallback={null}>
              <Button 
                type="button"
                disabled={loading}
                onClick={async (e) => {
                  e.preventDefault();
                  await handleSubmit(e as any);
                }}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </ConditionalRender>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;