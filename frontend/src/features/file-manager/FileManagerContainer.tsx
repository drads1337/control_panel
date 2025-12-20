import { usePermissions } from '@/lib/hooks';
import { useIsMobile } from '@/lib/hooks';
import { useFileManagerLogic } from './hooks/use-file-manager-logic';
import { FileManagerView } from './FileManagerView';
import { FileManagerAccessDenied } from './components/FileManagerAccessDenied';

interface FileManagerContainerProps {
  onSwitchToProductDatabase?: () => void;
}

/**
 * Container компонент для FileManager.
 * Отвечает только за координацию логики и проверку прав доступа.
 * Вся бизнес-логика находится в useFileManagerLogic.
 */
export function FileManagerContainer({ onSwitchToProductDatabase }: FileManagerContainerProps) {
  const { hasPermission } = usePermissions();
  const isMobile = useIsMobile();
  
  // Проверка прав доступа
  const canViewFiles = hasPermission('products.files_view');
  const canUploadFiles = hasPermission('products.files_upload');
  const canDeleteFiles = hasPermission('products.files_delete');
  const canDownloadFiles = hasPermission('products.files_download');
  const canViewProducts = hasPermission('products.view');
  const canViewAgents = hasPermission('agents.view');
  const showTargetTypeToggle = canViewProducts && canViewAgents;

  // Если нет прав на просмотр - показываем сообщение
  if (!canViewFiles) {
    return <FileManagerAccessDenied />;
  }

  // Используем хук логики для получения всей бизнес-логики
  const logic = useFileManagerLogic({ onSwitchToProductDatabase });

  // Передаем все данные в View компонент
  return (
    <FileManagerView
      {...logic}
      isMobile={isMobile}
      canUploadFiles={canUploadFiles}
      canDeleteFiles={canDeleteFiles}
      canDownloadFiles={canDownloadFiles}
      canViewProducts={canViewProducts}
      canViewAgents={canViewAgents}
      showTargetTypeToggle={showTargetTypeToggle}
    />
  );
}
