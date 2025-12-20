import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FileUpload from '@/components/ui/file-upload';
import MultiFileUpload from '@/components/ui/multi-file-upload';
import { uploadProductFiles, uploadProductExtraFile, getFileStats } from '@/entities/file';
import { useAuth } from '@/lib/hooks';
import { usePermissions } from '@/lib/hooks';
import { ConditionalRender } from '@/lib/rbac/conditional-render';
import { toast } from 'sonner';
import { sanitizeString } from '@/lib/utils/sanitization';
import { cn } from '@/lib/utils';
import type { Product } from '@/entities/product';
import type { FileStats } from '@/entities/file';
import { 
  Package, 
  Image, 
  FileText, 
  Cloud,
  Upload,
  Loader2,
  FileArchive,
  Layers,
  CheckCircle2,
  Database,
  HardDrive
} from 'lucide-react';

interface UploadProductFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

interface SelectedFile {
  file: File;
  type: 'logo' | 'banner' | 'file' | 'additional';
}

const UploadProductFilesDialog: React.FC<UploadProductFilesDialogProps> = ({ open, onOpenChange, product }) => {
  const { token } = useAuth();
  const { hasPermission } = usePermissions();
  const canUploadFiles = hasPermission('products.files_upload') || hasPermission('products.upload_files');
  
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<FileStats['storage_info'] | null>(null);
  const [fileStats, setFileStats] = useState<FileStats | null>(null);

  useEffect(() => {
    if (open && token) {
      loadStorageInfo();
      setSelectedFiles([]); // Reset selection on open
    }
  }, [open, token]);

  const loadStorageInfo = async () => {
    try {
      const stats = await getFileStats();
      setStorageInfo(stats.storage_info);
      setFileStats(stats);
    } catch (error) {
      console.error("Failed to load storage stats", error);
    }
  };

  if (!product || !canUploadFiles) return null;

  const handleFileSelect = (files: any[], type: 'logo' | 'banner' | 'file' | 'additional') => {
    // Normalize input: files might be File[] or objects containing File
    const newFiles = files.map(f => ({ 
      file: f.file || f, // Handle if component returns {file: File, preview: string} or just File
      type 
    }));

    setSelectedFiles(prev => {
      // For single-file types, replace existing. For multi, append (or replace depending on logic, here we replace per category for simplicity in UI sync)
      const filtered = prev.filter(f => f.type !== type);
      return [...filtered, ...newFiles];
    });
  };

  const handleUploadAll = async () => {
    if (!token || selectedFiles.length === 0) {
      toast.error('No files selected to upload');
      return;
    }

    setUploading(true);

    try {
      const mainFiles = selectedFiles.filter(f => f.type !== 'additional');
      const additionalFiles = selectedFiles.filter(f => f.type === 'additional');

      // 1. Upload Main Product Assets (Logo, Banner, Main File)
      if (mainFiles.length > 0) {
        const filesToUpload = mainFiles.map(f => ({
          file: f.file,
          type: f.type as 'logo' | 'banner' | 'file'
        }));

        await uploadProductFiles(product.id, filesToUpload);
      }

      // 2. Upload Additional Files one by one
      if (additionalFiles.length > 0) {
        // Using Promise.allSettled to prevent one failure stopping others
        const results = await Promise.allSettled(
          additionalFiles.map(f => 
            uploadProductExtraFile(
              f.file, 
              product.id, 
              f.file.name,
              `Additional file for ${product.name}`
            )
          )
        );

        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
          toast.warning(`Uploaded with ${failed.length} errors`);
        }
      }

      toast.success('Upload process completed');
      setSelectedFiles([]);
      onOpenChange(false);
      loadStorageInfo(); // Refresh stats

    } catch (error) {
      console.error(error);
      toast.error('An unexpected error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const getSelectedCount = (type: string) => selectedFiles.filter(f => f.type === type).length;

  return (
    <Dialog open={open} onOpenChange={(val) => !uploading && onOpenChange(val)}>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b bg-background z-10">
          <DialogTitle className="flex items-center gap-2.5 text-xl">
            <div className="p-2 bg-primary/10 rounded-md">
              <Cloud className="h-5 w-5 text-primary" />
            </div>
            Upload Product Files
          </DialogTitle>
          <DialogDescription>
            Manage assets and binaries for this product version.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Product Summary Card */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/40 rounded-xl border mb-6 items-start sm:items-center">
            <div className="w-12 h-12 rounded-lg bg-background border flex items-center justify-center shrink-0 shadow-sm">
              {product.logo ? (
                <img src={product.logo} alt="logo" className="w-8 h-8 object-contain" />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-base truncate">{product.name}</h4>
                <Badge variant="outline" className="h-5 text-[10px] font-sans">v{product.version}</Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {product.description ? sanitizeString(product.description) : 'No description provided'}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
               <Badge variant={product.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                 {product.status}
               </Badge>
            </div>
          </div>

          {/* Upload Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* LOGO */}
            <div className={cn("space-y-3 p-4 rounded-xl border transition-all", getSelectedCount('logo') ? "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" : "bg-card")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Image className="w-4 h-4" />
                  <span className="font-medium text-sm">Product Logo</span>
                </div>
                {getSelectedCount('logo') > 0 && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
              </div>
              <FileUpload
                onFilesSelect={(files) => handleFileSelect(files, 'logo')}
                multiple={false}
                accept="image/*"
              />
              <p className="text-[11px] text-muted-foreground">Recommended: 512x512px PNG or SVG</p>
            </div>

            {/* BANNER */}
            <div className={cn("space-y-3 p-4 rounded-xl border transition-all", getSelectedCount('banner') ? "bg-purple-50/50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800" : "bg-card")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Layers className="w-4 h-4" />
                  <span className="font-medium text-sm">Promo Banner</span>
                </div>
                {getSelectedCount('banner') > 0 && <CheckCircle2 className="w-4 h-4 text-purple-500" />}
              </div>
              <FileUpload
                onFilesSelect={(files) => handleFileSelect(files, 'banner')}
                multiple={false}
                accept="image/*"
              />
              <p className="text-[11px] text-muted-foreground">Recommended: 1920x1080px JPG or PNG</p>
            </div>

            {/* MAIN FILE */}
            <div className={cn("space-y-3 p-4 rounded-xl border transition-all", getSelectedCount('file') ? "bg-orange-50/50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800" : "bg-card")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <FileArchive className="w-4 h-4" />
                  <span className="font-medium text-sm">Main Distribution</span>
                </div>
                {getSelectedCount('file') > 0 && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
              </div>
              <FileUpload
                onFilesSelect={(files) => handleFileSelect(files, 'file')}
                multiple={false}
                accept="*/*"
              />
              <p className="text-[11px] text-muted-foreground">Main executable, installer, or zip bundle</p>
            </div>

            {/* ADDITIONAL FILES */}
            <div className={cn("space-y-3 p-4 rounded-xl border transition-all", getSelectedCount('additional') ? "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800" : "bg-card")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium text-sm">Additional Resources</span>
                </div>
                <Badge variant="secondary" className="h-5 px-1.5">{getSelectedCount('additional')}</Badge>
              </div>
              <MultiFileUpload
                onFilesUpload={async (files: any[]) => {
                  // The MultiFileUpload component might trigger upload immediately or just return files depending on implementation.
                  // Assuming here it returns files for manual upload logic based on original code structure.
                  const fileObjects = files.map((f: any) => ({ file: f.file || f }));
                  handleFileSelect(fileObjects, 'additional');
                }}
                multiple={true}
                accept="*/*"
              />
              <p className="text-[11px] text-muted-foreground">Documentation, extra configs, or patch notes</p>
            </div>
          </div>

          {/* Storage Info Bar */}
          {storageInfo && (
             <div className="mt-8 space-y-3">
               <div className="flex items-center justify-between text-sm">
                 <div className="flex items-center gap-2 text-muted-foreground">
                   <HardDrive className="w-4 h-4" />
                   <span>Storage Usage</span>
                 </div>
                 <span className="font-medium">{storageInfo.usage_percent.toFixed(1)}%</span>
               </div>
               <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-500", 
                      storageInfo.usage_percent > 90 ? "bg-red-500" : 
                      storageInfo.usage_percent > 75 ? "bg-yellow-500" : "bg-blue-500"
                    )}
                    style={{ width: `${Math.min(storageInfo.usage_percent, 100)}%` }}
                  />
               </div>
               <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Used: {fileStats?.overview.total_size_human || '0 B'}</span>
                  <span>Limit: {storageInfo.storage_limit_human || 'Unlimited'}</span>
               </div>
             </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 sm:gap-0 gap-2">
          <div className="hidden sm:flex flex-1 items-center text-sm text-muted-foreground">
            {selectedFiles.length > 0 ? (
              <span className="text-foreground font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                {selectedFiles.length} files selected
              </span>
            ) : (
              <span>No files selected</span>
            )}
          </div>
          
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          
          <ConditionalRender permission="products.files_upload" fallback={null}>
            <Button 
              onClick={handleUploadAll}
              disabled={uploading || selectedFiles.length === 0}
              className="gap-2 min-w-[140px]"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Start Upload
                </>
              )}
            </Button>
          </ConditionalRender>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadProductFilesDialog;