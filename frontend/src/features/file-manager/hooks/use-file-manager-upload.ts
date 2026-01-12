import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  uploadProductConfig,
  uploadProductExtraFile,
} from '@/entities/file';
import { getErrorMessage as getErrorMessageUtil, isErrorWithMessage } from '@/shared/lib/utils/error-utils';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';

export interface UploadForm {
  name: string;
  description: string;
  version: string;
  category: 'config' | 'resource';
  uploadPath: string;
}

interface UseFileManagerUploadParams {
  selectedProduct: Product | null;
  selectedAgent: Agent | null;
  showConfigsFolder: boolean;
  onUploadSuccess?: () => void;
}

/**
 * Хук для управления загрузкой файлов.
 * Отвечает за состояние загрузки, прогресс, drag & drop и саму загрузку файлов.
 */
export function useFileManagerUpload({
  selectedProduct,
  selectedAgent,
  showConfigsFolder,
  onUploadSuccess,
}: UseFileManagerUploadParams) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadForm>({
    name: '',
    description: '',
    version: '1.0.0',
    category: 'resource',
    uploadPath: '/',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (file?: File) => {
      const targetFile = file || selectedFile;
      if (!targetFile) {
        toast.error('Please select a file to upload');
        return false;
      }

      const targetId = selectedProduct?.id || selectedAgent?.id;
      if (!targetId) {
        toast.error('Please select a product or agent first');
        return false;
      }

      setUploading(true);
      setUploadProgress(0);

      try {
        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) return prev;
            return prev + Math.random() * 10;
          });
        }, 200);

        const productId = selectedProduct?.id || selectedAgent?.id;
        if (!productId) {
          toast.error('No product or agent selected');
          return false;
        }

        let uploadResult;
        if (showConfigsFolder || uploadForm.uploadPath === '/configs') {
          uploadResult = await uploadProductExtraFile(
            targetFile,
            productId,
            uploadForm.name || targetFile.name,
            uploadForm.description
          );
        } else if (uploadForm.category === 'config') {
          uploadResult = await uploadProductConfig(
            targetFile,
            productId,
            uploadForm.name || targetFile.name,
            uploadForm.description,
            uploadForm.version,
            true
          );
        } else {
          uploadResult = await uploadProductExtraFile(
            targetFile,
            productId,
            uploadForm.name || targetFile.name,
            uploadForm.description
          );
        }

        clearInterval(progressInterval);
        setUploadProgress(100);

        toast.success(`File "${targetFile.name}" uploaded successfully`);
        setSelectedFile(null);
        resetUploadForm();
        onUploadSuccess?.();

        return true;
      } catch (error: unknown) {
        let errorMessage = 'Error uploading file';
        const errorMsg = isErrorWithMessage(error)
          ? error.message
          : getErrorMessageUtil(error);
        if (errorMsg) {
          if (errorMsg.includes('File too large')) {
            errorMessage = 'File size exceeds the limit';
          } else if (errorMsg.includes('Insufficient storage')) {
            errorMessage = 'Insufficient storage space';
          } else if (errorMsg.includes('File type not allowed')) {
            errorMessage = 'File type not allowed';
          } else if (errorMsg.includes('Product not found')) {
            errorMessage = 'Selected product not found';
          } else {
            errorMessage = errorMsg;
          }
        }
        toast.error(errorMessage);
        return false;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [
      selectedProduct,
      selectedAgent,
      showConfigsFolder,
      uploadForm,
      onUploadSuccess,
      selectedFile,
    ]
  );

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadForm((prev) => ({
      ...prev,
      name: file.name,
      category: file.name.toLowerCase().includes('config')
        ? 'config'
        : prev.category,
    }));
  }, []);

  const resetUploadForm = useCallback(() => {
    setUploadForm({
      name: '',
      description: '',
      version: '1.0.0',
      category: 'config',
      uploadPath: showConfigsFolder ? '/configs' : '/',
    });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [showConfigsFolder]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, onFileReady?: (file: File) => void) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) {
        toast.error('No files found in the drop');
        return;
      }

      if (files.length > 1) {
        toast.error('Please drop only one file at a time');
        return;
      }

      const file = files[0];
      // SECURITY: Limit file size to 100MB to prevent browser memory issues
      // For larger files, chunked upload should be implemented on backend
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        toast.error(`File size exceeds ${(maxSize / (1024 * 1024)).toFixed(0)}MB limit. Large files require chunked upload support on the backend.`);
        return;
      }

      handleFileSelect(file);
      onFileReady?.(file);
      toast.success(`File "${file.name}" ready for upload`);
    },
    [handleFileSelect]
  );

  return {
    uploading,
    uploadProgress,
    dragOver,
    uploadForm,
    selectedFile,
    fileInputRef,
    setUploadForm,
    setDragOver,
    handleFileUpload,
    handleFileSelect,
    resetUploadForm,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

