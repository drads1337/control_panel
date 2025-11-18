import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, Image, Package, Cloud, CheckCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { uploadLoaderFiles } from '@/entities/loader';
import FileUpload from '@/components/ui/file-upload';
import { toast } from 'sonner';
import type { Loader } from '@/entities/loader';

interface UploadLoaderFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  loader: Loader | null;
}
const UploadLoaderFilesDialog: React.FC<UploadLoaderFilesDialogProps> = ({ open, onOpenChange, onSuccess, loader }) => {
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
    if (!loader) return;
    try {
      setLoading(true);
      setUploadProgress(0);
      const formData = new FormData();
      Object.entries(selectedFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });
      await uploadLoaderFiles(loader.id, formData);
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
  if (!loader) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Upload Files for Loader
          </DialogTitle>
          <DialogDescription>
            Upload files for the loader "{loader.name}". Supported formats: PNG, JPG, JPEG, GIF, EXE, APK, SO, DMG, DEB, RPM.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Image className="w-4 h-4 text-blue-500" />
                Loader Logo
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
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Image className="w-4 h-4 text-purple-500" />
                Loader Banner
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
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Image className="w-4 h-4 text-indigo-500" />
                Loader Background
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
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
                Loader File (required)
              </Label>
              <FileUpload
                onFilesSelect={(files) => handleFilesSelect(files, 'file')}
                multiple={false}
                accept=".exe,.apk,.so,.dmg,.deb,.rpm"
                maxSize={50 * 1024 * 1024}
                maxFiles={1}
                showPreview={false}
                showProgress={false}
                className="min-h-[140px]"
              />
              {selectedFiles.file && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  File selected: {selectedFiles.file.name}
                </div>
              )}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium text-foreground">File Requirements:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Image className="w-3 h-3 text-blue-500" />
                <span>Logo: PNG, JPG, JPEG, GIF (up to 5MB)</span>
              </div>
              <div className="flex items-center gap-2">
                <Image className="w-3 h-3 text-purple-500" />
                <span>Banner: PNG, JPG, JPEG, GIF (up to 10MB)</span>
              </div>
              <div className="flex items-center gap-2">
                <Image className="w-3 h-3 text-indigo-500" />
                <span>Background: PNG, JPG, JPEG, GIF (up to 15MB)</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-3 h-3 text-orange-500" />
                <span>File: EXE, APK, SO, DMG, DEB, RPM (up to 50MB)</span>
              </div>
            </div>
          </div>
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedFiles.file}
              className="min-w-[140px]"
            >
              {loading ? (
                <Spinner size="sm" message="Uploading..." className="py-0" />
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Files
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default UploadLoaderFilesDialog;