import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileItemDesktop, FileItemMobile } from './FileItem';
import { cn } from '@/lib/utils';
import type { FileItem } from '@/entities/file';

export interface FilesListProps {
  files: FileItem[];
  selectedFiles: string[];
  canDownload: boolean;
  canDelete: boolean;
  onToggleSelection: (fileId: string) => void;
  onFolderClick: (folderName: string) => void;
  onDownload: (file: FileItem) => void;
  onView: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  getFileIcon: (name: string, type?: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
  isMobile: boolean;
}

/**
 * Компонент списка файлов с поддержкой виртуализации для больших списков.
 * Автоматически включает виртуализацию для списков более 30 файлов.
 */
export const FilesList: React.FC<FilesListProps> = ({
  files,
  selectedFiles,
  canDownload,
  canDelete,
  onToggleSelection,
  onFolderClick,
  onDownload,
  onView,
  onDelete,
  getFileIcon,
  formatFileSize,
  isMobile,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = files.length > 30;

  // Динамическая высота: 80px для таблицы (desktop), ~200px для карточки (mobile) с запасом
  const itemHeight = isMobile ? 200 : 80;

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? files.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
    enabled: shouldVirtualize,
  });

  // Обновляем виртуализатор при смене режима
  useEffect(() => {
    rowVirtualizer.measure();
  }, [isMobile, rowVirtualizer]);

  const renderItem = (file: FileItem, index: number, style?: React.CSSProperties) => {
    const commonProps = {
      file,
      isSelected: selectedFiles.includes(file.id),
      canDownload,
      canDelete,
      onToggleSelection,
      onFolderClick,
      onDownload,
      onView,
      onDelete,
      getFileIcon,
      formatFileSize,
    };

    if (isMobile) {
      return (
        <div key={file.id} style={style}>
          <FileItemMobile {...commonProps} />
        </div>
      );
    }

    return (
      <div key={file.id} data-index={index} style={style}>
        <FileItemDesktop {...commonProps} />
      </div>
    );
  };

  if (shouldVirtualize) {
    return (
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: '600px', contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div className={isMobile ? 'p-1' : 'divide-y'}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const file = files[virtualRow.index];
              return renderItem(
                file,
                virtualRow.index,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(isMobile ? 'flex flex-col gap-2 mb-4' : 'divide-y')}>
      {files.map((file, index) => renderItem(file, index))}
    </div>
  );
};
