import React, { useCallback, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { usePermissions } from '@/hooks/use-permissions';
import { RefreshCw, UserCheck, Edit, Trash2, MoreVertical, Mail, Briefcase, ShoppingCart, Coins } from 'lucide-react';
import { getStatusClasses } from '@/lib/status-utils';
import { useClientsQuery } from '@/hooks/use-clients-query';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Хук для определения размера экрана
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

// Desktop Row Component
const ClientItemRow = React.memo(({
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
    <div className="flex items-center justify-between p-3 border-b hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs">
            {client.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'C'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm truncate">
              {client.name || client.username || 'Unknown'}
            </h4>
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", getStatusClasses(client.status === 'active' ? 'active' : 'expired'))}>
              {client.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="truncate">{client.email || `@${client.username}`}</span>
            {client.project && (
              <>
                <span>•</span>
                <span>{client.project}</span>
              </>
            )}
            <span>•</span>
            <span>{client.total_orders ?? 0} keys</span>
            <span>•</span>
            <span>{client.total_spent ?? 0} tokens</span>
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
ClientItemRow.displayName = 'ClientItemRow';

// Mobile Card Component
const MobileClientCard = React.memo(({
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
    <div className="flex flex-col p-4 border rounded-lg bg-card text-card-foreground shadow-sm mb-3">
      {/* Header: Avatar, Name, Actions */}
      <div className="flex justify-between items-start mb-3 pb-3 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border">
            <AvatarFallback>
              {client.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'C'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold text-sm truncate max-w-[160px]">
              {client.name || client.username || 'Unknown'}
            </h4>
            <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="mt-1 text-[10px] h-5 px-1.5">
              {client.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {canEdit && (
              <DropdownMenuItem disabled={loading}>
                <Edit className="mr-2 h-4 w-4" /> Edit Details
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onDelete(client.id)} 
                  disabled={loading}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Client
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Body: Stats Grid */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 p-2 rounded">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate text-xs">{client.email || `@${client.username}`}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {client.project && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded col-span-2">
              <Briefcase className="h-3.5 w-3.5" />
              <span className="truncate">Project: {client.project}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Orders: {client.total_orders ?? 0}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
            <Coins className="h-3.5 w-3.5" />
            <span>Spent: {client.total_spent ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
MobileClientCard.displayName = 'MobileClientCard';

const ClientsTab: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { clients, loading: clientsLoading, error: clientsError, deleteClient, refetch } = useClientsQuery();

  const { hasPermission } = usePermissions();
  const canEditUsers = hasPermission('users.edit');
  const canDeleteUsers = hasPermission('users.delete');

  const handleDeleteClient = useCallback(async (clientId: number) => {
    if (confirm('Are you sure you want to delete this client?')) {
      try {
        await deleteClient(clientId)
      } catch (error) {}
    }
  }, [deleteClient])

  return (
    <div className="space-y-4">
      <Card className={cn(isMobile && "border-0 shadow-none bg-transparent")}>
        <CardHeader className={cn("pb-4", isMobile && "px-0 pt-0")}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Clients</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {clients.length || 0} total clients
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetch()}
                disabled={clientsLoading}
              >
                <RefreshCw className={cn("h-4 w-4", clientsLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className={cn("pt-0", !isMobile && "-mt-3")}>
          {clientsLoading ? (
            <div className="flex justify-center py-8">
               <Spinner message="Loading clients..." />
            </div>
          ) : clientsError ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-500 text-sm text-center px-4">Error: {clientsError}</div>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <UserCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <div className="text-sm text-muted-foreground">No clients found</div>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              {!isMobile && (
                <div className="divide-y border rounded-md">
                  {clients.map((client) => (
                    <ClientItemRow
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

              {/* Mobile View */}
              {isMobile && (
                <div className="flex flex-col gap-1">
                  {clients.map((client) => (
                    <MobileClientCard
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientsTab;