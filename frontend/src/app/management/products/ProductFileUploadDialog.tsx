import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import FileUpload from '@/components/ui/file-upload';
import MultiFileUpload from '@/components/ui/multi-file-upload';
import { uploadProductFiles, uploadProductExtraFile, getFileStats } from '@/entities/file';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import type { Product } from '@/entities/product';
import type { FileStats } from '@/entities/file';
import { 
  Package, 
  Image, 
  FileText, 
  Cloud,
  Upload,
  Loader2,
  Settings,
  X,
  CheckCircle,
  AlertCircle,
  HardDrive,
  BarChart3,
  FileIcon,
  Zap,
  Clock,
  Sparkles,
  Star,
  Shield,
  Trophy,
  Database,
  Palette,
  Monitor,
  Download,
  Layers,
  Wand2,
  CloudUpload
} from 'lucide-react';

interface ProductFileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onUploadComplete?: () => void;
}

interface SelectedFile {
  file: File;
  type: 'logo' | 'banner' | 'file' | 'additional';
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

interface FileSettings {
  category: 'config' | 'resource';
  version: string;
  description: string;
}

const ProductFileUploadDialog: React.FC<ProductFileUploadDialogProps> = ({ 
  open, 
  onOpenChange, 
  product, 
  onUploadComplete 
}) => {
  const { token } = useAuth();
  const { hasPermission } = usePermissions();
  const canUploadFiles = hasPermission('products.files_upload') || hasPermission('products.upload_files');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<FileStats['storage_info'] | null>(null);
  const [showFileSettings, setShowFileSettings] = useState(false);
  const [fileSettings, setFileSettings] = useState<FileSettings>({
    category: 'resource',
    version: '1.0.0',
    description: ''
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    current: ''
  });

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

    const newFiles: SelectedFile[] = files.map((fileWithPreview, index) => ({
      file: fileWithPreview.file,
      type,
      id: `${type}-${Date.now()}-${index}`,
      status: 'pending'
    }));

    setSelectedFiles(prev => {

      const filtered = prev.filter(f => f.type !== type);
      return [...filtered, ...newFiles];
    });
  };

  const removeFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleUploadAll = async () => {
    if (!token || selectedFiles.length === 0) {
      toast.error('No files to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStats({
      total: selectedFiles.length,
      completed: 0,
      failed: 0,
      current: ''
    });

    try {

      const mainFiles = selectedFiles.filter(f => f.type !== 'additional');
      const additionalFiles = selectedFiles.filter(f => f.type === 'additional');

      let completedCount = 0;
      let failedCount = 0;

      if (mainFiles.length > 0) {
        const filesToUpload = mainFiles.map(f => ({
          file: f.file,
          type: f.type as 'logo' | 'banner' | 'file'
        }));

        setSelectedFiles(prev => prev.map(f => 
          mainFiles.some(mf => mf.id === f.id) ? { ...f, status: 'uploading' } : f
        ));

        try {
          await uploadProductFiles(product.id, filesToUpload);

          setSelectedFiles(prev => prev.map(f => 
            mainFiles.some(mf => mf.id === f.id) ? { ...f, status: 'success' } : f
          ));

          completedCount += mainFiles.length;
          toast.success(`Uploaded ${mainFiles.length} main files`);
        } catch (error) {

          setSelectedFiles(prev => prev.map(f => 
            mainFiles.some(mf => mf.id === f.id) ? { 
              ...f, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed'
            } : f
          ));
          failedCount += mainFiles.length;
        }
      }

      if (additionalFiles.length > 0) {
        for (const additionalFile of additionalFiles) {
          try {

            setSelectedFiles(prev => prev.map(f => 
              f.id === additionalFile.id ? { ...f, status: 'uploading' } : f
            ));

            setUploadStats(prev => ({ ...prev, current: additionalFile.file.name }));

            await uploadProductExtraFile(
              additionalFile.file, 
              product.id, 
              additionalFile.file.name,
              fileSettings.description || `Additional file for the product ${product.name}`
            );

            setSelectedFiles(prev => prev.map(f => 
              f.id === additionalFile.id ? { ...f, status: 'success' } : f
            ));

            completedCount++;
          } catch (error) {

            setSelectedFiles(prev => prev.map(f => 
              f.id === additionalFile.id ? { 
                ...f, 
                status: 'error', 
                error: error instanceof Error ? error.message : 'Upload failed'
              } : f
            ));
            failedCount++;
          }

          const totalProcessed = completedCount + failedCount;
          setUploadProgress((totalProcessed / selectedFiles.length) * 100);
        }
      }

      setUploadStats(prev => ({
        ...prev,
        completed: completedCount,
        failed: failedCount,
        current: ''
      }));

      if (failedCount === 0) {
        toast.success(`Successfully uploaded all ${completedCount} files`);
      } else if (completedCount > 0) {
        toast.warning(`Uploaded ${completedCount} files, ${failedCount} failed`);
      } else {
        toast.error('All uploads failed');
      }

      setTimeout(() => {
        setSelectedFiles([]);
        onOpenChange(false);
        onUploadComplete?.();
      }, 2000);

    } catch (error) {

      toast.error('Error uploading files');
    } finally {
      setUploading(false);
    }
  };

  const getSelectedFilesCount = (type: 'logo' | 'banner' | 'file' | 'additional') => {
    return selectedFiles.filter(f => f.type === type).length;
  };

  const getFileStatusIcon = (status: SelectedFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <FileIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-primary" />
            Upload Files for Product
          </DialogTitle>
          <DialogDescription>
            Upload files for the product <span className="font-medium text-primary">"{product.name}"</span>
          </DialogDescription>
        </DialogHeader>

        {}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Settings:</span>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <Label htmlFor="category" className="text-xs whitespace-nowrap">Category</Label>
                <Select
                  value={fileSettings.category}
                  onValueChange={(value: 'config' | 'resource') => 
                    setFileSettings(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="config">Config</SelectItem>
                    <SelectItem value="resource">Resource</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <Label htmlFor="version" className="text-xs whitespace-nowrap">Version</Label>
                <Input
                  id="version"
                  value={fileSettings.version}
                  onChange={(e) => 
                    setFileSettings(prev => ({ ...prev, version: e.target.value }))
                  }
                  placeholder="1.0.0"
                  className="h-8 w-24"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 w-full sm:w-auto">
                <Label htmlFor="description" className="text-xs whitespace-nowrap">Description</Label>
                <Input
                  id="description"
                  value={fileSettings.description}
                  onChange={(e) => 
                    setFileSettings(prev => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="File description..."
                  className="h-8 min-w-0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                Product Logo
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </CardTitle>
              <CardDescription>
                Upload your product's logo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload
                onFilesSelect={(files) => handleFileSelect(files, 'logo')}
                multiple={false}
                accept="image/*"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-4 w-4 text-muted-foreground" />
                Product Banner
                <Badge variant="outline" className="text-xs">Recommended</Badge>
              </CardTitle>
              <CardDescription>
                Upload your product's banner image
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload
                onFilesSelect={(files) => handleFileSelect(files, 'banner')}
                multiple={false}
                accept="image/*"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Product File
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </CardTitle>
              <CardDescription>
                Upload your product's main file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload
                onFilesSelect={(files) => handleFileSelect(files, 'file')}
                multiple={false}
                accept="*/*"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Additional Files
                <Badge variant="outline" className="text-xs">Optional</Badge>
              </CardTitle>
              <CardDescription>
                Upload multiple additional files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MultiFileUpload
                onFilesUpload={async (files: any[]) => {
                  const fileObjects = files.map((f: any) => ({ file: f.file, type: 'additional' }));
                  handleFileSelect(fileObjects, 'additional');
                }}
                multiple={true}
                accept="*/*"
              />
            </CardContent>
          </Card>
        </div>
        {selectedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                Selected Files ({selectedFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getFileStatusIcon(file.status)}
                      <div>
                        <div className="font-medium text-sm">{file.file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {file.type} • {formatFileSize(file.file.size)}
                        </div>
                        {file.error && (
                          <div className="text-xs text-red-500 mt-1">{file.error}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === 'uploading' && file.progress !== undefined && (
                        <div className="w-20">
                          <Progress value={file.progress} className="h-2" />
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        disabled={file.status === 'uploading'}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {}
        {storageInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                Storage Information
              </CardTitle>
              <CardDescription>
                Current storage usage and limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Storage Usage</span>
                  <span className="text-sm text-muted-foreground">
                    {storageInfo.usage_percent.toFixed(1)}% used
                  </span>
                </div>
                <Progress value={storageInfo.usage_percent} className="h-2" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Available space:</span>
                    <div className="font-medium">{storageInfo.available_space_human}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total limit:</span>
                    <div className="font-medium">{storageInfo.storage_limit_human}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {}
        {uploading && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-muted-foreground" />
                Upload Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {uploadStats.current ? `Uploading: ${uploadStats.current}` : 'Processing files...'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {uploadStats.completed + uploadStats.failed} / {uploadStats.total}
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    {uploadStats.completed} completed
                  </div>
                  {uploadStats.failed > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      {uploadStats.failed} failed
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                  <Spinner className="mr-2 h-4 w-4" />
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

export default ProductFileUploadDialog;
