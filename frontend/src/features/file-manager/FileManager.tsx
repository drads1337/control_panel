import React from 'react';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useFileManagerLogic } from './hooks/use-file-manager-logic';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface FileManagerProps {
  onSwitchToProductDatabase?: () => void;
}

/**
 * FileManager component - main component for managing files
 * Uses Container/View pattern with useFileManagerLogic hook
 */
const FileManager: React.FC<FileManagerProps> = ({ onSwitchToProductDatabase }) => {
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();

  // Check permissions
  const canViewFiles = hasPermission('products.files_view');
  const canUploadFiles = hasPermission('products.files_upload');
  const canDeleteFiles = hasPermission('products.files_delete');
  const canDownloadFiles = hasPermission('products.files_download');
  const canViewProducts = hasPermission('products.view');
  const canViewAgents = hasPermission('agents.view');
  const showTargetTypeToggle = canViewProducts && canViewAgents;

  // Use the logic hook
  const logic = useFileManagerLogic({ onSwitchToProductDatabase });

  // Access denied
  if (!canViewFiles) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-3">
            <Card className="text-center p-8">
              <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                  You don't have permission to view files.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (logic.loading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-2">
                <Spinner size="lg" />
                <p className="text-sm text-muted-foreground">Loading file manager...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle>File Manager</CardTitle>
              <CardDescription>
                Manage files for your products and agents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* TODO: Add FileManagerHeader component */}
                {/* TODO: Add FilesList component */}
                {/* TODO: Add FileManagerSelectionBar component */}
                {/* TODO: Add dialogs */}
                
                <div className="text-sm text-muted-foreground">
                  <p>Selected Product: {logic.selectedProduct?.name || 'None'}</p>
                  <p>Selected Agent: {logic.selectedAgent?.name || 'None'}</p>
                  <p>Files: {logic.files.length}</p>
                  <p>Loading: {logic.loading ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FileManager;

