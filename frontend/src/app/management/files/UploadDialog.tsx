import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FileUpload from '@/components/ui/file-upload';
import MultiFileUpload from '@/components/ui/multi-file-upload';
import { uploadGameFiles, uploadGameExtraFile, getFileStats } from '@/entities/file';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import type { Game } from '@/entities/game';
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
  game: Game | null;
}

interface SelectedFile {
  file: File;
  type: 'logo' | 'banner' | 'file' | 'additional';
}

const UploadDialog: React.FC<UploadDialogProps> = ({ open, onOpenChange, game }) => {
  const { token } = useAuth();
  const { hasPermission } = usePermissions();
  const canUploadFiles = hasPermission('games.files_upload') || hasPermission('games.upload_files');
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
      console.error('Failed to load storage info:', error);
    }
  };

  if (!game || !canUploadFiles) return null;

  const handleFileSelect = (files: any[], type: 'logo' | 'banner' | 'file' | 'additional') => {
    console.log(`FileSelect called with type: ${type}, files:`, files);
    console.log('Files are File objects:', files.map(f => f.file instanceof globalThis.File));
    
    const newFiles = files.map(fileWithPreview => ({ file: fileWithPreview.file, type }));
    setSelectedFiles(prev => {
      // Remove old files of this type and add the new ones
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
      // Separate files into main (logo, banner, file) and additional
      const mainFiles = selectedFiles.filter(f => f.type !== 'additional');
      const additionalFiles = selectedFiles.filter(f => f.type === 'additional');

      // Upload main files
      if (mainFiles.length > 0) {
        const filesToUpload = mainFiles.map(f => ({
          file: f.file,
          type: f.type as 'logo' | 'banner' | 'file'
        }));
        
        await uploadGameFiles(game.id, filesToUpload);
        toast.success(`Uploaded ${mainFiles.length} main files`);
      }

      // Upload additional files via uploadGameExtraFile
      if (additionalFiles.length > 0) {
        for (const additionalFile of additionalFiles) {
          try {
            await uploadGameExtraFile(
              additionalFile.file, 
              game.id, 
              additionalFile.file.name,
              `Additional file for the game ${game.name}`
            );
          } catch (error) {
            console.error(`Failed to upload additional file ${additionalFile.file.name}:`, error);
            toast.error(`Error uploading file: ${additionalFile.file.name}`);
          }
        }
        toast.success(`Uploaded ${additionalFiles.length} additional files`);
      }

      // Clear selected files and close the dialog
      setSelectedFiles([]);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Upload error:', error);
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
            Upload Files for Game
          </DialogTitle>
          <DialogDescription>
            Upload files for the game "{game.name}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">{game.name}</h4>
              <p className="text-sm text-muted-foreground">
                {game.description || 'No description available'}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Version: {game.version}</span>
                <span>Status: {game.status}</span>
                <span>Type: {game.is_multi_app ? 'Multi-App' : 'Application Library'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Logo Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-blue-500" />
              <label className="text-base font-medium">Game Logo</label>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <FileUpload
              onFilesSelect={(files) => handleFileSelect(files, 'logo')}
              multiple={false}
              accept="image/*"
              maxSize={storageInfo?.available_space || undefined}
              maxFiles={1}
              showPreview={true}
              showProgress={false}
              className="min-h-[140px]"
            />
            {getSelectedFilesCount('logo') > 0 && (
              <div className="text-xs text-green-600 dark:text-green-400">
                ✓ Logo file selected
              </div>
            )}
            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Image className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="font-medium text-blue-900 dark:text-blue-100">Logo Recommendations:</span>
              </div>
              <ul className="space-y-1 ml-6 text-blue-800 dark:text-blue-200">
                <li>• Size: 512x512 pixels or larger</li>
                <li>• Format: PNG with transparency</li>
                <li>• Max size: {storageInfo?.available_space_human || 'Limited by project storage'}</li>
                <li>• Square image for best display</li>
              </ul>
            </div>
          </div>

          {/* Banner Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-purple-500" />
              <label className="text-base font-medium">Game Banner</label>
              <Badge variant="outline" className="text-xs">Recommended</Badge>
            </div>
            <FileUpload
              onFilesSelect={(files) => handleFileSelect(files, 'banner')}
              multiple={false}
              accept="image/*"
              maxSize={storageInfo?.available_space || undefined}
              maxFiles={1}
              showPreview={true}
              showProgress={false}
              className="min-h-[140px]"
            />
            {getSelectedFilesCount('banner') > 0 && (
              <div className="text-xs text-green-600 dark:text-green-400">
                ✓ Banner file selected
              </div>
            )}
            <div className="text-xs text-muted-foreground bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Image className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                <span className="font-medium text-purple-900 dark:text-purple-100">Banner Recommendations:</span>
              </div>
              <ul className="space-y-1 ml-6 text-purple-800 dark:text-purple-200">
                <li>• Size: 1920x1080 pixels (16:9)</li>
                <li>• Format: PNG or JPG</li>
                <li>• Max size: {storageInfo?.available_space_human || 'Limited by project storage'}</li>
                <li>• Horizontal image for best display</li>
              </ul>
            </div>
          </div>

          {/* Game File Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              <label className="text-base font-medium">Game File</label>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <FileUpload
              onFilesSelect={(files) => handleFileSelect(files, 'file')}
              multiple={false}
              accept="*/*"
              maxSize={storageInfo?.available_space || undefined}
              maxFiles={1}
              showPreview={false}
              showProgress={false}
              className="min-h-[140px]"
            />
            {getSelectedFilesCount('file') > 0 && (
              <div className="text-xs text-green-600 dark:text-green-400">
                ✓ Game file selected
              </div>
            )}
            <div className="text-xs text-muted-foreground bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Package className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                <span className="font-medium text-orange-900 dark:text-orange-100">You can upload:</span>
              </div>
              <ul className="space-y-1 ml-6 text-orange-800 dark:text-orange-200">
                <li>• Any file types</li>
                <li>• Max size: {storageInfo?.available_space_human || 'Limited by project storage'}</li>
              </ul>
            </div>
          </div>

          {/* Additional Files Upload */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-500" />
              <label className="text-base font-medium">Additional Files</label>
              <Badge variant="outline" className="text-xs">Optional</Badge>
            </div>
            <MultiFileUpload
              onFilesUpload={async (files: any[]) => {
                // Обрабатываем загрузку множественных файлов
                const fileObjects = files.map((f: any) => ({ file: f.file, type: 'additional' }));
                handleFileSelect(fileObjects, 'additional');
              }}
              multiple={true}
              accept="*/*"
              maxSize={storageInfo?.available_space || undefined}
              maxFiles={10}
              className="min-h-[200px]"
              autoUpload={false}
            />
            {getSelectedFilesCount('additional') > 0 && (
              <div className="text-xs text-green-600 dark:text-green-400">
                ✓ Additional files selected: {getSelectedFilesCount('additional')}
              </div>
            )}
            <div className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span className="font-medium text-green-900 dark:text-green-100">Массовая загрузка файлов:</span>
              </div>
              <ul className="space-y-1 ml-6 text-green-800 dark:text-green-200">
                <li>• Любые типы файлов</li>
                <li>• До 10 файлов одновременно</li>
                <li>• Максимум {storageInfo?.available_space_human || 'Limited by project storage'} на файл</li>
                <li>• Drag & Drop поддержка</li>
                <li>• Параллельная загрузка</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Storage Information */}
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

        {/* Upload Progress and Actions */}
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
          <ConditionalRender permission="games.files_upload" fallback={null}>
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