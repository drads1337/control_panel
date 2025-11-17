import { useState, useCallback } from 'react';
import { uploadGameConfig, uploadGameExtraFile, deleteGameConfig, deleteGameExtraFile, deleteGameFile, downloadGameConfig, downloadGameExtraFile, downloadGameFile } from '@/entities/file';
import { toast } from 'sonner';
import type { Game } from '@/entities/game';
import type { FileItem } from '@/entities/file';

export interface UploadForm {
  name: string;
  description: string;
  version: string;
  isPublic: boolean;
  category: 'config' | 'resource';
}

export const useFileOperations = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = useCallback(async (
    file: File,
    game: Game,
    form: UploadForm
  ) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      if (form.category === 'config') {
        await uploadGameConfig(
          file,
          game.id,
          form.name || file.name,
          form.description,
          form.version,
          form.isPublic
        );
      } else {
        await uploadGameExtraFile(
          file,
          game.id,
          form.name || file.name,
          form.description
        );
      }

      toast.success('Файл успешно загружен');
      return true;
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Ошибка загрузки файла');
      return false;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const handleFileDownload = useCallback(async (file: FileItem) => {
    try {
      let blob: Blob;
      
      if (file.category === 'config') {
        const configId = parseInt(file.id.replace('config_', ''));
        blob = await downloadGameConfig(configId);
      } else if (file.category === 'resource') {
        const fileId = parseInt(file.id.replace('extra_', ''));
        const { blob: extraBlob } = await downloadGameExtraFile(fileId);
        blob = extraBlob;
      } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'loader') {
        const gameId = file.gameId;
        if (!gameId) {
          toast.error('Не удалось определить ID игры для скачивания файла');
          return;
        }
        const fileType = file.category as 'logo' | 'banner' | 'loader';
        blob = await downloadGameFile(gameId, fileType);
      } else {
        toast.error('Неподдерживаемый тип файла для скачивания');
        return;
      }
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Файл ${file.name} успешно скачан`);
      return true;
    } catch (error) {
      console.error('Failed to download file:', error);
      toast.error('Ошибка скачивания файла');
      return false;
    }
  }, []);

  const handleFileDelete = useCallback(async (file: FileItem) => {
    if (!confirm(`Вы уверены, что хотите удалить ${file.name}?`)) {
      return false;
    }

    try {
      if (file.category === 'config') {
        const configId = parseInt(file.id.replace('config_', ''));
        await deleteGameConfig(configId);
      } else if (file.category === 'resource') {
        const fileId = parseInt(file.id.replace('extra_', ''));
        await deleteGameExtraFile(fileId);
      } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'loader') {
        const gameId = file.gameId;
        if (!gameId) {
          toast.error('Не удалось определить ID игры для удаления файла');
          return false;
        }
        const fileType = file.category as 'logo' | 'banner' | 'loader';
        await deleteGameFile(gameId, fileType);
      } else {
        toast.error('Неподдерживаемый тип файла для удаления');
        return false;
      }
      
      toast.success(`Файл ${file.name} удален`);
      return true;
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Ошибка удаления файла');
      return false;
    }
  }, []);

  const handleBulkDownload = useCallback(async (files: FileItem[]) => {
    if (files.length === 0) return;
    
    try {
      for (const file of files) {
        await handleFileDownload(file);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      toast.success(`Скачано ${files.length} файлов`);
    } catch (error) {
      console.error('Failed to bulk download:', error);
      toast.error('Ошибка массового скачивания');
    }
  }, [handleFileDownload]);

  const handleBulkDelete = useCallback(async (files: FileItem[]) => {
    if (files.length === 0) return;
    
    if (!confirm(`Вы уверены, что хотите удалить ${files.length} файлов?`)) {
      return;
    }

    try {
      for (const file of files) {
        await handleFileDelete(file);
      }
      toast.success(`Удалено ${files.length} файлов`);
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      toast.error('Ошибка массового удаления');
    }
  }, [handleFileDelete]);

  return {
    uploading,
    uploadProgress,
    handleFileUpload,
    handleFileDownload,
    handleFileDelete,
    handleBulkDownload,
    handleBulkDelete,
  };
};
