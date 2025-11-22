import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronUp
} from 'lucide-react';
import MultiFileUpload from '@/components/ui/multi-file-upload';
import { useMultiFileUpload } from '@/hooks/use-multi-file-upload';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import type { Product } from '@/entities/product';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

interface MultiFileUploadDialogProps {
  product: Product | null;
  onUploadComplete?: () => void;
}

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
  uploadStartTime?: number;
}

const MultiFileUploadDialog: React.FC<MultiFileUploadDialogProps> = ({
  product,
  onUploadComplete
}) => {
  const { hasPermission } = usePermissions();
  const canUploadFiles = hasPermission('products.files_upload') || hasPermission('products.upload_files');
  const [open, setOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    isPublic: true,
    category: 'resource' as 'config' | 'resource'
  });
  const [uploadSettings, setUploadSettings] = useState({
    uploadInParallel: true,
    autoUpload: false,
    maxFiles: 50,
    maxSize: 100 * 1024 * 1024,
    retryAttempts: 3,
    chunkSize: 5 * 1024 * 1024,
    enableCompression: false,
    preserveFolderStructure: false,
    autoRenameDuplicates: true,
    uploadPriority: 'normal' as 'high' | 'normal' | 'low',
    bandwidthLimit: 0,
    validateFiles: true,
    customNamingPattern: '',
    addTimestamp: true,
    addHash: false
  });
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

  const { uploading, uploadStats, uploadFiles, resetStats } = useMultiFileUpload();

  const handleFilesSelect = (files: FileWithPreview[]) => {
    setSelectedFiles(files);
  };

  const handleUpload = async (files: FileWithPreview[]) => {
    if (!product) {
      return;
    }

    try {
      const results = await uploadFiles(files, product.id, uploadForm, {
        uploadInParallel: uploadSettings.uploadInParallel,
        onProgress: (fileId, progress) => {
          setSelectedFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, progress } : f
          ));
        },
        onFileComplete: (fileId, success) => {
          setSelectedFiles(prev => prev.map(f => 
            f.id === fileId ? { 
              ...f, 
              status: success ? 'success' : 'error',
              progress: success ? 100 : 0
            } : f
          ));
        }
      });

      setTimeout(() => {

        onUploadComplete?.();
      }, 1000);
      setOpen(false);
      setSelectedFiles([]);
      resetStats();
    } catch (error) {

      toast.error(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const resetForm = () => {
    setUploadForm({
      name: '',
      description: '',
      version: '1.0.0',
      isPublic: true,
      category: 'config'
    });
    setSelectedFiles([]);
    resetStats();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ConditionalRender permission="products.files_upload" fallback={null}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={!canUploadFiles}
          >
            Multi-File Upload
          </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Multi-File Upload with Advanced Settings
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Upload multiple files simultaneously with advanced configuration options
          </DialogDescription>
        </DialogHeader>

        {}
        {!product ? (
          <div className="border-dashed border-2 border-muted-foreground/25 rounded-lg p-8">
            <div className="text-center">
              <h3 className="text-base font-semibold mb-2">Product Selection Required</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Please select an product first to upload files
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-wrap p-3 border rounded-lg">
              <span className="text-sm font-medium">Basic Settings:</span>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="parallel-upload" className="text-xs whitespace-nowrap">Parallel Upload</Label>
                    <Switch
                      id="parallel-upload"
                      checked={uploadSettings.uploadInParallel}
                      onCheckedChange={(checked) => 
                        setUploadSettings(prev => ({ ...prev, uploadInParallel: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-upload" className="text-xs whitespace-nowrap">Auto Upload</Label>
                    <Switch
                      id="auto-upload"
                      checked={uploadSettings.autoUpload}
                      onCheckedChange={(checked) => 
                        setUploadSettings(prev => ({ ...prev, autoUpload: checked }))
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="max-files" className="text-xs whitespace-nowrap">Max Files</Label>
                    <Input
                      id="max-files"
                      type="number"
                      value={uploadSettings.maxFiles}
                      onChange={(e) => 
                        setUploadSettings(prev => ({ 
                          ...prev, 
                          maxFiles: parseInt(e.target.value) || 50 
                        }))
                      }
                      min="1"
                      max="100"
                      className="h-8 w-16"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="max-size" className="text-xs whitespace-nowrap">Max Size (MB)</Label>
                    <Input
                      id="max-size"
                      type="number"
                      value={uploadSettings.maxSize / (1024 * 1024)}
                      onChange={(e) => 
                        setUploadSettings(prev => ({ 
                          ...prev, 
                          maxSize: (parseInt(e.target.value) || 100) * 1024 * 1024 
                        }))
                      }
                      min="1"
                      max="1000"
                      className="h-8 w-20"
                    />
                  </div>
            </div>

            <Collapsible open={advancedSettingsOpen} onOpenChange={setAdvancedSettingsOpen}>
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer hover:bg-muted/50 transition-colors p-4 border-b">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold">Advanced Settings</span>
                      {advancedSettingsOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure retry attempts, chunking, compression, and more
                    </p>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 p-4">
                    {}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Reliability & Retry</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                        <div className="space-y-2">
                          <Label htmlFor="retry-attempts" className="text-xs">Retry Attempts</Label>
                          <Input
                            id="retry-attempts"
                            type="number"
                            value={uploadSettings.retryAttempts}
                            onChange={(e) => 
                              setUploadSettings(prev => ({ 
                                ...prev, 
                                retryAttempts: Math.max(0, parseInt(e.target.value) || 3)
                              }))
                            }
                            min="0"
                            max="10"
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chunk-size" className="text-xs">Chunk Size (MB)</Label>
                          <Input
                            id="chunk-size"
                            type="number"
                            value={uploadSettings.chunkSize / (1024 * 1024)}
                            onChange={(e) => 
                              setUploadSettings(prev => ({ 
                                ...prev, 
                                chunkSize: (parseInt(e.target.value) || 5) * 1024 * 1024
                              }))
                            }
                            min="1"
                            max="50"
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">File Processing</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="enable-compression" className="text-xs">Enable Compression</Label>
                            <p className="text-xs text-muted-foreground">Compress files before upload</p>
                          </div>
                          <Switch
                            id="enable-compression"
                            checked={uploadSettings.enableCompression}
                            onCheckedChange={(checked) => 
                              setUploadSettings(prev => ({ ...prev, enableCompression: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="preserve-structure" className="text-xs">Preserve Folder Structure</Label>
                            <p className="text-xs text-muted-foreground">Maintain directory hierarchy</p>
                          </div>
                          <Switch
                            id="preserve-structure"
                            checked={uploadSettings.preserveFolderStructure}
                            onCheckedChange={(checked) => 
                              setUploadSettings(prev => ({ ...prev, preserveFolderStructure: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="auto-rename" className="text-xs">Auto Rename Duplicates</Label>
                            <p className="text-xs text-muted-foreground">Automatically rename duplicate files</p>
                          </div>
                          <Switch
                            id="auto-rename"
                            checked={uploadSettings.autoRenameDuplicates}
                            onCheckedChange={(checked) => 
                              setUploadSettings(prev => ({ ...prev, autoRenameDuplicates: checked }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="validate-files" className="text-xs">Validate Files</Label>
                            <p className="text-xs text-muted-foreground">Check file integrity</p>
                          </div>
                          <Switch
                            id="validate-files"
                            checked={uploadSettings.validateFiles}
                            onCheckedChange={(checked) => 
                              setUploadSettings(prev => ({ ...prev, validateFiles: checked }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Upload Performance</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                        <div className="space-y-2">
                          <Label htmlFor="upload-priority" className="text-xs">Upload Priority</Label>
                          <Select
                            value={uploadSettings.uploadPriority}
                            onValueChange={(value: 'high' | 'normal' | 'low') => 
                              setUploadSettings(prev => ({ ...prev, uploadPriority: value }))
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High Priority</SelectItem>
                              <SelectItem value="normal">Normal Priority</SelectItem>
                              <SelectItem value="low">Low Priority</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bandwidth-limit" className="text-xs">Bandwidth Limit (MB/s)</Label>
                          <Input
                            id="bandwidth-limit"
                            type="number"
                            value={uploadSettings.bandwidthLimit || ''}
                            onChange={(e) => 
                              setUploadSettings(prev => ({ 
                                ...prev, 
                                bandwidthLimit: parseInt(e.target.value) || 0
                              }))
                            }
                            min="0"
                            placeholder="0 = Unlimited"
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">File Naming</Label>
                      <div className="space-y-3 pl-6">
                        <div className="space-y-2">
                          <Label htmlFor="naming-pattern" className="text-xs">Custom Naming Pattern</Label>
                          <Input
                            id="naming-pattern"
                            value={uploadSettings.customNamingPattern}
                            onChange={(e) => 
                              setUploadSettings(prev => ({ ...prev, customNamingPattern: e.target.value }))
                            }
                            placeholder="e.g., {name}_{timestamp}_{hash}"
                            className="h-8"
                          />
                          <p className="text-xs text-muted-foreground">
                            Available: {'{name}'}, {'{timestamp}'}, {'{hash}'}, {'{index}'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="add-timestamp" className="text-xs">Add Timestamp</Label>
                              <p className="text-xs text-muted-foreground">Append timestamp to filename</p>
                            </div>
                            <Switch
                              id="add-timestamp"
                              checked={uploadSettings.addTimestamp}
                              onCheckedChange={(checked) => 
                                setUploadSettings(prev => ({ ...prev, addTimestamp: checked }))
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="add-hash" className="text-xs">Add Hash</Label>
                              <p className="text-xs text-muted-foreground">Include file hash in name</p>
                            </div>
                            <Switch
                              id="add-hash"
                              checked={uploadSettings.addHash}
                              onCheckedChange={(checked) => 
                                setUploadSettings(prev => ({ ...prev, addHash: checked }))
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-wrap p-3 border rounded-lg">
              <span className="text-sm font-medium">File Info:</span>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="category" className="text-xs whitespace-nowrap">Category</Label>
                    <Select
                      value={uploadForm.category}
                      onValueChange={(value: 'config' | 'resource') => 
                        setUploadForm(prev => ({ ...prev, category: value }))
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

                  <div className="flex items-center gap-2">
                    <Label htmlFor="version" className="text-xs whitespace-nowrap">Version</Label>
                    <Input
                      id="version"
                      value={uploadForm.version}
                      onChange={(e) => 
                        setUploadForm(prev => ({ ...prev, version: e.target.value }))
                      }
                      placeholder="1.0.0"
                      className="h-8 w-20"
                    />
                  </div>

                  <div className="flex items-center gap-2 flex-1">
                    <Label htmlFor="description" className="text-xs whitespace-nowrap">Description</Label>
                    <Input
                      id="description"
                      value={uploadForm.description}
                      onChange={(e) => 
                        setUploadForm(prev => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="File description..."
                      className="h-8 min-w-0"
                    />
                  </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="mb-3">
                <span className="text-sm font-medium">File Upload</span>
              </div>
              <MultiFileUpload
                onFilesUpload={handleUpload}
                multiple={true}
                maxFiles={uploadSettings.maxFiles}
                maxSize={uploadSettings.maxSize}
                autoUpload={uploadSettings.autoUpload}
                className="w-full"
              />
            </div>

            {uploading && (
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm font-medium">Upload Progress:</span>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{uploadStats.total}</span>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <span>✓</span>
                    <span>{uploadStats.completed}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-600">
                    <span>✗</span>
                    <span>{uploadStats.failed}</span>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-600">
                    <span>⏳</span>
                    <span>{uploadStats.total - uploadStats.completed - uploadStats.failed}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)} 
            disabled={uploading}
          >
            Cancel
          </Button>
          {uploading && (
            <Button disabled>
              <Spinner className="h-4 w-4 mr-2" />
              Uploading...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </ConditionalRender>
  );
};

export default MultiFileUploadDialog;
