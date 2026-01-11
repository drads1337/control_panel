"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Trash2, Plus, Shield } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    if (!productId) return;
    
    const hash = formData.hash_sha256.trim().toLowerCase();
    if (!hash || hash.length !== 64 || !/^[0-9a-f]{64}$/.test(hash)) {
      toast.error('Invalid SHA-256 hash. Must be 64 hexadecimal characters.');
      return;
    }

    try {
      setSaving(true);
      await addProductLibraryHash(productId, {
        hash_sha256: hash,
        version: formData.version.trim() || undefined,
        description: formData.description.trim() || undefined
      });
      toast.success('Library hash added successfully');
      setFormData({ hash_sha256: '', version: '', description: '' });
      setShowAddForm(false);
      fetchData();
    } catch (error: unknown) {
      toast.error(`Failed to add hash: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Library Build Hashes</DialogTitle>
            <DialogDescription>
              You don't have permission to manage library hashes.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Library Build Hashes
          </DialogTitle>
          <DialogDescription>
            Manage SHA-256 hashes of library builds for this product. Clients must use a matching hash to connect.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center min-h-[200px] gap-2">
            <Spinner />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Settings */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Verification Settings</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable library hash verification for this product
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="hash-check-enabled">Enable Hash Verification</Label>
                  <p className="text-sm text-muted-foreground">
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
                <div className="space-y-2">
                  <Label htmlFor="mismatch-action">Action on Mismatch</Label>
                  <Select
                    value={settings.mismatch_action}
                    onValueChange={(value: 'block' | 'warn') => setSettings(prev => ({ ...prev, mismatch_action: value }))}
                    disabled={saving}
                  >
                    <SelectTrigger id="mismatch-action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Block Connection</SelectItem>
                      <SelectItem value="warn">Warning Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveSettings}
                  disabled={saving}
                  size="sm"
                >
                  {saving ? <><Spinner className="mr-2 h-3 w-3" /> Saving...</> : 'Save Settings'}
                </Button>
              </div>
            </div>

            {/* Hash List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Allowed Hashes</h3>
                  <p className="text-sm text-muted-foreground">
                    List of SHA-256 hashes that are allowed for this product
                  </p>
                </div>
                <Button
                  onClick={() => setShowAddForm(true)}
                  size="sm"
                  disabled={saving || showAddForm}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Hash
                </Button>
              </div>

              {/* Add Form */}
              {showAddForm && (
                <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                  <div className="space-y-2">
                    <Label htmlFor="hash-sha256">SHA-256 Hash *</Label>
                    <Input
                      id="hash-sha256"
                      placeholder="Enter 64-character hexadecimal SHA-256 hash"
                      value={formData.hash_sha256}
                      onChange={(e) => setFormData(prev => ({ ...prev, hash_sha256: e.target.value }))}
                      maxLength={64}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hash-version">Version (optional)</Label>
                    <Input
                      id="hash-version"
                      placeholder="e.g., 1.0.0"
                      value={formData.version}
                      onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hash-description">Description (optional)</Label>
                    <Textarea
                      id="hash-description"
                      placeholder="Description of this build"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false);
                        setFormData({ hash_sha256: '', version: '', description: '' });
                      }}
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddHash}
                      disabled={saving || !formData.hash_sha256.trim()}
                      size="sm"
                    >
                      {saving ? <><Spinner className="mr-2 h-3 w-3" /> Adding...</> : 'Add Hash'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Hash Table */}
              {hashes.length === 0 ? (
                <div className="p-8 text-center border rounded-lg">
                  <p className="text-sm text-muted-foreground">No library hashes configured yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Click "Add Hash" to add one.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hash (SHA-256)</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hashes.map((hash) => (
                        <TableRow key={hash.id}>
                          <TableCell className="font-mono text-xs">
                            {hash.hash_sha256.substring(0, 16)}...{hash.hash_sha256.substring(48)}
                          </TableCell>
                          <TableCell>{hash.version || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{hash.description || '-'}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-1 rounded ${hash.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {hash.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteHash(hash.id)}
                              disabled={saving}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
