import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Upload, 
  File as FileIcon, 
  X, 
  CheckCircle, 
  AlertCircle,
  CloudUpload,
  Trash2
} from 'lucide-react';

const GlobalFile = globalThis.File;

export interface MultiFileUploadProps {
  onFilesUpload: (files: FileWithPreview[]) => Promise<void>;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  autoUpload?: boolean;
}

interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

const MultiFileUpload: React.FC<MultiFileUploadProps> = ({
  onFilesUpload,
  multiple = true,
  accept,
  maxSize = 100 * 1024 * 1024,
  maxFiles = 10,
  disabled = false,
  className,
  autoUpload = false
}) => {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File exceeds maximum size of ${formatFileSize(maxSize)}`;
    }
    if (accept && accept !== '*') {
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      const fileType = file.type || '';
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      const isAccepted = acceptedTypes.some((type) => {
        if (type.startsWith('.')) {
          return fileExtension === type;
        }
        if (type.endsWith('/*')) {
          const baseType = type.slice(0, -2);
          return fileType.startsWith(`${baseType}/`);
        }
        return fileType === type;
      });

      if (!isAccepted) {
        return `File type not accepted. Accepted types: ${accept}`;
      }
    }
    return null;
  };

  const handleUpload = React.useCallback(async (filesToUpload: FileWithPreview[]) => {
    if (filesToUpload.length === 0 || uploading) return;

    setUploading(true);

    for (const fileWithPreview of filesToUpload) {
      if (fileWithPreview.status !== 'pending') continue;

      setSelectedFiles((prev) =>
        prev.map((f) =>
          f.id === fileWithPreview.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
        )
      );

      try {
        await onFilesUpload([fileWithPreview]);

        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === fileWithPreview.id ? { ...f, status: 'success' as const, progress: 100 } : f
          )
        );
      } catch (error) {
        setSelectedFiles((prev) =>
          prev.map((f) =>
            f.id === fileWithPreview.id
              ? {
                  ...f,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Upload failed'
                }
              : f
          )
        );
      }
    }

    setUploading(false);
  }, [uploading, onFilesUpload]);

  const processFiles = React.useCallback((files: FileList | File[]) => {
    setSelectedFiles((prev) => {
      const fileArray = Array.from(files);
      const newFiles: FileWithPreview[] = [];

      fileArray.forEach((file) => {
        if (prev.length + newFiles.length >= maxFiles) {
          return;
        }

        const error = validateFile(file);
        if (error) {
          return;
        }

        const fileWithPreview: FileWithPreview = {
          file,
          id: `${Date.now()}-${Math.random()}`,
          status: 'pending',
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
        };

        newFiles.push(fileWithPreview);
      });

      if (newFiles.length > 0) {
        const updated = [...prev, ...newFiles];
        if (autoUpload) {
          setTimeout(() => handleUpload(newFiles), 0);
        }
        return updated;
      }

      return prev;
    });
  }, [accept, maxSize, maxFiles, autoUpload, handleUpload]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  const handleFileInput = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    e.target.value = '';
  }, [processFiles]);

  const removeFile = React.useCallback((id: string) => {
    setSelectedFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return updated;
    });
  }, []);

  const clearAllFiles = React.useCallback(() => {
    selectedFiles.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setSelectedFiles([]);
  }, [selectedFiles]);

  return (
    <div className={cn("w-full", className)}>
      <div 
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
        <CloudUpload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop files here or click to select
        </p>
        <Button 
          type="button"
          variant="outline" 
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          Select Files
        </Button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Selected Files</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFiles}
              disabled={uploading}
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
          <Card>
            <CardContent className="p-4 space-y-3">
              {selectedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                      {file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.file.name}
                          className="w-10 h-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                          <FileIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{file.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file.size)}
                        {file.status === 'error' && <span className="text-red-500 ml-2">{file.error}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {file.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    {file.status === 'uploading' && (
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file.id)}
                      disabled={uploading}
                      className="w-6 h-6"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {!autoUpload && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => handleUpload(selectedFiles.filter(f => f.status === 'pending'))}
                disabled={uploading || selectedFiles.every(f => f.status !== 'pending')}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload All
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiFileUpload;