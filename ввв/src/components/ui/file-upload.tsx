
const GlobalFile = globalThis.File;
import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  File as FileIcon, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  Code, 
  X, 
  CheckCircle, 
  AlertCircle,
  Cloud,
  Trash2
} from 'lucide-react';
export interface FileUploadProps {
  onFilesSelect: (files: FileWithPreview[]) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  showPreview?: boolean;
  showProgress?: boolean;
  onUploadProgress?: (progress: number) => void;
}
interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}
const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelect,
  multiple = true,
  accept,
  maxSize = 5 * 1024 * 1024 * 1024,
  maxFiles = 10,
  disabled = false,
  className,
  showPreview = true,
  showProgress = true,
  onUploadProgress
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getFileIcon = (file: FileWithPreview) => {
    const type = file.file.type;
    if (!type) return <FileText className="w-8 h-8 text-gray-500" />;
    if (type.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
    if (type.startsWith('video/')) return <Video className="w-8 h-8 text-purple-500" />;
    if (type.startsWith('audio/')) return <Music className="w-8 h-8 text-green-500" />;
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return <Archive className="w-8 h-8 text-orange-500" />;
    if (type.includes('text') || type.includes('code')) return <Code className="w-8 h-8 text-indigo-500" />;
    return <FileText className="w-8 h-8 text-gray-500" />;
  };
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File is too large. Maximum size: ${formatFileSize(maxSize)}`;
    }
    if (accept && accept !== '*') {
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      const fileType = file.type || '';
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type;
        }
        if (type.endsWith('/*')) {
          const baseType = type.slice(0, -2);
          return fileType.startsWith(baseType + '/');
        }
        return fileType === type;
      });
      
      if (!isAccepted) {
        return `File type not accepted. Accepted types: ${accept}`;
      }
    }
    return null;
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newFiles: FileWithPreview[] = [];
    
    setSelectedFiles(prev => {
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
        onFilesSelect(updated);
        return updated;
      }
      return prev;
    });
  }, [maxFiles, onFilesSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    e.target.value = '';
  }, [processFiles]);

  const openFileDialog = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const removeFile = useCallback((id: string) => {
    setSelectedFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      onFilesSelect(updated);
      return updated;
    });
  }, [onFilesSelect]);

  const clearAllFiles = useCallback(() => {
    selectedFiles.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setSelectedFiles([]);
    onFilesSelect([]);
  }, [selectedFiles, onFilesSelect]);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0 || uploading) return;
    
    setUploading(true);
    const filesToUpload = [...selectedFiles];
    
    for (let i = 0; i < filesToUpload.length; i++) {
      const fileWithPreview = filesToUpload[i];
      setSelectedFiles(prev => prev.map(f => 
        f.id === fileWithPreview.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ));
      
      try {
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          setSelectedFiles(prev => prev.map(f => 
            f.id === fileWithPreview.id ? { ...f, progress } : f
          ));
          if (onUploadProgress) {
            onUploadProgress(progress);
          }
        }
        
        setSelectedFiles(prev => prev.map(f => 
          f.id === fileWithPreview.id ? { ...f, status: 'success' as const, progress: 100 } : f
        ));
      } catch (error) {
        setSelectedFiles(prev => prev.map(f => 
          f.id === fileWithPreview.id ? { 
            ...f, 
            status: 'error' as const, 
            error: error instanceof Error ? error.message : 'Upload failed' 
          } : f
        ));
      }
    }
    
    setUploading(false);
  }, [selectedFiles, uploading, onUploadProgress]);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ease-in-out",
          "hover:border-primary/50 hover:bg-primary/5",
          isDragOver && "border-primary bg-primary/10 scale-105",
          disabled && "opacity-50 cursor-not-allowed",
          selectedFiles.length > 0 ? "border-primary/30" : "border-muted-foreground/25"
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
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className={cn(
              "p-3 rounded-full transition-all duration-200",
              isDragOver ? "bg-primary/20 scale-110" : "bg-muted"
            )}>
              <Cloud className={cn(
                "w-8 h-8 transition-colors duration-200",
                isDragOver ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {isDragOver ? "Drop files here" : "Drag files here"}
            </h3>
            <p className="text-sm text-muted-foreground">
              or{' '}
              <button
                type="button"
                onClick={openFileDialog}
                disabled={disabled}
                className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
              >
                select files
              </button>
            </p>
          </div>
          {accept && (
            <div className="text-xs text-muted-foreground">
              Supported formats: {accept}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Maximum size: {formatFileSize(maxSize)} • Max files: {maxFiles}
          </div>
        </div>
      </div>
      {selectedFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              Selected files ({selectedFiles.length})
            </h4>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFiles}
                disabled={uploading}
                className="h-8 px-3"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear all
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
                className="h-8 px-4"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            {selectedFiles.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "group relative flex items-center gap-3 p-3 rounded-lg border transition-all duration-200",
                  "hover:shadow-sm hover:border-primary/30",
                  file.status === 'success' && "border-green-200 bg-green-50",
                  file.status === 'error' && "border-red-200 bg-red-50",
                  file.status === 'uploading' && "border-blue-200 bg-blue-50"
                )}
              >
                {}
                <div className="flex-shrink-0">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-10 h-10 rounded object-cover border"
                    />
                  ) : (
                    getFileIcon(file)
                  )}
                </div>
                {}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.file.name}
                    </p>
                    <Badge
                      variant={file.status === 'success' ? 'default' : 
                              file.status === 'error' ? 'destructive' : 
                              file.status === 'uploading' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {file.status === 'pending' && 'Pending'}
                      {file.status === 'uploading' && 'Uploading'}
                      {file.status === 'success' && 'Complete'}
                      {file.status === 'error' && 'Error'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatFileSize(file.file.size)}</span>
                    <span>{file.file.type || 'Unknown type'}</span>
                  </div>
                  {}
                  {showProgress && file.status === 'uploading' && file.progress !== undefined && (
                    <div className="mt-2">
                      <Progress value={file.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {file.progress}% uploaded
                      </p>
                    </div>
                  )}
                  {}
                  {file.status === 'error' && file.error && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {file.error}
                    </p>
                  )}
                </div>
                {}
                <div className="flex-shrink-0">
                  {file.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  {file.status === 'uploading' && (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                {}
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  disabled={uploading}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                    "p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
export default FileUpload; 