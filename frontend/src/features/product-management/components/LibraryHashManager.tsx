"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { useAuthContext } from '@/app/providers/auth-provider';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import {
  getProductLibraryHashes,
  addProductLibraryHash,
  deleteProductLibraryHash,
  getProductLibraryHashSettings,
  updateProductLibraryHashSettings,
  type LibraryHash,
  type LibraryHashSettings
} from '@/entities/product/api/product';
import { getErrorMessage } from '@/shared/lib/utils/error-utils';
import { Trash2, Plus } from 'lucide-react';

interface LibraryHashManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId?: number | string;
}

export default function LibraryHashManager({ open, onOpenChange, productId }: LibraryHashManagerProps) {
  const { user } = useAuthContext();
  const { hasPermission } = usePermissions();
  const canEditProducts = hasPermission('products.edit');

  const [hashes, setHashes] = useState<LibraryHash[]>([]);
  const [settings, setSettings] = useState<LibraryHashSettings>({
    library_hash_check_enabled: false,
    mismatch_action: 'block'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submittingHash, setSubmittingHash] = useState(false);
  const [formData, setFormData] = useState({
    hash_sha256: '',
    version: '',
    description: ''
  });

  const fetchData = useCallback(async () => {
    if (!productId || !user) return;

    try {
      setLoading(true);
      const [hashesResponse, settingsResponse] = await Promise.all([
        getProductLibraryHashes(productId),
        getProductLibraryHashSettings(productId)
      ]);
      setHashes(hashesResponse.hashes || []);
      setSettings(settingsResponse);
    } catch (error: unknown) {
      toast.error(`Failed to load data: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [productId, user]);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setShowAddForm(false);
      setFormData({ hash_sha256: '', version: '', description: '' });
      return;
    }
    fetchData();
  }, [open, fetchData]);

  const handleAddHash = async () => {
    if (submittingHash || saving) return; // Prevent double submission
    
    if (!productId) {
      toast.error('Product ID is required');
      return;
    }
    
    const hash = formData.hash_sha256.trim().toLowerCase();
    if (!hash || hash.length !== 64 || !/^[0-9a-f]{64}$/.test(hash)) {
      toast.error('Invalid SHA-256 hash. Must be 64 hexadecimal characters.');
      return;
    }

    try {
      setSubmittingHash(true);
      setSaving(true);
      console.log('Adding hash:', { productId, hash, version: formData.version, description: formData.description });
      
      const response = await addProductLibraryHash(productId, {
        hash_sha256: hash,
        version: formData.version.trim() || undefined,
        description: formData.description.trim() || undefined
      });
      
      console.log('Add hash response:', response);
      
      if (response?.success) {
        toast.success(response.message || 'Library hash added successfully');
        setFormData({ hash_sha256: '', version: '', description: '' });
        setShowAddForm(false);
        await fetchData();
      } else {
        toast.error(response?.message || 'Failed to add hash');
      }
    } catch (error: unknown) {
      console.error('Error adding hash:', error);
      toast.error(`Failed to add hash: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
      setSubmittingHash(false);
    }
  };

  const handleDeleteHash = async (hashId: number) => {
    if (!productId) return;
    if (!confirm('Are you sure you want to delete this hash?')) return;

    try {
      setSaving(true);
      await deleteProductLibraryHash(productId, hashId);
      toast.success('Library hash deleted successfully');
      fetchData();
    } catch (error: unknown) {
      toast.error(`Failed to delete hash: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!productId) return;

    try {
      setSaving(true);
      await updateProductLibraryHashSettings(productId, settings);
      toast.success('Settings updated successfully');
      fetchData();
    } catch (error: unknown) {
      toast.error(`Failed to update settings: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  if (!canEditProducts) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full sm:max-w-[500px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 pb-1 bg-muted/5">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold">
                Library Build Hashes
              </DialogTitle>
              <DialogDescription className="text-xs">
                You don't have permission to manage library hashes.
              </DialogDescription>
            </div>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[600px] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Library Build Hashes
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage SHA-256 hashes of library builds for this product. Clients must use a matching hash to connect.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center min-h-[200px] gap-2">
              <Spinner />
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <Tabs defaultValue="hashes" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="hashes" className="text-xs">Hashes</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="hashes" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Allowed Hashes</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      List of SHA-256 hashes allowed for this product
                    </p>
                  </div>
                  <ConditionalRender permission="products.edit" fallback={null}>
                    <Button
                      onClick={() => setShowAddForm(true)}
                      disabled={saving || showAddForm}
                      className="h-8 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Hash
                    </Button>
                  </ConditionalRender>
                </div>

                {/* Add Form */}
                {showAddForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!submittingHash && !saving) {
                        handleAddHash();
                      }
                    }}
                    className="p-3 border rounded-lg space-y-3 bg-muted/50"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="hash-sha256" className="text-xs font-medium">SHA-256 Hash *</Label>
                      <Input
                        id="hash-sha256"
                        placeholder="Enter 64-character hexadecimal SHA-256 hash"
                        value={formData.hash_sha256}
                        onChange={(e) => setFormData(prev => ({ ...prev, hash_sha256: e.target.value }))}
                        maxLength={64}
                        className="h-8 text-xs font-mono"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hash-version" className="text-xs font-medium">Version (optional)</Label>
                      <Input
                        id="hash-version"
                        placeholder="e.g., 1.0.0"
                        value={formData.version}
                        onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                        className="h-8 text-xs"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hash-description" className="text-xs font-medium">Description (optional)</Label>
                      <Textarea
                        id="hash-description"
                        placeholder="Description of this build"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                        className="text-xs"
                        autoComplete="off"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false);
                          setFormData({ hash_sha256: '', version: '', description: '' });
                        }}
                        disabled={saving}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                      {canEditProducts && (
                        <Button
                          type="submit"
                          onClick={(e) => {
                            e.preventDefault();
                            handleAddHash();
                          }}
                          disabled={saving || !formData.hash_sha256.trim()}
                          className="h-8 text-xs min-w-[80px]"
                        >
                          {saving ? 'Adding...' : 'Add Hash'}
                        </Button>
                      )}
                    </div>
                  </form>
                )}

                {/* Hash List */}
                {hashes.length === 0 ? (
                  <div className="p-6 text-center border rounded-lg">
                    <p className="text-xs text-muted-foreground">No library hashes configured yet.</p>
                    <p className="text-xs text-muted-foreground mt-1">Click "Add Hash" to add one.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {hashes.map((hash) => (
                      <div key={hash.id} className="p-3 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded break-all">
                                {hash.hash_sha256.substring(0, 16)}...{hash.hash_sha256.substring(48)}
                              </code>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${hash.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                                {hash.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {hash.version && (
                              <p className="text-xs text-muted-foreground">Version: {hash.version}</p>
                            )}
                            {hash.description && (
                              <p className="text-xs text-muted-foreground">{hash.description}</p>
                            )}
                          </div>
                          <ConditionalRender permission="products.edit" fallback={null}>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeleteHash(hash.id)}
                              disabled={saving}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </ConditionalRender>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Verification Settings</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable or disable library hash verification for this product
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label htmlFor="hash-check-enabled" className="text-xs font-medium">Enable Hash Verification</Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, only clients with matching library hashes can connect
                      </p>
                    </div>
                    <Switch
                      id="hash-check-enabled"
                      checked={settings.library_hash_check_enabled}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, library_hash_check_enabled: checked }))}
                      disabled={saving}
                    />
                  </div>

                  {settings.library_hash_check_enabled && (
                    <div className="space-y-1.5">
                      <Label htmlFor="mismatch-action" className="text-xs font-medium">Action on Mismatch</Label>
                      <Select
                        value={settings.mismatch_action}
                        onValueChange={(value: 'block' | 'warn') => setSettings(prev => ({ ...prev, mismatch_action: value }))}
                        disabled={saving}
                      >
                        <SelectTrigger id="mismatch-action" className="w-full h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          <SelectItem value="block" className="text-xs">Block Connection</SelectItem>
                          <SelectItem value="warn" className="text-xs">Warning Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <ConditionalRender permission="products.edit" fallback={null}>
                      <Button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="h-8 text-xs min-w-[80px]"
                      >
                        {saving ? 'Saving...' : 'Save Settings'}
                      </Button>
                    </ConditionalRender>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter className="p-4 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-8 text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
