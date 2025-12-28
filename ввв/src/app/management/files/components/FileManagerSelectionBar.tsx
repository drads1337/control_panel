import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2, X } from 'lucide-react';

export interface FileManagerSelectionBarProps {
  selectedCount: number;
  canDownload: boolean;
  canDelete: boolean;
  onClearSelection: () => void;
  onBulkDownload: () => void;
  onBulkDelete: () => void;
}

/**
 * Панель выбранных файлов.
 * Отображается когда есть выбранные файлы.
 */
export function FileManagerSelectionBar({
  selectedCount,
  canDownload,
  canDelete,
  onClearSelection,
  onBulkDownload,
  onBulkDelete,
}: FileManagerSelectionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Selected: {selectedCount}</span>
            <Button variant="outline" size="sm" onClick={onClearSelection}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDownload}
              disabled={!canDownload}
              className="flex-1 sm:flex-none"
            >
              <Download className="mr-2 h-4 w-4" /> Download All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive flex-1 sm:flex-none"
              onClick={onBulkDelete}
              disabled={!canDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
