import { useState, useCallback } from 'react';
import type { FileItem } from '@/entities/file';

/**
 * Хук для управления выбором файлов.
 * Отвечает только за состояние выбранных файлов и операции с выбором.
 */
export function useFileManagerSelection() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  }, []);

  const selectAllFiles = useCallback((files: FileItem[]) => {
    setSelectedFiles(files.map((f) => f.id));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  const isFileSelected = useCallback(
    (fileId: string) => selectedFiles.includes(fileId),
    [selectedFiles]
  );

  const getSelectedFileObjects = useCallback(
    (files: FileItem[]) => {
      return files.filter((f) => selectedFiles.includes(f.id));
    },
    [selectedFiles]
  );

  return {
    selectedFiles,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    isFileSelected,
    getSelectedFileObjects,
    setSelectedFiles,
  };
}

