import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, Download } from 'lucide-react';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import type { FileItem } from '@/entities/file';

interface FileDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFile: FileItem | null;
  canDownloadFiles: boolean;
  getFileIcon: (fileName: string, fileType?: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
  onDownload: (file: FileItem) => void;
  onClose: () => void;
}

const FileDetailsDialog: React.FC<FileDetailsDialogProps> = ({
  open,
  onOpenChange,
  selectedFile,
  canDownloadFiles,
  getFileIcon,
  formatFileSize,
  onDownload,
  onClose,
}) => {
  const handleDownload = () => {
    if (selectedFile) {
      onClose();
      onDownload(selectedFile);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            File Information
          </DialogTitle>
          <DialogDescription>
            Detailed information about the selected file
          </DialogDescription>
        </DialogHeader>
        {selectedFile ? (
          <div className="grid gap-6 py-4">
            <div className="flex items-center gap-3">
              {getFileIcon(selectedFile.name, selectedFile.type)}
              <div>
                <div className="font-medium text-lg">{selectedFile.name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedFile.category === 'config' && 'Configuration file'}
                  {selectedFile.category === 'resource' && 'Extra file'}
                  {selectedFile.category === 'logo' && 'Logo'}
                  {selectedFile.category === 'banner' && 'Banner'}
                  {selectedFile.category === 'agent' && 'Agent'}
                </div>
              </div>
            </div>

            {selectedFile.description && (
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <div className="text-sm text-muted-foreground mt-1">
                  {selectedFile.description}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">File ID</Label>
                <div className="text-sm text-muted-foreground font-mono">
                  {selectedFile.id}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Size</Label>
                <div className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="text-sm">
                  <Badge variant={selectedFile.status === 'active' ? 'default' : 'secondary'}>
                    {selectedFile.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Modified</Label>
                <div className="text-sm text-muted-foreground">
                  {new Date(selectedFile.modified).toLocaleString()}
                </div>
              </div>
            </div>

            {selectedFile.version && (
              <div>
                <Label className="text-sm font-medium">Version</Label>
                <div className="text-sm text-muted-foreground">
                  v{selectedFile.version}
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">Last Modified</Label>
              <div className="text-sm text-muted-foreground">
                {new Date(selectedFile.modified).toLocaleString('en-US')}
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {selectedFile && (
            <ConditionalRender permission="products.files_download" fallback={null}>
              <Button onClick={handleDownload} disabled={!canDownloadFiles}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </ConditionalRender>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FileDetailsDialog;