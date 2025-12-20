import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Settings2, Info } from 'lucide-react';
import MultiFileUpload from '@/components/ui/multi-file-upload';
import { useMultiFileUpload } from '@/hooks/use-multi-file-upload';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import type { Product } from '@/entities/product';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MultiFileUploadDialogProps {
  product: Product | null;
  onUploadComplete?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  onUploadComplete,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}) => {
  const { hasPermission } = usePermissions();
  const canUploadFiles = hasPermission('products.files_upload') || hasPermission('products.upload_files');
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
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

  const handleUpload = async (files: FileWithPreview[]) => {
    if (!product) {
      return;
    }

    try {
      await uploadFiles(files, product.id, uploadForm, {
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
        setOpen(false);
      }, 1000);
      setSelectedFiles([]);
      resetStats();
    } catch (error) {
      toast.error(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const dialogContent = (
    <DialogContent className="w-[95vw] sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-base sm:text-lg">
            Multi-File Upload
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs truncate">
            Upload files for "{product?.name || 'Unknown'}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 sm:space-y-6">
          {!product ? (
            <div className="border-dashed border-2 border-muted-foreground/25 rounded-lg p-8 text-center">
              <h3 className="text-base font-semibold mb-2">Product Required</h3>
              <p className="text-muted-foreground text-sm">Please select a product first.</p>
            </div>
          ) : (
            <>
              {/* Basic Settings Group */}
              <div className="bg-muted/30 rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                  <span className="text-sm font-medium">Basic Settings</span>
                </div>
                
                <div className="grid grid-cols-2 sm:flex sm:flex-row sm:items-center gap-4 sm:gap-6">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="parallel-upload"
                        checked={uploadSettings.uploadInParallel}
                        onCheckedChange={(checked) => setUploadSettings(prev => ({ ...prev, uploadInParallel: checked }))}
                      />
                      <Label htmlFor="parallel-upload" className="text-xs cursor-pointer">Parallel</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="auto-upload"
                        checked={uploadSettings.autoUpload}
                        onCheckedChange={(checked) => setUploadSettings(prev => ({ ...prev, autoUpload: checked }))}
                      />
                      <Label htmlFor="auto-upload" className="text-xs cursor-pointer">Auto-start</Label>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label htmlFor="max-files" className="text-xs text-muted-foreground">Max Files</Label>
                    <Input
                      id="max-files"
                      type="number"
                      value={uploadSettings.maxFiles}
                      onChange={(e) => setUploadSettings(prev => ({ ...prev, maxFiles: parseInt(e.target.value) || 50 }))}
                      min="1"
                      max="100"
                      className="h-8 w-full sm:w-20 text-base sm:text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 min-w-0">
                    <Label htmlFor="max-size" className="text-xs text-muted-foreground">Max Size (MB)</Label>
                    <Input
                      id="max-size"
                      type="number"
                      value={uploadSettings.maxSize / (1024 * 1024)}
                      onChange={(e) => setUploadSettings(prev => ({ ...prev, maxSize: (parseInt(e.target.value) || 100) * 1024 * 1024 }))}
                      min="1"
                      max="1000"
                      className="h-8 w-full sm:w-20 text-base sm:text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Settings Accordion */}
              <Collapsible open={advancedSettingsOpen} onOpenChange={setAdvancedSettingsOpen}>
                <div className="border rounded-lg bg-card">
                  <CollapsibleTrigger asChild>
                    <div className="cursor-pointer hover:bg-muted/50 transition-colors p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Advanced Configuration</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Optional</Badge>
                      </div>
                      {advancedSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-3 pt-0 space-y-4">
                      <Separator className="mb-3" />
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1 sm:px-2">
                        {/* Retry & Chunking */}
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold uppercase text-muted-foreground">Reliability</Label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Retries</Label>
                              <Input
                                type="number"
                                value={uploadSettings.retryAttempts}
                                onChange={(e) => setUploadSettings(prev => ({ ...prev, retryAttempts: parseInt(e.target.value) || 3 }))}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Chunk (MB)</Label>
                              <Input
                                type="number"
                                value={uploadSettings.chunkSize / (1024 * 1024)}
                                onChange={(e) => setUploadSettings(prev => ({ ...prev, chunkSize: (parseInt(e.target.value) || 5) * 1024 * 1024 }))}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Toggles */}
                        <div className="space-y-3">
                          <Label className="text-xs font-semibold uppercase text-muted-foreground">Processing</Label>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="comp" className="text-xs">Compression</Label>
                              <Switch id="comp" checked={uploadSettings.enableCompression} onCheckedChange={(c) => setUploadSettings(p => ({...p, enableCompression: c}))} className="scale-75 origin-right"/>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="struct" className="text-xs">Folder Structure</Label>
                              <Switch id="struct" checked={uploadSettings.preserveFolderStructure} onCheckedChange={(c) => setUploadSettings(p => ({...p, preserveFolderStructure: c}))} className="scale-75 origin-right"/>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label htmlFor="rename" className="text-xs">Auto Rename</Label>
                              <Switch id="rename" checked={uploadSettings.autoRenameDuplicates} onCheckedChange={(c) => setUploadSettings(p => ({...p, autoRenameDuplicates: c}))} className="scale-75 origin-right"/>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* File Info Form */}
              <div className="bg-muted/30 rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                 
                  <span className="text-sm font-medium">File Information</span>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:items-end gap-3">
                  <div className="space-y-1.5 col-span-1 sm:w-32">
                    <Label htmlFor="category" className="text-xs">Category</Label>
                    <Select
                      value={uploadForm.category}
                      onValueChange={(value: any) => setUploadForm(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="config">Config</SelectItem>
                        <SelectItem value="resource">Resource</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 col-span-1 sm:w-24">
                    <Label htmlFor="version" className="text-xs">Version</Label>
                    <Input
                      id="version"
                      value={uploadForm.version}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, version: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-2 sm:flex-1">
                    <Label htmlFor="description" className="text-xs">Description</Label>
                    <Input
                      id="description"
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Optional description"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Dropzone & Upload Area */}
              <div className="rounded-lg border p-1">
                <MultiFileUpload
                  onFilesUpload={handleUpload}
                  multiple={true}
                  maxFiles={uploadSettings.maxFiles}
                  maxSize={uploadSettings.maxSize}
                  autoUpload={uploadSettings.autoUpload}
                  className="w-full min-h-[200px]"
                />
              </div>

              {/* Stats Bar */}
              {uploading && (
                <div className="flex items-center justify-between p-3 bg-background border rounded-lg text-xs shadow-sm">
                  <span className="font-medium">Progress:</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-green-600">
                      <span>✓</span> {uploadStats.completed}
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <span>✗</span> {uploadStats.failed}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>Total:</span> {uploadStats.total}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-background flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)} 
            disabled={uploading}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
  );

  if (controlledOpen !== undefined) {
    // Controlled mode - no trigger button
    return (
      <ConditionalRender permission="products.files_upload" fallback={null}>
        <Dialog open={open} onOpenChange={setOpen}>
          {dialogContent}
        </Dialog>
      </ConditionalRender>
    );
  }

  // Uncontrolled mode - with trigger button
  return (
    <ConditionalRender permission="products.files_upload" fallback={null}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={!canUploadFiles}
            className="whitespace-nowrap"
          >
            Multi-Upload
          </Button>
        </DialogTrigger>
        {dialogContent}
      </Dialog>
    </ConditionalRender>
  );
};

export default MultiFileUploadDialog;