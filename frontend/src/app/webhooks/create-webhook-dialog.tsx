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
import type { WebhookFormData, SecretsVisibility } from './types';

interface CreateWebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: WebhookFormData;
  setFormData: React.Dispatch<React.SetStateAction<WebhookFormData>>;
  secretsVisibility: SecretsVisibility;
  setSecretsVisibility: React.Dispatch<React.SetStateAction<SecretsVisibility>>;
  customHeaders: Array<{ key: string, value: string }>;
  setCustomHeaders: React.Dispatch<React.SetStateAction<Array<{ key: string, value: string }>>>;
  saving: boolean;
  onCreateWebhook: () => void;
}

export function CreateWebhookDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  secretsVisibility,
  setSecretsVisibility,
  customHeaders,
  setCustomHeaders,
  saving,
  onCreateWebhook
}: CreateWebhookDialogProps) {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('webhooks.create');

  if (!canCreate) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 
         АДАПТАЦИЯ: 
         1. w-[95vw] - почти полная ширина на мобильном.
         2. sm:max-w-2xl - ограничение ширины на десктопе (как было).
         3. max-h-[90vh] + overflow-y-auto - скролл, если контент не влезает по высоте.
      */}
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Create Webhook</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Configure a new webhook to receive real-time notifications
          </DialogDescription>
        </DialogHeader>

        <WebhookForm
          formData={formData}
          setFormData={setFormData}
          secretsVisibility={secretsVisibility}
          setSecretsVisibility={setSecretsVisibility}
          customHeaders={customHeaders}
          setCustomHeaders={setCustomHeaders}
          isEdit={false}
        />

        {/* АДАПТАЦИЯ: flex-col для вертикальных кнопок на мобильном */}
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={onCreateWebhook} 
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (<><Spinner className="mr-2 h-4 w-4 animate-spin" />Creating...</>) : 'Create Webhook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}