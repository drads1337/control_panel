import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRBAC, type Role, type Permission } from '@/hooks/use-rbac';

interface RoleForm {
  name: string;
  description: string;
  permissions: string[];
}

interface UseRBACTabReturn {
  // State
  roleForm: RoleForm;
  selectedRole: Role | null;
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  
  // Data
  roles: Role[];
  permissions: Permission;
  isLoading: boolean;
  error: Error | null;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // Actions
  setRoleForm: (form: RoleForm | ((prev: RoleForm) => RoleForm)) => void;
  setSelectedRole: (role: Role | null) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  handleRoleSubmit: () => Promise<void>;
  handleDeleteRole: (roleId: number) => Promise<void>;
  handleEditRole: (role: Role) => void;
  resetRoleForm: () => void;
}

/**
 * Hook for managing RBAC tab logic (form state, dialogs, data operations)
 * Separates data management from UI rendering (SRP)
 */
export function useRBACTab(): UseRBACTabReturn {
  const [roleForm, setRoleForm] = useState<RoleForm>({
    name: '',
    description: '',
    permissions: []
  });
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const {
    roles,
    permissions,
    isLoading,
    error,
    createRole,
    updateRole,
    deleteRole,
    isCreating,
    isUpdating,
    isDeleting,
  } = useRBAC();

  const resetRoleForm = useCallback(() => {
    setRoleForm({
      name: '',
      description: '',
      permissions: []
    });
    setSelectedRole(null);
  }, []);

  const handleRoleSubmit = useCallback(async () => {
    if (!roleForm.name.trim()) {
      toast.error('Role name is required');
      return;
    }

    try {
      if (selectedRole) {
        await updateRole({ roleId: selectedRole.id, data: roleForm });
        setEditDialogOpen(false);
        setSelectedRole(null);
      } else {
        await createRole(roleForm);
        setCreateDialogOpen(false);
      }
      
      resetRoleForm();
    } catch (error) {
      // Error handling is done in the hook
    }
  }, [roleForm, selectedRole, createRole, updateRole, resetRoleForm]);

  const handleDeleteRole = useCallback(async (roleId: number) => {
    if (confirm('Are you sure you want to delete this role?')) {
      try {
        await deleteRole(roleId);
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  }, [deleteRole]);

  const handleEditRole = useCallback((role: Role) => {
    setSelectedRole(role);
    setRoleForm({
      name: role.name,
      description: role.description,
      permissions: role.permissions || []
    });
    setEditDialogOpen(true);
  }, []);

  return {
    // State
    roleForm,
    selectedRole,
    createDialogOpen,
    editDialogOpen,
    
    // Data
    roles,
    permissions,
    isLoading,
    error,
    isCreating,
    isUpdating,
    isDeleting,
    
    // Actions
    setRoleForm,
    setSelectedRole,
    setCreateDialogOpen,
    setEditDialogOpen,
    handleRoleSubmit,
    handleDeleteRole,
    handleEditRole,
    resetRoleForm,
  };
}

