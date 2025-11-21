import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FileUpload from '@/components/ui/file-upload';
import MultiFileUpload from '@/components/ui/multi-file-upload';
import { uploadProductFiles, uploadProductExtraFile, getFileStats } from '@/entities/file';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import type { Product } from '@/entities/product';
import type { FileStats } from '@/entities/file';
import { 
  Package, 
  Image, 
  FileText, 
  Cloud,
  Upload,
  Loader2
} from 'lucide-react';

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

interface SelectedFile {
  file: File;
  type: 'logo' | 'banner' | 'file' | 'additional';
}

const UploadDialog: React.FC<UploadDialogProps> = ({ open, onOpenChange, product }) => {
  const { token } = useAuth();
  const { hasPermission } = usePermissions();
  const canUploadFiles = hasPermission('products.files_upload') || hasPermission('products.upload_files');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<FileStats['storage_info'] | null>(null);

  useEffect(() => {
    if (open && token) {
      loadStorageInfo();
    }
  }, [open, token]);

  const loadStorageInfo = async () => {
    try {
      const stats = await getFileStats();
      setStorageInfo(stats.storage_info);
    } catch (error) {

    }
  };

  if (!product || !canUploadFiles) return null;

  const handleFileSelect = (files: any[], type: 'logo' | 'banner' | 'file' | 'additional') => {
    const newFiles = files.map(fileWithPreview => ({ file: fileWithPreview.file, type }));
    setSelectedFiles(prev => {
      const filtered = prev.filter(f => f.type !== type);
      return [...filtered, ...newFiles];
    });
  };

  const handleUploadAll = async () => {
    if (!token || selectedFiles.length === 0) {
      toast.error('No files to upload');
      return;
    }

    setUploading(true);

    try {

      const mainFiles = selectedFiles.filter(f => f.type !== 'additional');
      const additionalFiles = selectedFiles.filter(f => f.type === 'additional');

      if (mainFiles.length > 0) {
        const filesToUpload = mainFiles.map(f => ({
          file: f.file,
          type: f.type as 'logo' | 'banner' | 'file'
        }));

        await uploadProductFiles(product.id, filesToUpload);
        toast.success(`Uploaded ${mainFiles.length} main files`);
      }

      if (additionalFiles.length > 0) {
        for (const additionalFile of additionalFiles) {
          try {
            await uploadProductExtraFile(
              additionalFile.file, 
              product.id, 
              additionalFile.file.name,
              `Additional file for the product ${product.name}`
            );
          } catch (error) {

            toast.error(`Error uploading file: ${additionalFile.file.name}`);
          }
        }
        toast.success(`Uploaded ${additionalFiles.length} additional files`);
      }

      setSelectedFiles([]);
      onOpenChange(false);

    } catch (error) {

      toast.error('Error uploading files');
    } finally {
      setUploading(false);
    }
  };

  const getSelectedFilesCount = (type: 'logo' | 'banner' | 'file' | 'additional') => {
    return selectedFiles.filter(f => f.type === type).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Upload Files for Product
          </DialogTitle>
          <DialogDescription>
            Upload files for the product "{product.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">{product.name}</h4>
              <p className="text-sm text-muted-foreground">
                {product.description || 'No description available'}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Version: {product.version}</span>
                <span>Status: {product.status}</span>
                <span>Type: {product.is_multi_app ? 'Multi-App' : 'Product Library'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-blue-500" />
              <label className="text-base font-medium">Product Logo</label>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <FileUpload
              onFilesSelect={(files) => handleFileSelect(files, 'logo')}
              multiple={false}
              accept="image/*"
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-purple-500" />
              <label className="text-base font-medium">Product Banner</label>
              <Badge variant="outline" className="text-xs">Recommended</Badge>
            </div>
            <FileUpload
              onFilesSelect={(files) => handleFileSelect(files, 'banner')}
              multiple={false}
              accept="image/*"
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              <label className="text-base font-medium">Product File</label>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <FileUpload
              onFilesSelect={(files) => handleFileSelect(files, 'file')}
              multiple={false}
              accept="*/*"
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-500" />
              <label className="text-base font-medium">Additional Files</label>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <MultiFileUpload
              onFilesUpload={async (files: any[]) => {
                const fileObjects = files.map((f: any) => ({ file: f.file, type: 'additional' }));
                handleFileSelect(fileObjects, 'additional');
              }}
              multiple={true}
              accept="*/*"
            />
          </div>
        </div>
        {storageInfo && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Storage Information</span>
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                {storageInfo.usage_percent.toFixed(1)}% used
              </div>
            </div>
            <div className="mt-2 text-xs text-blue-800 dark:text-blue-200">
              <p>Available space: {storageInfo.available_space_human}</p>
              <p>Total limit: {storageInfo.storage_limit_human}</p>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">
              {selectedFiles.length > 0 
                ? `Ready to upload: ${selectedFiles.length} files`
                : 'Select files to upload'
              }
            </h4>
            <div className="text-xs text-muted-foreground">
              <p>• All files are optional</p>
              <p>• Files will be checked for compliance</p>
              <p>• You will be notified of the result after uploading</p>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Selected files:</div>
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {file.type}: {file.file.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <ConditionalRender permission="products.files_upload" fallback={null}>
            <Button 
              onClick={handleUploadAll}
              disabled={uploading || selectedFiles.length === 0}
              className="min-w-[140px]"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload All Files
                </>
              )}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;