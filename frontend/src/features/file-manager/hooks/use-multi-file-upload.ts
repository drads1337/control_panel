import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { uploadProductConfig, uploadProductExtraFile } from '@/entities/file';
import { useAuth } from '@/shared/hooks';

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
    productId: number,
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

            result = await uploadProductConfig(
              fileWithPreview.file,
              productId,
              form.name || fileWithPreview.file.name,
              form.description,
              form.version,
              form.isPublic
            );

          } else {

            result = await uploadProductExtraFile(
              fileWithPreview.file,
              productId,
              form.name || fileWithPreview.file.name,
              form.description
            );

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

          onFileComplete?.(fileWithPreview.id, false);

          setUploadStats(prev => ({
            ...prev,
            failed: prev.failed + 1
          }));

          const errorMessage = error instanceof Error ? error.message : 'Upload error';

          return { 
            success: false, 
            fileId: fileWithPreview.id, 
            error: errorMessage
          };
        }
      };

      let results;
      if (uploadInParallel) {

        const uploadPromises = files.map(uploadSingleFile);
        results = await Promise.all(uploadPromises);
      } else {

        results = [];
        for (const fileWithPreview of files) {
          const result = await uploadSingleFile(fileWithPreview);
          results.push(result);
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        toast.success(`Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`);
      }

      return results;
    } catch (error) {

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
