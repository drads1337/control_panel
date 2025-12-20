import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRBAC, type Role, type Permission } from '@/hooks/use-rbac';

interface RoleForm {
  name: string;
  description: string;
  permissions: string[];
}

interface UseRBACTabReturn {

  roleForm: RoleForm;
  selectedRole: Role | null;
  createDialogOpen: boolean;
  editDialogOpen: boolean;

  roles: Role[];
  permissions: Permission;
  isLoading: boolean;
  error: Error | null;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  setRoleForm: (form: RoleForm | ((prev: RoleForm) => RoleForm)) => void;
  setSelectedRole: (role: Role | null) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setEditDialogOpen: (open: boolean) => void;
  handleRoleSubmit: () => Promise<void>;
  handleDeleteRole: (roleId: number) => Promise<void>;
  handleEditRole: (role: Role) => void;
  resetRoleForm: () => void;
  refetchRoles: () => Promise<any>;
  refetchPermissions: () => Promise<any>;
}

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
    refetchRoles,
    refetchPermissions,
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

    }
  }, [roleForm, selectedRole, createRole, updateRole, resetRoleForm]);

  const handleDeleteRole = useCallback(async (roleId: number) => {
    if (confirm('Are you sure you want to delete this role?')) {
      try {
        await deleteRole(roleId);
      } catch (error) {

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

    roleForm,
    selectedRole,
    createDialogOpen,
    editDialogOpen,

    roles,
    permissions,
    isLoading,
    error,
    isCreating,
    isUpdating,
    isDeleting,

    setRoleForm,
    setSelectedRole,
    setCreateDialogOpen,
    setEditDialogOpen,
    handleRoleSubmit,
    handleDeleteRole,
    handleEditRole,
    resetRoleForm,
    refetchRoles,
    refetchPermissions,
  };
}
