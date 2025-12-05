import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, Download } from 'lucide-react';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { sanitizeString } from '@/lib/sanitization';
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
      {/* 
        w-[95vw]: почти полная ширина на мобильном
        max-h-[85vh] + overflow-y-auto: скролл, если контент не влезает по высоте
      */}
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            File Information
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Detailed information about the selected file
          </DialogDescription>
        </DialogHeader>

        {selectedFile ? (
          <div className="grid gap-4 sm:gap-6 py-2 sm:py-4">
            {/* Header with Icon and Name */}
            <div className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg">
              <div className="shrink-0 mt-1">
                {getFileIcon(selectedFile.name, selectedFile.type)}
              </div>
              <div className="min-w-0 flex-1">
                {/* break-words/break-all: предотвращает выход длинных имен за пределы контейнера */}
                <div className="font-medium text-base sm:text-lg break-words leading-tight mb-1">
                  {selectedFile.name}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  {selectedFile.category === 'config' && 'Configuration file'}
                  {selectedFile.category === 'resource' && 'Extra file'}
                  {selectedFile.category === 'logo' && 'Logo'}
                  {selectedFile.category === 'banner' && 'Banner'}
                  {selectedFile.category === 'agent' && 'Agent'}
                </div>
              </div>
            </div>

            {selectedFile.description && (
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm font-medium">Description</Label>
                <div className="text-xs sm:text-sm text-muted-foreground bg-muted/20 p-2 rounded-md break-words">
                  {sanitizeString(selectedFile.description)}
                </div>
              </div>
            )}

            {/* 
              Grid Layout:
              grid-cols-1: на мобильном свойства идут друг под другом
              sm:grid-cols-2: на планшете в две колонки
            */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">File ID</Label>
                <div className="text-sm font-sans mt-0.5 break-all">
                  {selectedFile.id}
                </div>
              </div>
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Size</Label>
                <div className="text-sm mt-0.5">
                  {formatFileSize(selectedFile.size)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge variant={selectedFile.status === 'active' ? 'default' : 'secondary'}>
                    {selectedFile.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Modified</Label>
                <div className="text-sm mt-0.5">
                  {new Date(selectedFile.modified).toLocaleString()}
                </div>
              </div>
            </div>

            {selectedFile.version && (
              <div>
                <Label className="text-xs sm:text-sm font-medium text-muted-foreground">Version</Label>
                <div className="text-sm mt-0.5">
                  v{selectedFile.version}
                </div>
              </div>
            )}
            
            {/* Дублирование Last Modified убрано (оно было выше), или можно оставить как доп инфо */}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto order-1 sm:order-none">
            Close
          </Button>
          {selectedFile && (
            <ConditionalRender permission="products.files_download" fallback={null}>
              <Button onClick={handleDownload} disabled={!canDownloadFiles} className="w-full sm:w-auto order-0 sm:order-none">
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