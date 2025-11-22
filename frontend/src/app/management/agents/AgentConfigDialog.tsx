import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { DialogDescription } from '@/components/ui/dialog';
import { updateAgentConfig } from '@/entities/agent';
import { toast } from 'sonner';
import type { Agent, AgentConfigData } from '@/entities/agent';

interface AgentConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  agent: Agent | null;
}

const AgentConfigDialog: React.FC<AgentConfigDialogProps> = ({ open, onOpenChange, onSuccess, agent }) => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AgentConfigData>({
    login_type: 'license_generation',
    invite_code_required: false,
    custom_key_prefix: '',
    key_prefix_format: '{name}-{duration}-{custom}'
  });

  useEffect(() => {
    if (agent) {
      setConfig({
        login_type: (agent.login_type as any) || 'license_generation',
        invite_code_required: agent.invite_code_required || false,
        custom_key_prefix: agent.custom_key_prefix || '',
        key_prefix_format: agent.key_prefix_format || '{name}-{duration}-{custom}'
      });
    }
  }, [agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent) return;

    try {
      setLoading(true);
      await updateAgentConfig(agent.id, config);
      toast.success('Configuration updated');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error updating configuration');
    } finally {
      setLoading(false);
    }
  };

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-base">{agent.name}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Configure authentication and key generation settings
          </DialogDescription>
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
                  <div>• {'{name}-{duration}-{custom}'} → Agent-24H-abc123</div>
                  <div>• {'{name}_{duration}_{custom}'} → Agent_24H_abc123</div>
                  <div>• {'{name}-{custom}'} → Agent-abc123</div>
                  <div>• {'{custom}-{name}'} → abc123-Agent</div>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AgentConfigDialog;