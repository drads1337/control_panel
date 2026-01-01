import React from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WebhookForm } from './WebhookForm';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import type { WebhookData, WebhookFormData, SecretsVisibility } from '../types';

interface EditWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingWebhook: WebhookData | null;
  formData: WebhookFormData;
  setFormData: React.Dispatch<React.SetStateAction<WebhookFormData>>;
  secretsVisibility: SecretsVisibility;
  setSecretsVisibility: React.Dispatch<React.SetStateAction<SecretsVisibility>>;
  customHeaders: Array<{ key: string, value: string }>;
  setCustomHeaders: React.Dispatch<React.SetStateAction<Array<{ key: string, value: string }>>>;
  saving: boolean;
  onUpdateWebhook: () => void;
}

export function EditWebhookDialog({
  open,
  onOpenChange,
  editingWebhook,
  formData,
  setFormData,
  secretsVisibility,
  setSecretsVisibility,
  customHeaders,
  setCustomHeaders,
  saving,
  onUpdateWebhook
}: EditWebhookDialogProps) {
  if (!editingWebhook) {
    return null;
  }

  return (
    <ConditionalRender permission="webhooks.edit" fallback={null}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 pb-1 bg-muted/5">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold">
                Edit Webhook
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update webhook configuration for "{editingWebhook?.name}"
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            <WebhookForm
              formData={formData}
              setFormData={setFormData}
              secretsVisibility={secretsVisibility}
              setSecretsVisibility={setSecretsVisibility}
              customHeaders={customHeaders}
              setCustomHeaders={setCustomHeaders}
              isEdit={true}
            />
          </div>

          {/* Footer */}
          <DialogFooter className="flex justify-end gap-2 p-4 pt-2 border-t">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button 
              onClick={onUpdateWebhook} 
              disabled={saving}
              className="h-8 text-xs min-w-[80px]"
            >
              {saving ? (
                <Spinner className="size-3" />
              ) : (
                'Update Webhook'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConditionalRender>
  );
}

