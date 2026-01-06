import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CloudUpload } from 'lucide-react';
import { ConditionalRender } from '@/shared/ui/components/rbac/conditional-render';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';
import type { UploadForm } from '@/features/file-manager/hooks/use-file-manager-upload';
import { cn } from '@/lib/utils.ts';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProduct: Product | null;
  selectedAgent: Agent | null;
  showConfigsFolder: boolean;
  canUploadFiles: boolean;
  uploadForm: UploadForm;
  uploading: boolean;
  uploadProgress: number;
  dragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadFormChange: (form: UploadForm | ((prev: UploadForm) => UploadForm)) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (file: File) => void;
  onUpload: (file: File) => void;
  onResetForm: () => void;
}

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
  open,
  onOpenChange,
  selectedProduct,
  selectedAgent,
  showConfigsFolder,
  canUploadFiles,
  uploadForm,
  uploading,
  uploadProgress,
  dragOver,
  fileInputRef,
  onUploadFormChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onUpload,
  onResetForm,
}) => {
  const handleClose = () => {
    onOpenChange(false);
    onResetForm();
  };

  const handleUploadClick = () => {
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      onUpload(file);
    } else {
      toast.error('Select a file to upload');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            Upload File
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate pr-4">
            {selectedProduct || selectedAgent
              ? `Upload a file for ${selectedProduct?.name || selectedAgent?.name || 'the selected item'}${showConfigsFolder ? ' to the configs folder' : ''}`
              : 'Select an product or agent to upload a file'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Form container takes remaining space */}
        <div className="flex-1 flex flex-col min-h-0 mt-4">
          
          {/* Scrollable Inputs Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 px-1 pb-4">
            <div className="space-y-2 pr-1">
              <Label className="text-sm font-medium">File to upload</Label>
              <div 
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors min-h-[120px] flex flex-col items-center justify-center",
                  dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                )}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={(e) => {
                  onDrop(e);
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    onFileSelect(file);
                  }
                }}
              >
                <CloudUpload className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground mb-2 hidden sm:block">
                  Drag and drop a file here or click to select
                </p>
                <p className="text-xs text-muted-foreground mb-2 sm:hidden">
                  Tap to select a file
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto shrink-0"
                >
                  Select file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onUploadFormChange(prev => ({ ...prev, name: file.name }));
                      onFileSelect(file);
                    }
                  }}
                />
                {/* Selected file name indicator */}
                {uploadForm.name && !dragOver && fileInputRef.current?.files?.[0] && (
                   <div className="mt-2 text-xs text-primary truncate max-w-[200px] mx-auto bg-primary/10 px-2 py-1 rounded">
                      {uploadForm.name}
                   </div>
                )}
              </div>
            </div>

            {!showConfigsFolder && (
              <div className="grid gap-2 pr-1">
                <Label htmlFor="upload-category" className="text-sm">File type</Label>
                <Select 
                  value={uploadForm.category} 
                  onValueChange={(value: 'config' | 'resource') => 
                    onUploadFormChange(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger className="w-full text-base sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <ConditionalRender permission="products.files_manage_configs" fallback={null}>
                      <SelectItem value="config">Configuration</SelectItem>
                    </ConditionalRender>
                    <ConditionalRender permission="products.files_manage_resources" fallback={null}>
                      <SelectItem value="resource">Resource</SelectItem>
                    </ConditionalRender>
                  </SelectContent>
                </Select>
              </div>
            )}

            {showConfigsFolder && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900 pr-1">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Files will be uploaded to the <strong>configs</strong> folder for user settings
                </p>
              </div>
            )}

            <div className="grid gap-2 pr-1">
              <Label htmlFor="upload-name" className="text-sm">Name (optional)</Label>
              <Input
                id="upload-name"
                placeholder="Leave empty to use original name"
                value={uploadForm.name}
                onChange={(e) => onUploadFormChange(prev => ({ ...prev, name: e.target.value }))}
                className="text-base sm:text-sm"
              />
            </div>

            <div className="grid gap-2 pr-1">
              <Label htmlFor="upload-description" className="text-sm">Description</Label>
              <Textarea
                id="upload-description"
                placeholder="File description"
                value={uploadForm.description}
                onChange={(e) => onUploadFormChange(prev => ({ ...prev, description: e.target.value }))}
                className="text-base sm:text-sm resize-none"
                rows={3}
              />
            </div>

            {!showConfigsFolder && uploadForm.category === 'config' && (
              <ConditionalRender permission="products.files_manage_configs" fallback={null}>
                <div className="grid gap-2 pr-1">
                  <Label htmlFor="upload-version" className="text-sm">Version</Label>
                  <Input
                    id="upload-version"
                    placeholder="1.0.0"
                    value={uploadForm.version}
                    onChange={(e) => onUploadFormChange(prev => ({ ...prev, version: e.target.value }))}
                    className="text-base sm:text-sm"
                  />
                </div>
              </ConditionalRender>
            )}

            {uploading && (
              <div className="space-y-2 pt-2 pb-2 pr-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer pinned to bottom */}
          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-4 border-t mt-auto">
            <Button 
              variant="outline" 
              onClick={handleClose} 
              disabled={uploading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUploadClick}
              disabled={uploading || (!selectedProduct && !selectedAgent)}
              className="w-full sm:w-auto"
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  Uploading...
                </div>
              ) : (
                'Upload'
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadDialog;

