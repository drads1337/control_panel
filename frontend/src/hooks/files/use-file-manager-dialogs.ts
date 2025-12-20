import { useState, useCallback } from 'react';
import type { FileItem } from '@/entities/file';

/**
 * Хук для управления диалогами файлового менеджера.
 * Отвечает только за состояние открытия/закрытия диалогов и выбранный файл.
 */
export function useFileManagerDialogs() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [fileDetailsOpen, setFileDetailsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  const openUploadDialog = useCallback(() => {
    setUploadDialogOpen(true);
  }, []);

  const closeUploadDialog = useCallback(() => {
    setUploadDialogOpen(false);
  }, []);

  const openFileDetails = useCallback((file: FileItem) => {
    setSelectedFile(file);
    setFileDetailsOpen(true);
  }, []);

  const closeFileDetails = useCallback(() => {
    setFileDetailsOpen(false);
    setSelectedFile(null);
  }, []);

  const closeAllDialogs = useCallback(() => {
    setUploadDialogOpen(false);
    setFileDetailsOpen(false);
    setSelectedFile(null);
  }, []);

  return {
    // State
    uploadDialogOpen,
    fileDetailsOpen,
    selectedFile,
    // Actions
    openUploadDialog,
    closeUploadDialog,
    openFileDetails,
    closeFileDetails,
    closeAllDialogs,
    // Setters (for backward compatibility)
    setUploadDialogOpen,
    setFileDetailsOpen,
    setSelectedFile,
  };
}

