import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FolderOpen, Plus, Upload, Download, Trash2, Eye, FileText, 
  Image, Package, Search, AlertTriangle,
  Folder, File, Video, Music, Zap,
  RefreshCw, X, Check, ChevronRight, Database, Container, MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, usePermissions } from '@/lib/hooks';
import { ConditionalRender } from '@/lib/rbac';
import {
  useFileManagerDialogs,
  useFileManagerSelection,
  useFileManagerFilters,
  useFileManagerUpload,
} from '@/features/file-manager/hooks';
import { getProducts } from '@/entities/product'
import { getAgents } from '@/entities/agent'
import { getProductFiles, createFolder, deleteProductConfig, deleteProductExtraFile, deleteProductFile, downloadProductConfig, downloadProductExtraFile, downloadProductFile } from '@/entities/file';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { sanitizeString } from '@/lib/utils';
import { getErrorMessage } from '@/lib/api/enhanced-client';
import { getErrorMessage as getErrorMessageUtil, isErrorWithMessage } from '@/lib/utils';
import MultiFileUploadDialog from './MultiFileUploadDialog';
import FileUploadDialog from './FileUploadDialog';
import FileDetailsDialog from './FileDetailsDialog';
import type { Product } from '@/entities/product';
import type { FileItem } from '@/entities/file';
import type { Agent } from '@/entities/agent';
import { cn } from '@/lib/utils';

// Хук для определения размера экрана
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

interface FileManagerProps {
  onSwitchToProductDatabase?: () => void;
}

interface FileItemProps {
  file: FileItem;
  isSelected: boolean;
  canDownload: boolean;
  canDelete: boolean;
  onToggleSelection: (fileId: string) => void;
  onFolderClick: (folderName: string) => void;
  onDownload: (file: FileItem) => void;
  onView: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  getFileIcon: (name: string, type?: string) => React.ReactNode;
  formatFileSize: (bytes: number) => string;
}

// Desktop Row Component
const FileItemComponent = React.memo(function FileItemComponent({
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
  formatFileSize
}: FileItemProps) {
  const isFolder = file.type === 'folder';
  const isConfigsFolder = isFolder && file.name === 'configs';

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-2.5 border-b hover:bg-accent/50 transition-colors cursor-pointer gap-2 ${
        isSelected ? 'bg-primary/5' : ''
      }`}
      onClick={() => {
        if (isConfigsFolder) {
          onFolderClick(file.name);
        } else if (!isFolder) {
          onToggleSelection(String(file.id));
        }
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
        <div className="flex-shrink-0">
          {getFileIcon(file.name, file.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <h4 className="font-medium text-sm truncate max-w-[200px] sm:max-w-none">{file.name}</h4>
            {file.category && file.category !== 'folder' && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {file.category}
              </Badge>
            )}
            {isSelected && (
              <Check className="h-3 w-3 text-primary shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <p className="whitespace-nowrap">
              {formatFileSize(file.size)}
            </p>
            <span className="hidden xs:inline">•</span>
            <p className="whitespace-nowrap">
              {new Date(file.modified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

// Mobile Card Render Function (used inside FilesList)
const renderMobileFileCard = (
    file: FileItem, 
    props: FileItemProps, 
    style?: React.CSSProperties
) => {
    const isFolder = file.type === 'folder';
    const isConfigsFolder = isFolder && file.name === 'configs';

    return (
        <div 
            key={file.id} 
            style={style}
            className={cn(
                "flex flex-col p-4 border rounded-lg bg-card text-card-foreground shadow-sm transition-colors",
                props.isSelected ? "border-primary/50 bg-primary/5" : "border-border"
            )}
            onClick={() => {
                if (isConfigsFolder) props.onFolderClick(file.name);
            }}
        >
            <div className="flex justify-between items-start mb-3 border-b pb-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                        {props.getFileIcon(file.name, file.type)}
                    </div>
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
                            checked={props.isSelected}
                            onCheckedChange={() => props.onToggleSelection(String(file.id))}
                            className="h-5 w-5"
                        />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                <div>Size: {props.formatFileSize(file.size)}</div>
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
                         <Button variant="outline" size="sm" className="h-8 flex-1" onClick={(e) => { e.stopPropagation(); props.onView(file); }}>
                             <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                         </Button>
                    </ConditionalRender>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                             <DropdownMenuLabel>Actions</DropdownMenuLabel>
                             <ConditionalRender permission="products.files_download" fallback={null}>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); props.onDownload(file); }} disabled={!props.canDownload}>
                                    <Download className="mr-2 h-4 w-4" /> Download
                                </DropdownMenuItem>
                             </ConditionalRender>
                             <DropdownMenuSeparator />
                             <ConditionalRender permission="products.files_delete" fallback={null}>
                                <DropdownMenuItem 
                                    onClick={(e) => { e.stopPropagation(); props.onDelete(file); }} 
                                    disabled={!props.canDelete}
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
};

interface FilesListProps {
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

const FilesList: React.FC<FilesListProps> = ({
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
  isMobile
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
        formatFileSize
     };

     if (isMobile) {
         return renderMobileFileCard(file, commonProps, style);
     }

     return (
        <div
          key={file.id}
          data-index={index}
          style={style}
        >
          <FileItemComponent {...commonProps} />
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
          <div className={isMobile ? "p-1" : "divide-y"}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const file = files[virtualRow.index];
              return renderItem(file, virtualRow.index, {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              });
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(isMobile ? "flex flex-col gap-2 mb-4" : "divide-y")}>
      {files.map((file, index) => renderItem(file, index))}
    </div>
  );
};

const FileManager: React.FC<FileManagerProps> = ({ onSwitchToProductDatabase }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();

  const canViewFiles = hasPermission('products.files_view');
  const canUploadFiles = hasPermission('products.files_upload');
  const canDeleteFiles = hasPermission('products.files_delete');
  const canDownloadFiles = hasPermission('products.files_download');

  const canViewProducts = hasPermission('products.view');
  const canViewAgents = hasPermission('agents.view');
  const showTargetTypeToggle = canViewProducts && canViewAgents;

  if (!canViewFiles) {
    return (
      <Card className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">You don't have permission to view files.</p>
      </Card>
    );
  }

  const [products, setProducts] = useState<Product[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [showConfigsFolder, setShowConfigsFolder] = useState(false);
  const [targetType, setTargetType] = useState<'product' | 'agent'>('product');
  const [multiUploadDialogOpen, setMultiUploadDialogOpen] = useState(false);

  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [lastProductsLoad, setLastProductsLoad] = useState<number>(0);
  const PRODUCTS_LOAD_COOLDOWN = 5000;

  // Ref для отслеживания последнего загруженного ID, чтобы избежать повторных загрузок
  const lastLoadedIdRef = React.useRef<string | number | null>(null);
  const isLoadingRef = React.useRef(false);

  const fileSelection = useFileManagerSelection();
  const fileDialogs = useFileManagerDialogs();
  
  const fileFilters = useFileManagerFilters({
    files,
    showConfigsFolder,
    selectedProductId: selectedProduct?.id,
  });

  useEffect(() => {
    if (isAuthenticated && canViewFiles) {
      fileFilters.loadFiltersFromStorage();
    }
  }, [isAuthenticated, canViewFiles, fileFilters]);

  useEffect(() => {
    if (isAuthenticated && canViewFiles) {
      loadInitialData();
    }
  }, [isAuthenticated, canViewFiles]);

  if (!canViewFiles) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to view files.
          </p>
        </div>
      </div>
    );
  }

  const filteredProductsForSelect = useMemo(() => {
    if (!products || !Array.isArray(products)) {
      return [];
    }
    if (targetType === 'product') {
      return products.filter(g => g.is_multi_app === false);
    } else {
      return products.filter(g => g.is_multi_app === true);
    }
  }, [products, targetType]);

  useEffect(() => {
    if (targetType === 'product' && filteredProductsForSelect.length > 0 && !selectedProduct) {
      setSelectedProduct(filteredProductsForSelect[0]);
      setSelectedAgent(null);
    } else if (targetType === 'agent') {
      const allItems = [...agents, ...filteredProductsForSelect];
      if (allItems.length > 0 && !selectedProduct && !selectedAgent) {
        const firstAgent = agents[0];
        if (firstAgent) {
          setSelectedAgent(firstAgent);
          setSelectedProduct(null);
        } else if (filteredProductsForSelect.length > 0) {
          setSelectedProduct(filteredProductsForSelect[0]);
          setSelectedAgent(null);
        }
      }
    }
  }, [filteredProductsForSelect, agents, selectedProduct, selectedAgent, targetType]);

  useEffect(() => {
    if (!(selectedProduct || selectedAgent) || !isAuthenticated) {
      return;
    }

    const targetId = selectedProduct?.id || selectedAgent?.id;
    if (!targetId) return;

    // Проверяем, не загружаем ли мы уже этот же ID с теми же фильтрами
    const currentId = `${targetId}-${fileFilters.categoryFilter}-${fileFilters.searchTerm}`;
    
    // Если уже загрузили эти данные - не загружаем снова
    if (lastLoadedIdRef.current === currentId) {
      return;
    }

    // Используем таймаут для debounce при изменении фильтров
    const timeoutId = setTimeout(() => {
      // Повторная проверка перед загрузкой (на случай если ID изменился во время таймаута)
      const currentTargetId = selectedProduct?.id || selectedAgent?.id;
      const currentIdCheck = `${currentTargetId}-${fileFilters.categoryFilter}-${fileFilters.searchTerm}`;
      
      // Проверяем еще раз перед загрузкой
      if (currentTargetId === targetId && lastLoadedIdRef.current !== currentIdCheck && !isLoadingRef.current) {
        loadProductFiles();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fileFilters.searchTerm, fileFilters.categoryFilter, selectedProduct?.id, selectedAgent?.id, isAuthenticated]);

  useEffect(() => {
    if (!showTargetTypeToggle) {
      if (canViewProducts && !canViewAgents && targetType !== 'product') {
        setTargetType('product');
      } else if (canViewAgents && !canViewProducts && targetType !== 'agent') {
        setTargetType('agent');
      }
    }
  }, [showTargetTypeToggle, canViewProducts, canViewAgents, targetType]);

  useEffect(() => {
    setSelectedProduct(null);
    setSelectedAgent(null);
    setFiles([]);
    lastLoadedIdRef.current = null; // Сбрасываем ref при смене типа
  }, [targetType]);

  const loadInitialData = async (retryCount = 0) => {
    const now = Date.now();
    if (isLoadingProducts || (now - lastProductsLoad < PRODUCTS_LOAD_COOLDOWN)) {
      return;
    }

    try {
      setIsLoadingProducts(true);
      setLoading(true);
      setLastProductsLoad(now);

      const response = await getProducts('all');
      setProducts(response.products || []);

      try {
        const agentsResponse = await getAgents();
        setAgents(agentsResponse.agents || []);
      } catch (agentError) {}

      await ensureConfigsFoldersExist(response.products || []);
    } catch (error: unknown) {
      const errorMsg = isErrorWithMessage(error) ? error.message : getErrorMessageUtil(error)
      if (errorMsg.includes('429') || errorMsg.includes('TOO MANY REQUESTS')) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        if (retryCount < 3) {
          toast.error(`Rate limited. Retrying in ${Math.ceil(retryDelay/1000)}s...`);
          setTimeout(() => {
            loadInitialData(retryCount + 1);
          }, retryDelay);
          return;
        } else {
          toast.error('Too many requests. Please wait a moment and refresh the page.');
        }
      } else {
        toast.error('Error loading products');
      }
    } finally {
      setLoading(false);
      setIsLoadingProducts(false);
    }
  };

  const ensureConfigsFoldersExist = async (products: Product[]) => {
    if (!isAuthenticated) return;
    try {
      const promises = products.map(async (product) => {
        try {
          await createFolder({
            name: 'configs',
            parent_path: '/',
            product_id: product.id
          });
        } catch (error) {}
      });
      await Promise.all(promises);
    } catch (error) {}
  };

  const loadProductFiles = async () => {
    const targetId = selectedProduct?.id || selectedAgent?.id;
    if (!targetId) return;

    // Проверяем, не загружаем ли мы уже этот же ID
    const currentId = `${targetId}-${fileFilters.categoryFilter}-${fileFilters.searchTerm}`;
    
    // Если уже загружаем или уже загрузили эти данные - пропускаем
    if (isLoadingRef.current || lastLoadedIdRef.current === currentId) {
      return;
    }

    // Устанавливаем флаги сразу, чтобы предотвратить повторные вызовы
    isLoadingRef.current = true;
    lastLoadedIdRef.current = currentId;

    try {
      setRefreshing(true);
      const targetTypeForApi = selectedAgent ? 'agent' : selectedProduct ? 'product' : 'auto';
      const response = await getProductFiles(
        targetId, 
        fileFilters.categoryFilter, 
        'all', 
        fileFilters.searchTerm,
        targetTypeForApi as 'product' | 'agent' | 'auto'
      );

      if (response.files) {
        setFiles(response.files);
      } else {
        setFiles([]);
      }
    } catch (error: unknown) {
      // При ошибке сбрасываем lastLoadedIdRef, чтобы можно было повторить попытку
      lastLoadedIdRef.current = null;
      const errorMessage = getErrorMessage(error)
      toast.error(`Failed to load files: ${errorMessage}`);
      setFiles([]);
    } finally {
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  };

  const refreshData = async () => {
    if (selectedProduct || selectedAgent) {
      await loadProductFiles();
    }
  };

  const handleRefreshProducts = async () => {
    if (isLoadingProducts) {
      toast.info('Products are already loading, please wait...');
      return;
    }
    const now = Date.now();
    if (now - lastProductsLoad < PRODUCTS_LOAD_COOLDOWN) {
      const remainingTime = Math.ceil((PRODUCTS_LOAD_COOLDOWN - (now - lastProductsLoad)) / 1000);
      toast.info(`Please wait ${remainingTime} seconds before refreshing again`);
      return;
    }
    await loadInitialData();
  };

  const fileUpload = useFileManagerUpload({
    selectedProduct,
    selectedAgent,
    showConfigsFolder,
    onUploadSuccess: loadProductFiles,
  });

  const toggleFileSelection = fileSelection.toggleFileSelection;
  const clearSelection = fileSelection.clearSelection;
  const handleFileUpload = fileUpload.handleFileUpload;
  const resetUploadForm = fileUpload.resetUploadForm;
  const handleDragOver = fileUpload.handleDragOver;
  const handleDragLeave = fileUpload.handleDragLeave;
  const handleDrop = useCallback((e: React.DragEvent) => {
    fileUpload.handleDrop(e, () => {
      fileDialogs.openUploadDialog();
    });
  }, [fileUpload, fileDialogs]);

  const handleFileDownload = async (file: FileItem) => {
    try {
      let blob: Blob;
      let filename: string = file.name;
      toast.loading(`Downloading ${file.name}...`);

      if (file.category === 'config') {
        const configId = parseInt(file.id.replace('config_', ''));
        if (isNaN(configId)) { toast.error('Invalid config ID'); return; }
        blob = await downloadProductConfig(configId);
      } else if (file.category === 'resource') {
        const fileId = parseInt(file.id.replace('extra_', ''));
        if (isNaN(fileId)) { toast.error('Invalid file ID'); return; }
        const result = await downloadProductExtraFile(fileId);
        blob = result.blob;
        filename = result.filename || file.name;
      } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'agent') {
        const productId = file.productId;
        if (!productId) { toast.error('Could not determine product ID'); return; }
        const fileType = file.category as 'logo' | 'banner' | 'agent';
        blob = await downloadProductFile(productId, fileType);
        filename = `${file.name}_${fileType}.${fileType === 'agent' ? 'exe' : 'png'}`;
      } else {
        toast.error('Unsupported file type');
        return;
      }

      if (!blob || blob.size === 0) {
        toast.error('Downloaded file is empty or corrupted');
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`File "${filename}" downloaded successfully`);
    } catch (error: unknown) {
      let errorMessage = 'Error downloading file';
      const errorMsg = isErrorWithMessage(error) ? error.message : getErrorMessageUtil(error)
      if (errorMsg) {
        if (errorMsg.includes('File not found')) errorMessage = 'File not found on server';
        else if (errorMsg.includes('Access denied')) errorMessage = 'Access denied';
        else errorMessage = errorMsg;
      }
      toast.error(errorMessage);
    }
  };

  const handleFileDelete = async (file: FileItem) => {
    const confirmMessage = `Are you sure you want to delete "${file.name}"?`;
    if (!confirm(confirmMessage)) return false;

    try {
      toast.loading(`Deleting ${file.name}...`);
      if (file.category === 'config') {
        const configId = parseInt(file.id.replace('config_', ''));
        if (isNaN(configId)) { toast.error('Invalid config ID'); return false; }
        await deleteProductConfig(configId);
      } else if (file.category === 'resource') {
        const fileId = parseInt(file.id.replace('extra_', ''));
        if (isNaN(fileId)) { toast.error('Invalid file ID'); return false; }
        await deleteProductExtraFile(fileId);
      } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'agent') {
        const productId = file.productId;
        if (!productId) { toast.error('Could not determine product ID'); return false; }
        const fileType = file.category as 'logo' | 'banner' | 'agent';
        await deleteProductFile(productId, fileType);
      } else {
        toast.error('Unsupported file type');
        return false;
      }

      toast.success(`File "${file.name}" deleted successfully`);
      fileSelection.setSelectedFiles((prev) => prev.filter((id) => id !== file.id));
      await loadProductFiles();
      return true;
    } catch (error: unknown) {
      toast.error('Error deleting file');
      return false;
    }
  };

  const handleBulkDownload = async () => {
    const selectedFileObjects = fileSelection.getSelectedFileObjects(files);
    if (selectedFileObjects.length === 0) { toast.error('No files selected'); return; }
    toast.loading(`Downloading ${selectedFileObjects.length} files...`);
    try {
      let successCount = 0;
      for (const file of selectedFileObjects) {
        try { await handleFileDownload(file); successCount++; await new Promise(resolve => setTimeout(resolve, 300)); } catch (error) {}
      }
      if (successCount > 0) toast.success(`Downloaded ${successCount} files`);
    } catch (error) { toast.error('Bulk download failed'); }
  };

  const handleBulkDelete = async () => {
    const selectedFileObjects = fileSelection.getSelectedFileObjects(files);
    if (selectedFileObjects.length === 0) { toast.error('No files selected'); return; }
    if (!confirm(`Delete ${selectedFileObjects.length} files?`)) return;
    toast.loading(`Deleting...`);
    try {
      let successCount = 0;
      for (const file of selectedFileObjects) {
        try { const success = await handleFileDelete(file); if (success) successCount++; } catch (error) {}
      }
      fileSelection.clearSelection();
      if (successCount > 0) toast.success(`Deleted ${successCount} files`);
    } catch (error) { toast.error('Bulk deletion failed'); }
  };

  const handleViewFile = fileDialogs.openFileDetails;
  const handleFolderClick = (folderName: string) => {
    if (folderName === 'configs') {
      setShowConfigsFolder(true);
      setCurrentPath('/configs');
    }
  };
  const handleBackToRoot = () => {
    setShowConfigsFolder(false);
    setCurrentPath('/');
  };

  const getFileIcon = (fileName: string, fileType?: string) => {
    if (fileType === 'folder') return <Folder className="h-5 w-5 text-blue-500" />;
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'txt': case 'md': case 'log': return <FileText className="h-5 w-5 text-muted-foreground" />;
      case 'exe': case 'dll': case 'so': case 'dylib': return <Zap className="h-5 w-5 text-primary" />;
      case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return <Package className="h-5 w-5 text-orange-500" />;
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg': case 'ico': return <Image className="h-5 w-5 text-green-500" />;
      case 'mp4': case 'avi': case 'mov': case 'wmv': return <Video className="h-5 w-5 text-purple-500" />;
      case 'mp3': case 'wav': case 'flac': case 'aac': return <Music className="h-5 w-5 text-blue-500" />;
      case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
      case 'doc': case 'docx': return <FileText className="h-5 w-5 text-blue-600" />;
      case 'xls': case 'xlsx': return <FileText className="h-5 w-5 text-green-600" />;
      case 'ppt': case 'pptx': return <FileText className="h-5 w-5 text-orange-600" />;
      default: return <File className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = fileFilters.filteredFiles;
  const stats = useMemo(() => ({
    total: files.length,
    files: files.filter(f => f.type === 'file').length,
    folders: files.filter(f => f.type === 'folder').length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    active: files.filter(f => f.status === 'active').length,
    archived: files.filter(f => f.status === 'archived').length
  }), [files]);

  const displayItems = useMemo(() => {
    if (targetType === 'agent') {
      return [
        ...agents.map(l => ({ type: 'agent' as const, item: l })),
        ...filteredProductsForSelect.map(g => ({ type: 'product' as const, item: g }))
      ];
    } else {
      return filteredProductsForSelect.map(g => ({ type: 'product' as const, item: g }));
    }
  }, [targetType, agents, filteredProductsForSelect]);

  const hasItems = targetType === 'product' 
    ? filteredProductsForSelect.length > 0 
    : (agents.length > 0 || filteredProductsForSelect.length > 0);

  if (loading) {
    return <div className="p-8"><Spinner message="Loading..." /></div>;
  }

  return (
    <div className={cn("space-y-6", isMobile && "pb-6")}>
      {!hasItems && !loading && (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">
                {targetType === 'product' ? 'No Products Yet' : 'No Agents Yet'}
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                {targetType === 'product' 
                  ? 'Get started by creating your first product.'
                  : 'Get started by creating your first agent.'}
              </p>
              <Button onClick={() => onSwitchToProductDatabase?.()} className="gap-2" size="lg">
                <Plus className="h-5 w-5" />
                {targetType === 'product' ? 'Create Product' : 'Create Agent'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hasItems && (
        <Card>
          <CardHeader className="pb-0">
            <div className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Select Product</CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {targetType === 'product' 
                    ? `${filteredProductsForSelect.length} products available`
                    : `${agents.length + filteredProductsForSelect.length} available`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={handleRefreshProducts} disabled={isLoadingProducts}>
                  <RefreshCw className={`h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {showTargetTypeToggle && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <ToggleGroup type="single" value={targetType} onValueChange={(value) => value && setTargetType(value as 'product' | 'agent')} className="grid grid-cols-2 w-full">
                  <ToggleGroupItem value="product" className="flex items-center justify-center gap-2 h-8 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    <Database className="h-3 w-3" /> Product
                  </ToggleGroupItem>
                  <ToggleGroupItem value="agent" className="flex items-center justify-center gap-2 h-8 text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    <Container className="h-3 w-3" /> Agent
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}

            <div className="divide-y max-h-[200px] overflow-y-auto">
              {displayItems.map(({ type, item }) => {
                const isSelected = type === 'agent' ? selectedAgent?.id === item.id : selectedProduct?.id === item.id;
                return (
                  <div key={`${type}-${item.id}`} className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors hover:bg-accent/50 ${isSelected ? 'bg-primary/5' : ''}`} onClick={() => {
                      if (type === 'agent') { setSelectedAgent(item as Agent); setSelectedProduct(null); } 
                      else { setSelectedProduct(item as Product); setSelectedAgent(null); }
                      fileSelection.clearSelection();
                    }}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/10 rounded flex items-center justify-center flex-shrink-0">
                        {type === 'agent' ? <Container className="h-4 w-4 text-primary" /> : <Database className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm truncate">{item.name}</h4>
                          {isSelected && <Check className="h-3 w-3 text-primary" />}
                        </div>
                        {isSelected && <p className="text-xs text-muted-foreground">{stats.total} files • {formatFileSize(stats.totalSize)}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {fileSelection.selectedFiles.length > 0 && (
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Selected: {fileSelection.selectedFiles.length}</span>
                <Button variant="outline" size="sm" onClick={clearSelection}><X className="h-4 w-4 mr-1" /> Clear</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleBulkDownload} disabled={!canDownloadFiles} className="flex-1 sm:flex-none"><Download className="mr-2 h-4 w-4" /> Download All</Button>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive flex-1 sm:flex-none" onClick={handleBulkDelete} disabled={!canDeleteFiles}><Trash2 className="mr-2 h-4 w-4" /> Delete All</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasItems && (selectedProduct || selectedAgent) ? (
        <Card className={`transition-colors ${fileUpload.dragOver ? 'border-primary bg-primary/5' : ''}`} onDragOver={fileUpload.handleDragOver} onDragLeave={fileUpload.handleDragLeave} onDrop={handleDrop}>
          <CardHeader className="pb-0 px-4 sm:px-6 pt-4 sm:pt-6 relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={refreshData} 
              disabled={refreshing} 
              className="absolute top-4 right-4 sm:top-6 sm:right-6 h-9 w-9 sm:h-8 sm:w-8 shrink-0 touch-manipulation z-10"
            >
              <RefreshCw className={`h-4 w-4 sm:h-4 sm:w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex flex-col gap-3 sm:gap-4 pr-12 sm:pr-10">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                <div className="w-full sm:w-auto min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 sm:mb-1">
                    {showConfigsFolder && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleBackToRoot} 
                        className="h-9 w-9 sm:h-8 sm:w-8 shrink-0 touch-manipulation"
                      >
                        <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5 rotate-180" />
                      </Button>
                    )}
                    <CardTitle className="text-base sm:text-base truncate flex-1 min-w-0 leading-tight">
                      {showConfigsFolder ? 'Configs Folder' : `${selectedProduct?.name || selectedAgent?.name || 'Unknown'} Files`}
                    </CardTitle>
                  </div>
                  <CardDescription className="mt-1 text-xs sm:text-xs leading-relaxed">
                    <span className="block sm:inline">{filteredFiles.length} files</span>
                    {fileUpload.dragOver && (
                      <span className="text-primary ml-0 sm:ml-2 block sm:inline mt-1 sm:mt-0">
                        • Drag files to upload
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:flex-nowrap">
                  <ConditionalRender permission="products.files_upload" fallback={null}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="default" 
                          size="sm" 
                          disabled={!canUploadFiles || !selectedProduct} 
                          className="flex-1 sm:flex-none min-w-0 text-sm sm:text-sm h-10 sm:h-9 touch-manipulation px-3"
                        >
                          <Upload className="h-4 w-4 sm:h-4 sm:w-4 mr-1.5 sm:mr-1.5 shrink-0" /> 
                          <span className="truncate">Upload</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={fileDialogs.openUploadDialog} disabled={!selectedProduct}>
                          <File className="h-4 w-4 mr-2" />
                          Single Upload
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setMultiUploadDialogOpen(true)} 
                          disabled={!selectedProduct}
                        >
                          <Folder className="h-4 w-4 mr-2" />
                          Multi Upload
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </ConditionalRender>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-2 mt-1 sm:mt-4">
                <div className="relative flex-1 w-full min-w-0">
                  <Search className="absolute left-3 sm:left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    placeholder="Search files..." 
                    value={fileFilters.searchTerm} 
                    onChange={(e) => fileFilters.setSearchTerm(e.target.value)} 
                    className="pl-10 sm:pl-8 w-full h-10 sm:h-9 text-sm touch-manipulation" 
                  />
                </div>
                <Select value={fileFilters.categoryFilter} onValueChange={fileFilters.setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] h-10 sm:h-9 text-sm touch-manipulation">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="config">Config</SelectItem>
                    <SelectItem value="resource">Resource</SelectItem>
                    <SelectItem value="folder">Folder</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn("pt-0", isMobile && "pb-8")}>
            {refreshing ? <Spinner message="Loading files..." /> : filteredFiles.length === 0 ? (
              <div className="flex items-center justify-center py-12"><div className="text-center"><FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" /><div className="text-sm text-muted-foreground">No files found</div></div></div>
            ) : (
              <FilesList
                files={filteredFiles}
                selectedFiles={fileSelection.selectedFiles}
                canDownload={canDownloadFiles}
                canDelete={canDeleteFiles}
                onToggleSelection={toggleFileSelection}
                onFolderClick={handleFolderClick}
                onDownload={handleFileDownload}
                onView={handleViewFile}
                onDelete={handleFileDelete}
                getFileIcon={getFileIcon}
                formatFileSize={formatFileSize}
                isMobile={isMobile}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <FileDetailsDialog
        open={fileDialogs.fileDetailsOpen}
        onOpenChange={fileDialogs.setFileDetailsOpen}
        selectedFile={fileDialogs.selectedFile}
        canDownloadFiles={canDownloadFiles}
        getFileIcon={getFileIcon}
        formatFileSize={formatFileSize}
        onDownload={handleFileDownload}
        onClose={fileDialogs.closeFileDetails}
      />

      <FileUploadDialog
        open={fileDialogs.uploadDialogOpen}
        onOpenChange={fileDialogs.setUploadDialogOpen}
        selectedProduct={selectedProduct}
        selectedAgent={selectedAgent}
        showConfigsFolder={showConfigsFolder}
        canUploadFiles={canUploadFiles}
        uploadForm={fileUpload.uploadForm}
        uploading={fileUpload.uploading}
        uploadProgress={fileUpload.uploadProgress}
        dragOver={fileUpload.dragOver}
        fileInputRef={fileUpload.fileInputRef}
        onUploadFormChange={fileUpload.setUploadForm}
        onDragOver={fileUpload.handleDragOver}
        onDragLeave={fileUpload.handleDragLeave}
        onDrop={(e) => fileUpload.handleDrop(e, (file) => {})}
        onFileSelect={(file) => { fileUpload.setUploadForm(prev => ({ ...prev, name: file.name })); }}
        onUpload={handleFileUpload}
        onResetForm={resetUploadForm}
      />

      <MultiFileUploadDialog 
        product={selectedProduct} 
        onUploadComplete={loadProductFiles}
        open={multiUploadDialogOpen}
        onOpenChange={setMultiUploadDialogOpen}
      />
    </div>
  );
};

export default FileManager;