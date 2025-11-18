import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Upload, Settings, Zap, Clock, X, FileText, CheckCircle, AlertCircle, 
  Download, FolderOpen, FileIcon, BarChart3, Sparkles, Shield, Layers, 
  Palette, CloudUpload, Package, HardDrive, File, RefreshCw, ChevronDown, 
  ChevronUp, Network, Repeat, Hash, FolderTree, Tag, Gauge
} from 'lucide-react';
import MultiFileUpload from '@/components/ui/multi-file-upload';
import { useMultiFileUpload } from '@/hooks/use-multi-file-upload';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import type { Game } from '@/entities/game';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';

interface MultiFileUploadDialogProps {
  game: Game | null;
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
  game,
  onUploadComplete
}) => {
  const { hasPermission } = usePermissions();
  const canUploadFiles = hasPermission('games.files_upload') || hasPermission('games.upload_files');
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
    if (!game) {
      return;
    }

    try {
      const results = await uploadFiles(files, game.id, uploadForm, {
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
    <ConditionalRender permission="games.files_upload" fallback={null}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
            disabled={!canUploadFiles}
          >
            <Upload className="h-4 w-4" />
            Multi-File Upload
          </Button>
        </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-primary" />
            Multi-File Upload with Advanced Settings
          </DialogTitle>
          <DialogDescription>
            Upload multiple files simultaneously with advanced configuration options
          </DialogDescription>
        </DialogHeader>

        {}
        {!game ? (
          <Card className="border-dashed border-2 border-muted-foreground/25">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Application Selection Required</h3>
                <p className="text-muted-foreground text-lg mb-6 max-w-md mx-auto">
                  Please select an application first to upload files
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {}
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Basic Settings:</span>
                  </div>

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
              </CardContent>
            </Card>

            {}
            <Collapsible open={advancedSettingsOpen} onOpenChange={setAdvancedSettingsOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">Advanced Settings</CardTitle>
                      </div>
                      {advancedSettingsOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <CardDescription>
                      Configure retry attempts, chunking, compression, and more
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    {}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Reliability & Retry</Label>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
                        <div className="space-y-2">
                          <Label htmlFor="retry-attempts" className="text-xs">Retry Attempts</Label>
                          <div className="flex items-center gap-2">
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
                            <Repeat className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chunk-size" className="text-xs">Chunk Size (MB)</Label>
                          <div className="flex items-center gap-2">
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
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">File Processing</Label>
                      </div>
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
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Upload Performance</Label>
                      </div>
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
                          <div className="flex items-center gap-2">
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
                            <Gauge className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">File Naming</Label>
                      </div>
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
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {}
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">File Info:</span>
                  </div>

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
              </CardContent>
            </Card>

            {}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  File Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MultiFileUpload
                  onFilesUpload={handleUpload}
                  multiple={true}
                  maxFiles={uploadSettings.maxFiles}
                  maxSize={uploadSettings.maxSize}
                  autoUpload={uploadSettings.autoUpload}
                  className="w-full"
                />
              </CardContent>
            </Card>

            {}
            {uploading && (
              <Card className="mb-4">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Upload Progress:</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
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
                </CardContent>
              </Card>
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
