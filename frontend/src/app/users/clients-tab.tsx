import React, { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { usePermissions } from '@/hooks/use-permissions';
import { RefreshCw, UserCheck, Edit, Trash2 } from 'lucide-react';
import { getStatusClasses } from '@/lib/status-utils';
import { useClientsQuery } from '@/hooks/use-clients-query';

// Memoized Client Item Component
const ClientItem = React.memo(({
  client,
  loading,
  onDelete,
  canEdit,
  canDelete
}: {
  client: any;
  loading: boolean;
  onDelete: (clientId: number) => void;
  canEdit: boolean;
  canDelete: boolean;
}) => {
  return (
    <div 
      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors duration-200"
    >
      <div className="flex items-center space-x-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback>
            {client.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h4 className="font-medium">
            {client.name}
          </h4>
          <p className="text-sm text-gray-500">
            {client.email} • @{client.username}
          </p>
          <div className="flex items-center space-x-2 mt-1">
            <span className={getStatusClasses(client.status === 'active' ? 'active' : 'expired')}>
              {client.status === 'active' ? 'Active' : 'Inactive'}
            </span>
            <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium">
              {client.project}
            </span>
            <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium">
              Keys: {client.total_orders}
            </span>
            <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium">
              Tokens: {client.total_spent}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Created: {client.created_at ? new Date(client.created_at).toLocaleDateString('en-US') : 'Unknown'}
            {client.last_activity && ` • Last activity: ${new Date(client.last_activity).toLocaleDateString('en-US')}`}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <ConditionalRender permission="users.edit" fallback={null}>
          <Button variant="outline" size="sm" disabled={loading || !canEdit}>
          <Edit className="h-4 w-4 mr-2" />
          {loading ? '...' : 'Edit'}
        </Button>
        </ConditionalRender>
        <ConditionalRender permission="users.delete" fallback={null}>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onDelete(client.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
            disabled={loading || !canDelete}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {loading ? '...' : 'Delete'}
        </Button>
        </ConditionalRender>
      </div>
    </div>
  );
});

ClientItem.displayName = 'ClientItem';

const ClientsTab: React.FC = () => {
  const { clients, loading: clientsLoading, error: clientsError, deleteClient, refetch } = useClientsQuery();

  const { hasPermission } = usePermissions();
  const canEditUsers = hasPermission('users.edit');
  const canDeleteUsers = hasPermission('users.delete');

  const handleDeleteClient = useCallback(async (clientId: number) => {
    if (confirm('Are you sure you want to delete this client?')) {
      try {
        await deleteClient(clientId)
        // Кэш автоматически инвалидируется через useMutationWithCache
        // и данные автоматически обновляются через React Query
      } catch (error) {
        // Ошибка обрабатывается в useMutationWithCache через toast
        console.error('Failed to delete client:', error)
      }
    }
  }, [deleteClient])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Client List</CardTitle>
              <CardDescription>
                Manage project clients • Total: {clients.length}
                {clientsLoading && <span className="ml-2 text-blue-600">(Loading...)</span>}
                {clientsError && <span className="ml-2 text-red-600">(Error: {clientsError})</span>}
                {!clientsLoading && !clientsError && clients.length === 0 && <span className="ml-2 text-gray-600">(No clients)</span>}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                onClick={() => refetch()}
                disabled={clientsLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {clientsLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clientsLoading ? (
            <Spinner message="Loading clients..." />
          ) : clientsError ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500">Error: {clientsError}</div>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <div className="text-gray-500">No clients found</div>
                <Button 
                  variant="outline" 
                  onClick={() => refetch()} 
                  className="mt-4"
                  disabled={clientsLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {clientsLoading ? 'Loading...' : 'Refresh list'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {clients.map((client) => (
                <ClientItem
                  key={client.id}
                  client={client}
                  loading={clientsLoading}
                  onDelete={handleDeleteClient}
                  canEdit={canEditUsers}
                  canDelete={canDeleteUsers}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsTab;

