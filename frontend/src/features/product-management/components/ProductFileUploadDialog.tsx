import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import FileUpload from '@/components/ui/file-upload';
import { uploadProductFiles } from '@/entities/file';
import { toast } from 'sonner';
import type { Product } from '@/entities/product';

interface ProductFileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  product: Product | null;
}

const ProductFileUploadDialog: React.FC<ProductFileUploadDialogProps> = ({ open, onOpenChange, onSuccess, product }) => {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<{
    logo?: File;
    banner?: File;
    background?: File;
    file?: File;
  }>({});

  const handleFilesSelect = (files: any[], fileType: string) => {
    if (files.length > 0) {
      setSelectedFiles(prev => ({
        ...prev,
        [fileType]: files[0].file
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    try {
      setLoading(true);
      setUploadProgress(0);
      
      const filesToUpload: { file: File; type: 'logo' | 'banner' | 'background' | 'file' }[] = [];
      
      if (selectedFiles.logo) {
        filesToUpload.push({ file: selectedFiles.logo, type: 'logo' });
      }
      if (selectedFiles.banner) {
        filesToUpload.push({ file: selectedFiles.banner, type: 'banner' });
      }
      if (selectedFiles.background) {
        filesToUpload.push({ file: selectedFiles.background, type: 'background' });
      }
      if (selectedFiles.file) {
        filesToUpload.push({ file: selectedFiles.file, type: 'file' });
      }

      if (filesToUpload.length === 0) {
        toast.error('Please select at least one file');
        return;
      }

      await uploadProductFiles(product.id, filesToUpload, (fileIndex, progress) => {
        setUploadProgress(progress);
      });

      toast.success('Files uploaded successfully!');
      onSuccess();
      onOpenChange(false);
      setSelectedFiles({});
      setUploadProgress(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error uploading files');
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Upload Files for Product
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload files for the product "{product.name}".
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Product Logo
                </Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'logo')}
                  multiple={false}
                  accept="image/*"
                  maxSize={5 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={true}
                  showProgress={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Product Banner
                </Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'banner')}
                  multiple={false}
                  accept="image/*"
                  maxSize={10 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={true}
                  showProgress={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Product Background
                </Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'background')}
                  multiple={false}
                  accept="image/*"
                  maxSize={15 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={true}
                  showProgress={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Product File (required)
                </Label>
                <FileUpload
                  onFilesSelect={(files) => handleFilesSelect(files, 'file')}
                  multiple={false}
                  accept=".exe,.apk,.so,.dmg,.deb,.rpm,.zip"
                  maxSize={50 * 1024 * 1024}
                  maxFiles={1}
                  showPreview={false}
                  showProgress={false}
                  className="min-h-[100px]"
                />
                {selectedFiles.file && (
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <span>✓</span>
                    <span className="truncate max-w-[200px]">
                      File selected: {selectedFiles.file.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md bg-muted/10 p-2.5">
              <h4 className="text-xs font-medium text-foreground mb-2">File Requirements:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                <div>Logo: PNG, JPG, JPEG, GIF (up to 5MB)</div>
                <div>Banner: PNG, JPG, JPEG, GIF (up to 10MB)</div>
                <div>Background: PNG, JPG, JPEG, GIF (up to 15MB)</div>
                <div>File: EXE, APK, SO, DMG, DEB, RPM, ZIP (up to 50MB)</div>
              </div>
            </div>

            {loading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Uploading files...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)} 
                disabled={loading}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !selectedFiles.file}
                className="h-8 text-xs min-w-[80px]"
              >
                {loading ? (
                  <><Spinner className="size-3 mr-2" />Uploading...</>
                ) : (
                  'Upload Files'
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFileUploadDialog;

