import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { updateAgentConfig } from '@/entities/agent';
import { toast } from 'sonner';
import type { Agent, AgentConfigData } from '@/entities/agent';

interface AgentConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
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
      onSuccess?.();
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
      <DialogContent className="w-[95vw] sm:max-w-[450px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left px-4 pt-4 pb-3">
          <DialogTitle className="text-sm font-medium truncate pr-4">{agent.name}</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs">
            Configure authentication and key generation settings
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 space-y-3 pb-4">
            <div className="space-y-1.5 pr-1">
              <Label htmlFor="login_type" className="text-xs">Authentication Type</Label>
              <Select value={config.login_type} onValueChange={(value) => setConfig(prev => ({ ...prev, login_type: value as any }))}>
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="license_generation">License Key Generation</SelectItem>
                  <SelectItem value="invite_code">Invite Codes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.login_type === 'invite_code' && (
              <div className="flex items-center justify-between p-2 border rounded pr-1">
                <Label htmlFor="invite_code_required" className="cursor-pointer flex-1 text-xs">Require invite code</Label>
                <Switch
                  id="invite_code_required"
                  checked={config.invite_code_required}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, invite_code_required: checked }))}
                />
              </div>
            )}

            {config.login_type === 'license_generation' && (
              <>
                <div className="space-y-1.5 pr-1">
                  <Label htmlFor="custom_key_prefix" className="text-xs">Custom Key Prefix</Label>
                  <Input
                    id="custom_key_prefix"
                    value={config.custom_key_prefix}
                    onChange={(e) => setConfig(prev => ({ ...prev, custom_key_prefix: e.target.value }))}
                    placeholder="Optional"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5 pr-1">
                  <Label htmlFor="key_prefix_format" className="text-xs">Format</Label>
                  <Input
                    id="key_prefix_format"
                    value={config.key_prefix_format}
                    onChange={(e) => setConfig(prev => ({ ...prev, key_prefix_format: e.target.value }))}
                    placeholder="{name}-{duration}-{custom}"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="p-2 bg-muted/20 rounded border pr-1">
                  <h4 className="font-medium mb-1.5 text-xs text-muted-foreground">Format Examples:</h4>
                  <div className="space-y-0.5 text-xs text-muted-foreground font-sans">
                    <div className="break-all">{'{name}-{duration}-{custom}'} → Agent-24H-abc123</div>
                    <div className="break-all">{'{name}_{duration}_{custom}'} → Agent_24H_abc123</div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-1.5 px-4 py-3 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-8 text-xs"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto h-8 text-xs"
            >
              {loading ? (<><Spinner className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</>) : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AgentConfigDialog;

