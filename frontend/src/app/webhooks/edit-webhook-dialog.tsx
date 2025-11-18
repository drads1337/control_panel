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
import { WebhookForm } from './webhook-form';
import { usePermissions } from '@/hooks/use-permissions';
import type { WebhookData, WebhookFormData, SecretsVisibility } from './types';

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
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('webhooks.edit');

  if (!editingWebhook || !canEdit) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
          <DialogDescription>
            Update webhook configuration for "{editingWebhook?.name}"
          </DialogDescription>
        </DialogHeader>

        <WebhookForm
          formData={formData}
          setFormData={setFormData}
          secretsVisibility={secretsVisibility}
          setSecretsVisibility={setSecretsVisibility}
          customHeaders={customHeaders}
          setCustomHeaders={setCustomHeaders}
          isEdit={true}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onUpdateWebhook} disabled={saving}>
            {saving && <Spinner className="h-4 w-4 mr-2" />}
            Update Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
