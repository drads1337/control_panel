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
import { cn } from '@/lib/utils';

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
    } catch (error: unknown) {
      const { getErrorMessage } = await import('@/lib/error-utils')
      toast.error(getErrorMessage(error));
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
    } catch (error: unknown) {
      const { getErrorMessage } = await import('@/lib/error-utils')
      toast.error(getErrorMessage(error));
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
    } catch (error: unknown) {
      const { getErrorMessage } = await import('@/lib/error-utils')
      toast.error(getErrorMessage(error));
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
    } catch (error: unknown) {
      const { getErrorMessage } = await import('@/lib/error-utils')
      toast.error(getErrorMessage(error));
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
      <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 sm:p-6 border-b flex-shrink-0">
          <DialogTitle className="text-base truncate pr-4">API Tokens - {userName}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Manage API tokens for authentication.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* New Token Success Alert */}
          {newTokenKey && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-green-800 dark:text-green-200 font-semibold text-sm">
                  New Token Created!
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setNewTokenKey(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                Copy this token now. It won't be shown again!
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={newTokenKey}
                  readOnly
                  className="font-mono text-xs sm:text-sm bg-white dark:bg-gray-800 h-9"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3"
                  onClick={() => handleCopyToken(newTokenKey, 0)}
                >
                  <Copy className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-2">Copy</span>
                </Button>
              </div>
            </div>
          )}

          {/* Create Form */}
          {showCreateForm && (
            <div className="p-4 border rounded-lg bg-muted/10 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-name" className="text-sm font-medium">Token Name</Label>
                <Input
                  id="token-name"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="e.g., Production API"
                  disabled={creating}
                  className="text-base sm:text-sm"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewTokenName('');
                  }}
                  disabled={creating}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateToken}
                  disabled={creating || !newTokenName.trim()}
                  className="w-full sm:w-auto"
                >
                  {creating ? 'Creating...' : 'Create Token'}
                </Button>
              </div>
            </div>
          )}

          {/* Token List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground text-sm">Loading tokens...</div>
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 border rounded-lg border-dashed">
              <p className="text-muted-foreground mb-4 text-sm">No tokens found</p>
              {!showCreateForm && (
                <Button onClick={() => setShowCreateForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Token
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {!showCreateForm && (
                <Button onClick={() => setShowCreateForm(true)} className="w-full" variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Token
                </Button>
              )}
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="p-4 border rounded-lg hover:bg-accent/30 transition-colors bg-card"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h4 className="font-medium text-sm truncate">{token.name}</h4>
                        {token.is_active ? (
                          <Badge variant="default" className="bg-green-500 text-[10px] px-1.5 h-5 hover:bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                            <XCircle className="h-3 w-3 mr-1" /> Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>Created: {formatDate(token.created_at)}</p>
                        <p>Last used: {formatDate(token.last_used || '')}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 mt-1 sm:mt-0">
                      <div className="flex items-center gap-2" onClick={() => handleToggleToken(token.id, token.is_active)}>
                        <Label htmlFor={`toggle-${token.id}`} className="text-xs cursor-pointer">
                          {token.is_active ? 'On' : 'Off'}
                        </Label>
                        <Switch
                          id={`toggle-${token.id}`}
                          checked={token.is_active}
                          onCheckedChange={() => handleToggleToken(token.id, token.is_active)}
                          className="scale-75 origin-right"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteToken(token.id, token.name)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
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

        <DialogFooter className="p-4 sm:p-6 border-t bg-background flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserTokensDialog;