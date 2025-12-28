import { useState, useEffect, useCallback, useRef } from 'react';
import { enhancedApi, getErrorMessage } from '@/shared/api/enhanced-client';
import { getErrorMessage as getErrorMessageUtil, getErrorStatus } from '@/lib/error-utils';
import { updateUser } from '@/entities/user/api/user';
import { getProducts, toggleUserProductAccess } from '@/entities/product/api/product';
import { toast } from 'sonner';
import type { User } from '@/entities/user';

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

interface Product {
  id: number;
  name: string;
  description: string | null;
}

interface Permission {
  [resource: string]: Array<{ id: number; name: string; description: string; action: string }>;
}

interface EditUserForm {
  first_name: string;
  last_name: string;
  email: string;
  token_balance: number;
  work_duration_days: number;
  selected_products: number[];
  selected_rbac_role: number | null;
  selected_permissions: string[];
}

export function useEditUserDialog(user: User | null, open: boolean, onSuccess: () => void) {
  const [form, setForm] = useState<EditUserForm>({
    first_name: '',
    last_name: '',
    email: '',
    token_balance: 0,
    work_duration_days: 7,
    selected_products: [],
    selected_rbac_role: null,
    selected_permissions: []
  });

  const [loading, setLoading] = useState(false);
  const [rbacLoading, setRbacLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);

  const [rbacError, setRbacError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const lastLoadedUserIdRef = useRef<number | null>(null);

  // Helper function to ensure userId is always a valid number
  const ensureNumericUserId = useCallback((userId: number | string | undefined | null): number | null => {
    if (userId === undefined || userId === null) {
      return null;
    }
    const numeric = typeof userId === 'string' ? parseInt(userId, 10) : Number(userId);
    if (isNaN(numeric) || numeric <= 0 || !Number.isInteger(numeric)) {
      return null;
    }
    return numeric;
  }, []);

  const loadRoles = useCallback(async (): Promise<Role[]> => {
    try {
      setRbacLoading(true);
      setRbacError(null);

      const response = await enhancedApi.get('/api/rbac/roles');
      
      const rolesData = response.data?.roles || response.data?.data?.roles || [];
      
      setRoles(rolesData);
      return rolesData;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setRbacError(errorMessage);
      toast.error(`Failed to load roles: ${errorMessage}`);
      return [];
    } finally {
      setRbacLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async (): Promise<Product[]> => {
    try {
      setProductsLoading(true);
      setProductsError(null);

      const response = await getProducts('all');
      
      const productsData = response?.products || [];
      
      setProducts(productsData);
      return productsData;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setProductsError(errorMessage);
      toast.error(`Failed to load products: ${errorMessage}`);
      return [];
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const loadPermissions = useCallback(async (): Promise<Permission> => {
    try {
      setPermissionsLoading(true);
      setPermissionsError(null);

      const response = await enhancedApi.get('/api/rbac/permissions');
      
      const permissionsData = (response.data?.success && response.data?.permissions) 
        ? response.data.permissions 
        : (response.data?.permissions ? response.data.permissions : {});
      
      setAvailablePermissions(permissionsData);
      return permissionsData;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setPermissionsError(errorMessage);
      toast.error(`Failed to load permissions: ${errorMessage}`);
      return {};
    } finally {
      setPermissionsLoading(false);
    }
  }, []);

  const loadUserPermissions = useCallback(async (userId: number | string): Promise<string[]> => {
    const numericUserId = ensureNumericUserId(userId);
    if (!numericUserId) {
      return [];
    }
    
    const url = `/api/rbac/users/${numericUserId}/permissions`

    try {
      const response = await enhancedApi.get(url)

      if (response.data.success && response.data.permissions) {
        const permissions = response.data.permissions as string[]
        return permissions
      }
      return []
    } catch (error: unknown) {
      const errorMessage = getErrorMessageUtil(error)
      const status = getErrorStatus(error)
      
      if (status === 404) {
        // User not found - expected for some cases
      }

      if (errorMessage.includes('Static roles cannot manage RBAC')) {
        return []
      }

      return []
    }
  }, [ensureNumericUserId])

  const loadUserProductAccess = useCallback(async (userId: number | string): Promise<number[]> => {
    const numericUserId = ensureNumericUserId(userId);
    if (!numericUserId) {
      return [];
    }
    
    const url = `/api/users/${numericUserId}/products`

    try {
      const response = await enhancedApi.get(url)

      if (Array.isArray(response.data)) {
        const accessibleProducts = response.data
          .filter((product: any) => product.has_access === true)
          .map((product: any) => {
            const id = product.product_id || product.id;
            const numId = Number(id);
            return isNaN(numId) ? null : numId;
          })
          .filter((id): id is number => id !== null);
        
        return accessibleProducts;
      }
      return []
    } catch (error: unknown) {
      const errorMessage = getErrorMessageUtil(error)
      const status = getErrorStatus(error)
      
      if (status === 404) {
        // User not found - expected for some cases
      }

      return []
    }
  }, [ensureNumericUserId])

  useEffect(() => {
    if (!open || !user) {
      if (!open) {
        lastLoadedUserIdRef.current = null;
        setUserLoading(false);
      }
      return;
    }

    const userId = ensureNumericUserId(user.id);
    
    if (!userId) {
      setUserLoading(false);
      return;
    }
    
    if (lastLoadedUserIdRef.current === userId) {
      return;
    }
    
    const currentUserId = userId;
    lastLoadedUserIdRef.current = currentUserId;
    setCurrentUser(user);
    setUserLoading(true);

    const timeoutId = setTimeout(() => {
      if (lastLoadedUserIdRef.current === currentUserId) {
        setUserLoading(false);
      }
    }, 30000);
    
    let isCancelled = false;
    
    Promise.all([
      loadRoles(),
      loadProducts(),
      loadPermissions(),
      (async () => {
        try {
          return await loadUserPermissions(currentUserId)
        } catch (e) {
          return [];
        }
      })(),
      (async () => {
        try {
          return await loadUserProductAccess(currentUserId)
        } catch (e) {
          return [];
        }
      })()
    ]).then(([loadedRoles, loadedProducts, loadedPermissions, userPermissions, userProductAccess]) => {
      clearTimeout(timeoutId);
      
      if (isCancelled || lastLoadedUserIdRef.current !== currentUserId) {
        return;
      }

      let userRoleId: number | null = null;
      if (user.rbac_roles && user.rbac_roles.length > 0) {
        userRoleId = user.rbac_roles[0].id;
      } else if (user.roles && user.roles.length > 0 && loadedRoles.length > 0) {
        const roleName = user.roles[0];
        const role = loadedRoles.find(r => r.name === roleName);
        if (role) {
          userRoleId = role.id;
        }
      }

      let workDurationDays = 7;
      if (user.expires_at) {
        const expiresDate = new Date(user.expires_at);
        const now = new Date();
        const diffMs = expiresDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        workDurationDays = diffDays > 0 ? diffDays : 7;
      }

      let defaultPermissions: string[] = [];
      if (userRoleId) {
        const role = loadedRoles.find(r => r.id === userRoleId);
        if (role && role.permissions && Array.isArray(role.permissions)) {
          defaultPermissions = role.permissions;
        }
      }

      const initialPermissions = userPermissions.length > 0 ? userPermissions : defaultPermissions;

      const formData: EditUserForm = {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        token_balance: user.token_balance || 0,
        work_duration_days: workDurationDays,
        selected_products: userProductAccess,
        selected_rbac_role: userRoleId,
        selected_permissions: initialPermissions
      };

      setForm(formData);
      setUserLoading(false);
    }).catch((error) => {
      clearTimeout(timeoutId);
      
      if (isCancelled || lastLoadedUserIdRef.current !== currentUserId) {
        return;
      }
      
      setUserLoading(false);
    });
    
    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      if (lastLoadedUserIdRef.current === currentUserId) {
        lastLoadedUserIdRef.current = null;
      }
    };
  }, [user?.id, open, loadRoles, loadProducts, loadPermissions, loadUserPermissions, loadUserProductAccess, ensureNumericUserId]);

  useEffect(() => {
    if (!open) {
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        token_balance: 0,
        work_duration_days: 7,
        selected_products: [],
        selected_rbac_role: null,
        selected_permissions: []
      });
      setCurrentUser(null);
      setRbacError(null);
      setProductsError(null);
      setPermissionsError(null);
      lastLoadedUserIdRef.current = null;
    }
  }, [open]);

  const handleUpdate = useCallback(async () => {
    if (!currentUser) return;

    const numericUserId = ensureNumericUserId(currentUser.id);
    
    if (!numericUserId) {
      toast.error('Invalid user ID. Please refresh and try again.');
      return;
    }

    try {
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        toast.error('Please enter a valid email address');
        return;
      }

      if (!form.selected_rbac_role) {
        toast.error('Please select a RBAC role');
        return;
      }

      if (!form.selected_permissions || form.selected_permissions.length === 0) {
        toast.error('At least one permission is required. Please select at least one permission.');
        return;
      }

      setLoading(true);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + form.work_duration_days);

      await updateUser(numericUserId, {
        first_name: form.first_name || undefined,
        last_name: form.last_name || undefined,
        email: form.email || undefined,
      });

      if (form.token_balance !== (currentUser.token_balance || 0)) {
        try {
          await enhancedApi.post('/api/users/topup', {
            user_id: numericUserId,
            amount: form.token_balance - (currentUser.token_balance || 0)
          });
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          toast.error(`Error updating token balance: ${errorMessage}`);
        }
      }

      try {
        await enhancedApi.put(`/api/users/${numericUserId}`, {
          rbac_role_ids: [form.selected_rbac_role],
          expires_at: expiresAt.toISOString()
        });
      } catch (error) {
        throw error;
      }

      try {
        const currentProductAccess = await loadUserProductAccess(numericUserId);
        // Normalize all IDs to numbers for proper comparison
        const currentProductSet = new Set(currentProductAccess.map(id => {
          const numId = Number(id);
          return isNaN(numId) ? null : numId;
        }).filter((id): id is number => id !== null));
        
        const formProducts = (form.selected_products || []).map(id => {
          const numId = Number(id);
          return isNaN(numId) ? null : numId;
        }).filter((id): id is number => id !== null);
        const newProductSet = new Set(formProducts);

        // Products to add: in form but not in current
        const productsToAdd = formProducts.filter(productId => !currentProductSet.has(productId));
        // Products to remove: in current but not in form
        const productsToRemove = Array.from(currentProductSet).filter(productId => !newProductSet.has(productId));

        const productErrors: string[] = [];

        // Helper function to add delay between requests to avoid rate limiting/auth issues
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        // Add products (toggle from false to true)
        let hasAuthError = false;
        for (let i = 0; i < productsToAdd.length; i++) {
          const productId = productsToAdd[i];
          
          // Add small delay between requests (except for the first one)
          if (i > 0) {
            await delay(100); // 100ms delay between requests
          }
          
          try {
            const response = await toggleUserProductAccess(numericUserId, productId);
            // Verify the response indicates access was granted
            if (response.has_access !== true) {
              console.warn(`Product ${productId} toggle did not grant access. Response:`, response);
              // If toggle resulted in false, toggle again (edge case where product was already enabled)
              if (response.has_access === false) {
                await delay(100);
                const retryResponse = await toggleUserProductAccess(numericUserId, productId);
                if (retryResponse.has_access !== true) {
                  productErrors.push(`Product ${productId}: Failed to enable access after retry`);
                }
              }
            }
          } catch (error: any) {
            const errorMessage = getErrorMessage(error);
            const status = getErrorStatus(error);
            
            if (status === 401) {
              hasAuthError = true;
              productErrors.push(`Authentication failed. Please refresh the page and try again.`);
              console.error(`Authentication error when adding product access for product ${productId}:`, error);
              // Stop processing if we get an auth error
              break;
            } else if (status === 403) {
              productErrors.push(`Product ${productId}: Access denied. You don't have permission to modify product access.`);
              console.error(`Permission denied when adding product access for product ${productId}:`, error);
            } else {
              productErrors.push(`Product ${productId}: ${errorMessage}`);
              console.error(`Failed to add product access for product ${productId}:`, error);
            }
          }
        }

        // Remove products (toggle from true to false)
        if (!hasAuthError) {
          for (let i = 0; i < productsToRemove.length; i++) {
            const productId = productsToRemove[i];
            
            // Add small delay between requests (except for the first one)
            if (i > 0) {
              await delay(100); // 100ms delay between requests
            }
            
            try {
              const response = await toggleUserProductAccess(numericUserId, productId);
              // Verify the response indicates access was revoked
              if (response.has_access !== false) {
                console.warn(`Product ${productId} toggle did not revoke access. Response:`, response);
                // If toggle resulted in true, toggle again (edge case where product was already disabled)
                if (response.has_access === true) {
                  await delay(100);
                  const retryResponse = await toggleUserProductAccess(numericUserId, productId);
                  if (retryResponse.has_access !== false) {
                    productErrors.push(`Product ${productId}: Failed to disable access after retry`);
                  }
                }
              }
            } catch (error: any) {
              const errorMessage = getErrorMessage(error);
              const status = getErrorStatus(error);
              
              if (status === 401) {
                hasAuthError = true;
                productErrors.push(`Authentication failed. Please refresh the page and try again.`);
                console.error(`Authentication error when removing product access for product ${productId}:`, error);
                // Stop processing if we get an auth error
                break;
              } else if (status === 403) {
                productErrors.push(`Product ${productId}: Access denied. You don't have permission to modify product access.`);
                console.error(`Permission denied when removing product access for product ${productId}:`, error);
              } else {
                productErrors.push(`Product ${productId}: ${errorMessage}`);
                console.error(`Failed to remove product access for product ${productId}:`, error);
              }
            }
          }
        }

        if (hasAuthError) {
          toast.error('Authentication failed. Please refresh the page and log in again.');
          setLoading(false);
          return;
        }

        if (productErrors.length > 0) {
          toast.warning(`Some product access changes failed: ${productErrors.slice(0, 3).join(', ')}${productErrors.length > 3 ? '...' : ''}`);
        }
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error('Failed to update product access:', error);
        toast.warning(`User updated but failed to update product access: ${errorMessage}`);
      }

      try {
        const permissionsToSend = form.selected_permissions || [];

        if (permissionsToSend.length === 0) {
          toast.error('At least one permission is required');
          setLoading(false);
          return;
        }

        // Ensure permissions is an array of strings
        if (!Array.isArray(permissionsToSend)) {
          toast.error('Invalid permissions format. Expected an array of permission names.');
          setLoading(false);
          return;
        }

        await enhancedApi.put(`/api/rbac/users/${numericUserId}/permissions`, {
          permissions: permissionsToSend
        });
      } catch (error: any) {
        const errorMessage = getErrorMessage(error);
        const status = getErrorStatus(error);
        console.error('Failed to update permissions:', error);

        if (status === 401) {
          toast.error('Authentication failed. Please refresh the page and log in again.');
          setLoading(false);
          return;
        }

        if (status === 400) {
          const errorData = error?.response?.data;
          let detailedMessage = errorMessage;
          
          if (errorData?.error) {
            detailedMessage = errorData.error;
          } else if (errorData?.message) {
            detailedMessage = errorData.message;
          }
          
          toast.error(`Failed to update permissions: ${detailedMessage}`);
          setLoading(false);
          return;
        }

        if (!errorMessage.includes('Static roles cannot manage RBAC')) {
          toast.error(`Failed to update permissions: ${errorMessage}`);
          setLoading(false);
          return;
        }
      }

      toast.success('Employee updated successfully');
      onSuccess();
    } catch (error) {
      toast.error(`Error updating employee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [form, currentUser, availablePermissions, onSuccess, loadUserProductAccess, ensureNumericUserId]);

  return {
    form,
    setForm,
    loading,
    rbacLoading,
    productsLoading,
    permissionsLoading,
    userLoading,
    rbacError,
    productsError,
    permissionsError,
    roles,
    products,
    availablePermissions,
    currentUser,
    handleUpdate,
  };
}

