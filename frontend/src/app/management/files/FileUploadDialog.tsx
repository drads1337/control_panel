import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CloudUpload } from 'lucide-react';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';
import type { UploadForm } from '@/hooks/files/use-file-manager-upload';

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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CloudUpload className="w-5 h-5 text-primary" />
            Upload File
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {selectedProduct || selectedAgent
              ? `Upload a file for ${selectedProduct?.name || selectedAgent?.name || 'the selected item'}${showConfigsFolder ? ' to the configs folder' : ''}`
              : 'Select an product or agent to upload a file'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">File to upload</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
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
                  <CloudUpload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mb-2">
                    Drag and drop a file here or click to select
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
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
                </div>
              </div>

              {!showConfigsFolder && (
                <div className="grid gap-2">
                  <Label htmlFor="upload-category" className="text-sm">File type</Label>
                  <Select 
                    value={uploadForm.category} 
                    onValueChange={(value: 'config' | 'resource') => 
                      onUploadFormChange(prev => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
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
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Files will be uploaded to the <strong>configs</strong> folder for user settings
                  </p>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="upload-name" className="text-sm">Name (optional)</Label>
                <Input
                  id="upload-name"
                  placeholder="Leave empty to use the original file name"
                  value={uploadForm.name}
                  onChange={(e) => onUploadFormChange(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="upload-description" className="text-sm">Description</Label>
                <Textarea
                  id="upload-description"
                  placeholder="File description"
                  value={uploadForm.description}
                  onChange={(e) => onUploadFormChange(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {!showConfigsFolder && uploadForm.category === 'config' && (
                <ConditionalRender permission="products.files_manage_configs" fallback={null}>
                  <div className="grid gap-2">
                    <Label htmlFor="upload-version" className="text-sm">Version</Label>
                    <Input
                      id="upload-version"
                      placeholder="1.0.0"
                      value={uploadForm.version}
                      onChange={(e) => onUploadFormChange(prev => ({ ...prev, version: e.target.value }))}
                    />
                  </div>
                </ConditionalRender>
              )}

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-2xl h-2">
                    <div 
                      className="bg-primary h-2 rounded-2xl transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUploadClick}
            disabled={uploading || (!selectedProduct && !selectedAgent)}
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
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadDialog;