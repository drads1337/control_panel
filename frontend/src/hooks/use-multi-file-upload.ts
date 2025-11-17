import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { uploadGameConfig, uploadGameExtraFile } from '@/entities/file';
import { useAuth } from '@/hooks/use-auth';

export interface UploadForm {
  name: string;
  description: string;
  version: string;
  isPublic: boolean;
  category: 'config' | 'resource';
}

export interface FileWithPreview {
  file: File;
  id: string;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
  uploadStartTime?: number;
}

export const useMultiFileUpload = () => {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    totalSize: 0,
    uploadedSize: 0
  });

  const uploadFiles = useCallback(async (
    files: FileWithPreview[],
    gameId: number,
    form: UploadForm,
    options: {
      uploadInParallel?: boolean;
      onProgress?: (fileId: string, progress: number) => void;
      onFileComplete?: (fileId: string, success: boolean) => void;
    } = {}
  ) => {
    if (!token) {
      toast.error('Authorization token not found');
      return;
    }

    const { uploadInParallel = true, onProgress, onFileComplete } = options;
    
    console.log(`Starting upload of ${files.length} files, parallel: ${uploadInParallel}`);
    console.log('Files to upload:', files.map(f => ({ name: f.file.name, size: f.file.size })));
    
    setUploading(true);
    setUploadStats({
      total: files.length,
      completed: 0,
      failed: 0,
      totalSize: files.reduce((sum, f) => sum + f.file.size, 0),
      uploadedSize: 0
    });

    try {
      const uploadSingleFile = async (fileWithPreview: FileWithPreview) => {
        try {
          onProgress?.(fileWithPreview.id, 0);
          
          let result;
          if (form.category === 'config') {
            console.log(`Uploading config file: ${fileWithPreview.file.name} for game ${gameId}`);
            result = await uploadGameConfig(
              fileWithPreview.file,
              gameId,
              form.name || fileWithPreview.file.name,
              form.description,
              form.version,
              form.isPublic
            );
            console.log(`Successfully uploaded config file: ${fileWithPreview.file.name}`);
          } else {
            console.log(`Uploading extra file: ${fileWithPreview.file.name} for game ${gameId}`);
            result = await uploadGameExtraFile(
              fileWithPreview.file,
              gameId,
              form.name || fileWithPreview.file.name,
              form.description
            );
            console.log(`Successfully uploaded extra file: ${fileWithPreview.file.name}`);
          }
          
          onProgress?.(fileWithPreview.id, 100);
          onFileComplete?.(fileWithPreview.id, true);
          
          setUploadStats(prev => ({
            ...prev,
            completed: prev.completed + 1,
            uploadedSize: prev.uploadedSize + fileWithPreview.file.size
          }));
          
          return { success: true, fileId: fileWithPreview.id, result };
        } catch (error) {
          console.error(`Failed to upload file ${fileWithPreview.file.name}:`, error);
          onFileComplete?.(fileWithPreview.id, false);
          
          setUploadStats(prev => ({
            ...prev,
            failed: prev.failed + 1
          }));
          
          const errorMessage = error instanceof Error ? error.message : 'Upload error';
          console.error(`Upload error for ${fileWithPreview.file.name}:`, errorMessage);
          
          return { 
            success: false, 
            fileId: fileWithPreview.id, 
            error: errorMessage
          };
        }
      };

      let results;
      if (uploadInParallel) {
        // Параллельная загрузка
        const uploadPromises = files.map(uploadSingleFile);
        results = await Promise.all(uploadPromises);
      } else {
        // Последовательная загрузка
        results = [];
        for (const fileWithPreview of files) {
          const result = await uploadSingleFile(fileWithPreview);
          results.push(result);
        }
      }
      
      console.log('Upload results:', results);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log(`Upload summary: ${successCount} successful, ${failCount} failed out of ${files.length} total files`);
      
      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`);
      }
      
      return results;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('File upload error');
      return [];
    } finally {
      setUploading(false);
    }
  }, [token]);

  const resetStats = useCallback(() => {
    setUploadStats({
      total: 0,
      completed: 0,
      failed: 0,
      totalSize: 0,
      uploadedSize: 0
    });
  }, []);

  return {
    uploading,
    uploadStats,
    uploadFiles,
    resetStats
  };
};
