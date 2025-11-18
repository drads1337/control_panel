import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { updateLoaderConfig } from '@/entities/loader';
import { Settings } from 'lucide-react';
import { toast } from 'sonner';
import type { Loader, LoaderConfigData } from '@/entities/loader';

interface LoaderConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  loader: Loader | null;
}

const LoaderConfigDialog: React.FC<LoaderConfigDialogProps> = ({ open, onOpenChange, onSuccess, loader }) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<LoaderConfigData>({
    login_type: 'license_generation',
    invite_code_required: false,
    custom_key_prefix: '',
    key_prefix_format: '{name}-{duration}-{custom}'
  });

  useEffect(() => {
    if (loader) {
      setConfig({
        login_type: (loader.login_type as any) || 'license_generation',
        invite_code_required: loader.invite_code_required || false,
        custom_key_prefix: loader.custom_key_prefix || '',
        key_prefix_format: loader.key_prefix_format || '{name}-{duration}-{custom}'
      });
    }
  }, [loader]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loader) return;

    try {
      setLoading(true);
      await updateLoaderConfig(loader.id, config);
      toast.success('Configuration updated');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating configuration');
    } finally {
      setLoading(false);
    }
  };

  if (!loader) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {loader.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login_type">Authentication Type</Label>
            <Select value={config.login_type} onValueChange={(value) => setConfig(prev => ({ ...prev, login_type: value as any }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="license_generation">License Key Generation</SelectItem>
                <SelectItem value="invite_code">Invite Codes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.login_type === 'invite_code' && (
            <div className="flex items-center space-x-2">
              <Switch
                id="invite_code_required"
                checked={config.invite_code_required}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, invite_code_required: checked }))}
              />
              <Label htmlFor="invite_code_required">Require invite code</Label>
            </div>
          )}

          {config.login_type === 'license_generation' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="custom_key_prefix">Custom Key Prefix</Label>
                <Input
                  id="custom_key_prefix"
                  value={config.custom_key_prefix}
                  onChange={(e) => setConfig(prev => ({ ...prev, custom_key_prefix: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="key_prefix_format">Format</Label>
                <Input
                  id="key_prefix_format"
                  value={config.key_prefix_format}
                  onChange={(e) => setConfig(prev => ({ ...prev, key_prefix_format: e.target.value }))}
                  placeholder="{name}-{duration}-{custom}"
                />
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 text-sm">Format Examples:</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>• {'{name}-{duration}-{custom}'} → Loader-24H-abc123</div>
                  <div>• {'{name}_{duration}_{custom}'} → Loader_24H_abc123</div>
                  <div>• {'{name}-{custom}'} → Loader-abc123</div>
                  <div>• {'{custom}-{name}'} → abc123-Loader</div>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LoaderConfigDialog;