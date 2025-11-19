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
    <div className="flex items-center justify-between p-2.5 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs">
            {client.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'C'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-sm truncate">
              {client.name || client.username || 'Unknown'}
          </h4>
            <span className={getStatusClasses(client.status === 'active' ? 'active' : 'expired')}>
              {client.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground truncate">
              {client.email || `@${client.username}`}
            </p>
            {client.project && (
              <span className="text-xs text-muted-foreground">
                • {client.project}
            </span>
            )}
            <span className="text-xs text-muted-foreground">
              • {client.total_orders ?? 0} keys
            </span>
            <span className="text-xs text-muted-foreground">
              • {client.total_spent ?? 0} tokens
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {canEdit && (
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8"
            disabled={loading}
          >
            <Edit className="h-4 w-4" />
        </Button>
        )}
        {canDelete && (
        <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(client.id)}
            disabled={loading}
        >
            <Trash2 className="h-4 w-4" />
        </Button>
        )}
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

      } catch (error) {

      }
    }
  }, [deleteClient])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Clients</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {clients.length || 0} total
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetch()}
                disabled={clientsLoading}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 -mt-3">
          {clientsLoading ? (
            <Spinner message="Loading clients..." />
          ) : clientsError ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500">Error: {clientsError}</div>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <UserCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">No clients found</div>
              </div>
            </div>
          ) : (
            <div className="divide-y">
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
