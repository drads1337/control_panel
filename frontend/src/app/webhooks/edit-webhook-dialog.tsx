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
import { ConditionalRender } from '@/components/rbac/conditional-render';
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
  if (!editingWebhook) {
    return null;
  }

  return (
    <ConditionalRender permission="webhooks.edit" fallback={null}>
      <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 
          АДАПТАЦИЯ: 
          1. w-[95vw] для мобильных.
          2. max-h-[90vh] + overflow-y-auto для скролла на небольших экранах.
      */}
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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

        {/* АДАПТАЦИЯ: flex-col для вертикального расположения кнопок на телефоне */}
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={onUpdateWebhook} 
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving && <Spinner className="h-4 w-4 mr-2" />}
            Update Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </ConditionalRender>
  );
}