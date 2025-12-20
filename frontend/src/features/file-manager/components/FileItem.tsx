import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConditionalRender } from '@/lib/rbac/conditional-render';
import { Download, Trash2, Eye, MoreVertical, Check } from 'lucide-react';
import { sanitizeString } from '@/lib/utils/sanitization';
import { cn } from '@/lib/utils';
import type { FileItem as FileItemType } from '@/entities/file';

export interface FileItemProps {
  file: FileItemType;
  isSelected: boolean;
  canDownload: boolean;
  canDelete: boolean;
  onToggleSelection: (fileId: string) => void;
  onFolderClick: (folderName: string) => void;
  onDownload: (file: FileItemType) => void;
  onView: (file: FileItemType) => void;
  onDelete: (file: FileItemType) => void;
  getFileIcon: (name: string, type?: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
}

/**
 * Desktop File Item Component (Row)
 */
export const FileItemDesktop = React.memo(function FileItemDesktop({
  file,
  isSelected,
  canDownload,
  canDelete,
  onToggleSelection,
  onFolderClick,
  onDownload,
  onView,
  onDelete,
  getFileIcon,
  formatFileSize,
}: FileItemProps) {
  const isFolder = file.type === 'folder';
  const isConfigsFolder = isFolder && file.name === 'configs';

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-2.5 border-b hover:bg-accent/50 transition-colors cursor-pointer gap-2',
        isSelected && 'bg-primary/5'
      )}
      onClick={() => {
        if (isConfigsFolder) {
          onFolderClick(file.name);
        } else if (!isFolder) {
          onToggleSelection(String(file.id));
        }
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
        <div className="flex-shrink-0">{getFileIcon(file.name, file.type)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h4 className="font-medium text-sm truncate max-w-[200px] sm:max-w-none">{file.name}</h4>
            {file.category && file.category !== 'folder' && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {file.category}
              </Badge>
            )}
            {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <p className="whitespace-nowrap">{formatFileSize(file.size)}</p>
            <span className="hidden xs:inline">•</span>
            <p className="whitespace-nowrap">
              {new Date(file.modified).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            {file.description && (
              <>
                <span className="hidden sm:inline">•</span>
                <p className="truncate max-w-[150px] hidden sm:block">
                  {sanitizeString(file.description)}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {!isFolder && (
        <div className="flex items-center gap-1 self-end sm:self-auto mt-2 sm:mt-0">
          <ConditionalRender permission="products.files_view" fallback={null}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onView(file);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="products.files_download" fallback={null}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                if (canDownload) onDownload(file);
              }}
              disabled={!canDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </ConditionalRender>
          <ConditionalRender permission="products.files_delete" fallback={null}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                if (canDelete) onDelete(file);
              }}
              disabled={!canDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </ConditionalRender>
        </div>
      )}
    </div>
  );
});

/**
 * Mobile File Item Component (Card)
 */
export const FileItemMobile = React.memo(function FileItemMobile({
  file,
  isSelected,
  canDownload,
  canDelete,
  onToggleSelection,
  onFolderClick,
  onDownload,
  onView,
  onDelete,
  getFileIcon,
  formatFileSize,
}: FileItemProps) {
  const isFolder = file.type === 'folder';
  const isConfigsFolder = isFolder && file.name === 'configs';

  return (
    <div
      className={cn(
        'flex flex-col p-4 border rounded-lg bg-card text-card-foreground shadow-sm transition-colors',
        isSelected ? 'border-primary/50 bg-primary/5' : 'border-border'
      )}
      onClick={() => {
        if (isConfigsFolder) onFolderClick(file.name);
      }}
    >
      <div className="flex justify-between items-start mb-3 border-b pb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex-shrink-0">{getFileIcon(file.name, file.type)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm truncate max-w-full">{file.name}</h4>
            </div>
            {file.category && file.category !== 'folder' && (
              <Badge variant="outline" className="text-[10px] px-1.5 h-4 mt-1">
                {file.category}
              </Badge>
            )}
          </div>
        </div>

        {!isFolder && (
          <div className="flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(String(file.id))}
              className="h-5 w-5"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
        <div>Size: {formatFileSize(file.size)}</div>
        <div className="text-right">{new Date(file.modified).toLocaleDateString()}</div>
        {file.description && (
          <div className="col-span-2 truncate italic opacity-80">
            {sanitizeString(file.description)}
          </div>
        )}
      </div>

      {!isFolder && (
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-dashed mt-1">
          <ConditionalRender permission="products.files_view" fallback={null}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onView(file);
              }}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" /> View
            </Button>
          </ConditionalRender>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <ConditionalRender permission="products.files_download" fallback={null}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(file);
                  }}
                  disabled={!canDownload}
                >
                  <Download className="mr-2 h-4 w-4" /> Download
                </DropdownMenuItem>
              </ConditionalRender>
              <DropdownMenuSeparator />
              <ConditionalRender permission="products.files_delete" fallback={null}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file);
                  }}
                  disabled={!canDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </ConditionalRender>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
});
