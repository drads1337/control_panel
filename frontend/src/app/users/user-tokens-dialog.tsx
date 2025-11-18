import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { enhancedApi as api } from '@/shared/api/enhanced-client';
import { Copy, Trash2, Plus, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useAuthContext } from '@/contexts/auth-context';

interface Token {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  last_used?: string;
  permissions: string[];
  api_key?: string;
}

interface UserTokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  userName: string;
}

const UserTokensDialog: React.FC<UserTokensDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName
}) => {
  const { token } = useAuthContext();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenKey, setNewTokenKey] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<number | null>(null);

  useEffect(() => {
    if (open && userId) {
      fetchTokens();
    }
  }, [open, userId]);

  const fetchTokens = async () => {
    try {
      setLoading(true);

      const response = await api.get(`/api/users/${userId}/tokens`);
      setTokens(response.data.tokens || []);
    } catch (error: any) {

      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load tokens';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      toast.error('Token name is required');
      return;
    }

    try {
      setCreating(true);

      const response = await api.post(`/api/users/${userId}/tokens`, {
        name: newTokenName.trim(),
        permissions: []
      });

      setNewTokenKey(response.data.token.api_key);
      setNewTokenName('');
      setShowCreateForm(false);
      toast.success('Token created successfully');
      await fetchTokens();
    } catch (error: any) {

      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to create token';
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleToken = async (tokenId: number, currentStatus: boolean) => {
    try {

      await api.put(`/api/users/${userId}/tokens/${tokenId}`, {
        is_active: !currentStatus
      });

      toast.success(`Token ${!currentStatus ? 'activated' : 'deactivated'}`);
      await fetchTokens();
    } catch (error: any) {

      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update token';
      toast.error(errorMessage);
    }
  };

  const handleDeleteToken = async (tokenId: number, tokenName: string) => {
    if (!confirm(`Are you sure you want to delete token "${tokenName}"?`)) {
      return;
    }

    try {

      await api.delete(`/api/users/${userId}/tokens/${tokenId}`);

      toast.success('Token deleted successfully');
      await fetchTokens();
      setNewTokenKey(null);
    } catch (error: any) {

      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete token';
      toast.error(errorMessage);
    }
  };

  const handleCopyToken = (tokenKey: string, tokenId: number) => {
    navigator.clipboard.writeText(tokenKey);
    setCopiedTokenId(tokenId);
    toast.success('Token copied to clipboard');
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>API Tokens - {userName}</DialogTitle>
          <DialogDescription>
            Manage API tokens for this user. Tokens can be used to authenticate API requests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {}
          {newTokenKey && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-green-800 dark:text-green-200 font-semibold">
                  New Token Created!
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewTokenKey(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                Copy this token now. You won't be able to see it again!
              </p>
              <div className="flex items-center space-x-2">
                <Input
                  value={newTokenKey}
                  readOnly
                  className="font-mono text-sm bg-white dark:bg-gray-800"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyToken(newTokenKey, 0)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
          )}

          {}
          {showCreateForm && (
            <div className="p-4 border rounded-lg space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-name">Token Name</Label>
                <Input
                  id="token-name"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="e.g., Production API, Development Key"
                  disabled={creating}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleCreateToken}
                  disabled={creating || !newTokenName.trim()}
                >
                  {creating ? 'Creating...' : 'Create Token'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTokenName('');
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading tokens...</div>
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 border rounded-lg">
              <p className="text-muted-foreground mb-4">No tokens found</p>
              {!showCreateForm && (
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Token
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {!showCreateForm && (
                <Button onClick={() => setShowCreateForm(true)} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Token
                </Button>
              )}
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="p-4 border rounded-lg space-y-3 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium">{token.name}</h4>
                        {token.is_active ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Created: {formatDate(token.created_at)}</p>
                        <p>Last used: {formatDate(token.last_used || '')}</p>
                        {token.permissions.length > 0 && (
                          <p>Permissions: {token.permissions.length}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor={`toggle-${token.id}`} className="text-xs">
                          {token.is_active ? 'Active' : 'Inactive'}
                        </Label>
                        <Switch
                          id={`toggle-${token.id}`}
                          checked={token.is_active}
                          onCheckedChange={() => handleToggleToken(token.id, token.is_active)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteToken(token.id, token.name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserTokensDialog;
