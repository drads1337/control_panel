import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/shared/hooks';
import { getProducts } from '@/entities/product';
import { getAgents } from '@/entities/agent';
import {
  getProductFiles,
  createFolder,
  deleteProductConfig,
  deleteProductExtraFile,
  deleteProductFile,
  downloadProductConfig,
  downloadProductExtraFile,
  downloadProductFile,
} from '@/entities/file';
import { getErrorMessage } from '@/shared/api/enhanced-client';
import { getErrorMessage as getErrorMessageUtil, isErrorWithMessage } from '@/shared/lib/utils';
import {
  useFileManagerSelection,
  useFileManagerDialogs,
  useFileManagerFilters,
  useFileManagerUpload,
} from '@/features/file-manager/hooks';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';
import type { FileItem } from '@/entities/file';

const PRODUCTS_LOAD_COOLDOWN = 5000;

interface UseFileManagerLogicParams {
  onSwitchToProductDatabase?: () => void;
}

/**
 * Основной хук для бизнес-логики FileManager.
 * Содержит всю логику загрузки данных, управления состоянием и операций с файлами.
 */
export function useFileManagerLogic({ onSwitchToProductDatabase }: UseFileManagerLogicParams = {}) {
  const { isAuthenticated } = useAuth();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfigsFolder, setShowConfigsFolder] = useState(false);
  const [targetType, setTargetType] = useState<'product' | 'agent'>('product');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [lastProductsLoad, setLastProductsLoad] = useState<number>(0);
  
  // Ref для отслеживания последнего загруженного ID, чтобы избежать повторных загрузок
  const lastLoadedIdRef = useRef<string | number | null>(null);
  const isLoadingRef = useRef(false);
  const isSwitchingTypeRef = useRef(false);

  // Hooks
  const fileSelection = useFileManagerSelection();
  const fileDialogs = useFileManagerDialogs();
  
  const fileFilters = useFileManagerFilters({
    files,
    showConfigsFolder,
    selectedProductId: selectedProduct?.id,
  });

  // Load product files
  const loadProductFiles = useCallback(async () => {
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
      const errorMessage = getErrorMessage(error);
      toast.error(`Failed to load files: ${errorMessage}`);
      setFiles([]);
    } finally {
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  }, [selectedProduct, selectedAgent, fileFilters.categoryFilter, fileFilters.searchTerm]);

  const fileUpload = useFileManagerUpload({
    selectedProduct,
    selectedAgent,
    showConfigsFolder,
    onUploadSuccess: loadProductFiles,
  });

  // Load initial data
  const loadInitialData = useCallback(async (retryCount = 0) => {
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
      } catch (agentError) {
        // Silent fail for agents
      }

      await ensureConfigsFoldersExist(response.products || []);
    } catch (error: unknown) {
      const errorMsg = isErrorWithMessage(error) ? error.message : getErrorMessageUtil(error);
      if (errorMsg.includes('429') || errorMsg.includes('TOO MANY REQUESTS')) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        if (retryCount < 3) {
          toast.error(`Rate limited. Retrying in ${Math.ceil(retryDelay / 1000)}s...`);
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
  }, [isLoadingProducts, lastProductsLoad, isAuthenticated]);

  const ensureConfigsFoldersExist = useCallback(async (products: Product[]) => {
    if (!isAuthenticated) return;
    try {
      const promises = products.map(async (product) => {
        try {
          await createFolder({
            name: 'configs',
            parent_path: '/',
            product_id: product.id,
          });
        } catch (error) {
          // Silent fail - folder might already exist
        }
      });
      await Promise.all(promises);
    } catch (error) {
      // Silent fail
    }
  }, [isAuthenticated]);

  // Ref для хранения актуальной функции загрузки (чтобы не включать её в зависимости эффектов)
  const loadProductFilesRef = useRef(loadProductFiles);
  
  // Обновляем ref при изменении функции
  useEffect(() => {
    loadProductFilesRef.current = loadProductFiles;
  }, [loadProductFiles]);

  // File operations
  const handleFileDownload = useCallback(async (file: FileItem) => {
    try {
      let blob: Blob;
      let filename: string = file.name;
      toast.loading(`Downloading ${file.name}...`);

      if (file.category === 'config') {
        const configId = parseInt(file.id.replace('config_', ''));
        if (isNaN(configId)) {
          toast.error('Invalid config ID');
          return;
        }
        blob = await downloadProductConfig(configId);
      } else if (file.category === 'resource') {
        const fileId = parseInt(file.id.replace('extra_', ''));
        if (isNaN(fileId)) {
          toast.error('Invalid file ID');
          return;
        }
        const result = await downloadProductExtraFile(fileId);
        blob = result.blob;
        filename = result.filename || file.name;
      } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'agent') {
        const productId = file.productId;
        if (!productId) {
          toast.error('Could not determine product ID');
          return;
        }
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
      const errorMsg = isErrorWithMessage(error) ? error.message : getErrorMessageUtil(error);
      if (errorMsg) {
        if (errorMsg.includes('File not found')) {
          errorMessage = 'File not found on server';
        } else if (errorMsg.includes('Access denied')) {
          errorMessage = 'Access denied';
        } else {
          errorMessage = errorMsg;
        }
      }
      toast.error(errorMessage);
    }
  }, []);

  const handleFileDelete = useCallback(async (file: FileItem) => {
    const confirmMessage = `Are you sure you want to delete "${file.name}"?`;
    if (!confirm(confirmMessage)) return false;

    try {
      toast.loading(`Deleting ${file.name}...`);
      if (file.category === 'config') {
        const configId = parseInt(file.id.replace('config_', ''));
        if (isNaN(configId)) {
          toast.error('Invalid config ID');
          return false;
        }
        await deleteProductConfig(configId);
      } else if (file.category === 'resource') {
        const fileId = parseInt(file.id.replace('extra_', ''));
        if (isNaN(fileId)) {
          toast.error('Invalid file ID');
          return false;
        }
        await deleteProductExtraFile(fileId);
      } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'agent') {
        const productId = file.productId;
        if (!productId) {
          toast.error('Could not determine product ID');
          return false;
        }
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
  }, [fileSelection, loadProductFiles]);

  const handleBulkDownload = useCallback(async () => {
    const selectedFileObjects = fileSelection.getSelectedFileObjects(files);
    if (selectedFileObjects.length === 0) {
      toast.error('No files selected');
      return;
    }
    toast.loading(`Downloading ${selectedFileObjects.length} files...`);
    try {
      let successCount = 0;
      for (const file of selectedFileObjects) {
        try {
          await handleFileDownload(file);
          successCount++;
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          // Continue with next file
        }
      }
      if (successCount > 0) {
        toast.success(`Downloaded ${successCount} files`);
      }
    } catch (error) {
      toast.error('Bulk download failed');
    }
  }, [files, fileSelection, handleFileDownload]);

  const handleBulkDelete = useCallback(async () => {
    const selectedFileObjects = fileSelection.getSelectedFileObjects(files);
    if (selectedFileObjects.length === 0) {
      toast.error('No files selected');
      return;
    }
    if (!confirm(`Delete ${selectedFileObjects.length} files?`)) return;
    toast.loading(`Deleting...`);
    try {
      let successCount = 0;
      for (const file of selectedFileObjects) {
        try {
          const success = await handleFileDelete(file);
          if (success) successCount++;
        } catch (error) {
          // Continue with next file
        }
      }
      fileSelection.clearSelection();
      if (successCount > 0) {
        toast.success(`Deleted ${successCount} files`);
      }
    } catch (error) {
      toast.error('Bulk deletion failed');
    }
  }, [files, fileSelection, handleFileDelete]);

  // Handlers
  const handleRefreshProducts = useCallback(async () => {
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
  }, [isLoadingProducts, lastProductsLoad, loadInitialData]);

  const handleFolderClick = useCallback((folderName: string) => {
    if (folderName === 'configs') {
      setShowConfigsFolder(true);
    }
  }, []);

  const handleBackToRoot = useCallback(() => {
    setShowConfigsFolder(false);
  }, []);

  // Computed values
  const filteredProductsForSelect = useMemo(() => {
    if (!products || !Array.isArray(products)) {
      return [];
    }
    if (targetType === 'product') {
      return products.filter((g) => g.is_multi_app === false);
    } else {
      return products.filter((g) => g.is_multi_app === true);
    }
  }, [products, targetType]);

  const stats = useMemo(
    () => ({
      total: files.length,
      files: files.filter((f) => f.type === 'file').length,
      folders: files.filter((f) => f.type === 'folder').length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      active: files.filter((f) => f.status === 'active').length,
      archived: files.filter((f) => f.status === 'archived').length,
    }),
    [files]
  );

  const displayItems = useMemo(() => {
    if (targetType === 'agent') {
      return [
        ...agents.map((l) => ({ type: 'agent' as const, item: l })),
        ...filteredProductsForSelect.map((g) => ({ type: 'product' as const, item: g })),
      ];
    } else {
      return filteredProductsForSelect.map((g) => ({ type: 'product' as const, item: g }));
    }
  }, [targetType, agents, filteredProductsForSelect]);

  const hasItems =
    targetType === 'product'
      ? filteredProductsForSelect.length > 0
      : agents.length > 0 || filteredProductsForSelect.length > 0;

  // Effects
  useEffect(() => {
    if (isAuthenticated) {
      fileFilters.loadFiltersFromStorage();
    }
  }, [isAuthenticated, fileFilters]);

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated, loadInitialData]);

  // Сброс выбора при изменении targetType
  useEffect(() => {
    isSwitchingTypeRef.current = true;
    setSelectedProduct(null);
    setSelectedAgent(null);
    setFiles([]);
    lastLoadedIdRef.current = null; // Сбрасываем ref при смене типа
  }, [targetType]);

  // Автоматический выбор первого элемента при изменении targetType или списка элементов
  useEffect(() => {
    if (targetType === 'product' && filteredProductsForSelect.length > 0 && !selectedProduct) {
      setSelectedProduct(filteredProductsForSelect[0]);
      setSelectedAgent(null);
      // Сбрасываем флаг после установки выбора
      setTimeout(() => {
        isSwitchingTypeRef.current = false;
      }, 50);
    } else if (targetType === 'agent') {
      const allItems = [...agents, ...filteredProductsForSelect];
      if (allItems.length > 0 && !selectedProduct && !selectedAgent) {
        const firstAgent = agents[0];
        if (firstAgent) {
          setSelectedAgent(firstAgent);
          setSelectedProduct(null);
          // Сбрасываем флаг после установки выбора
          setTimeout(() => {
            isSwitchingTypeRef.current = false;
          }, 50);
        } else if (filteredProductsForSelect.length > 0) {
          setSelectedProduct(filteredProductsForSelect[0]);
          setSelectedAgent(null);
          // Сбрасываем флаг после установки выбора
          setTimeout(() => {
            isSwitchingTypeRef.current = false;
          }, 50);
        }
      }
    }
  }, [filteredProductsForSelect, agents, selectedProduct, selectedAgent, targetType]);

  // Загрузка файлов при изменении выбранного продукта/агента или фильтров
  useEffect(() => {
    if (!(selectedProduct || selectedAgent) || !isAuthenticated) {
      return;
    }

    // Не загружаем во время переключения типа
    if (isSwitchingTypeRef.current) {
      return;
    }

    const targetId = selectedProduct?.id || selectedAgent?.id;
    if (!targetId) return;

    // Проверяем, не загружаем ли мы уже этот же ID с теми же фильтрами
    const currentId = `${targetId}-${fileFilters.categoryFilter}-${fileFilters.searchTerm}`;
    if (lastLoadedIdRef.current === currentId) {
      return;
    }

    // Используем таймаут для debounce при изменении фильтров
    const timeoutId = setTimeout(() => {
      // Повторная проверка перед загрузкой (на случай если ID изменился во время таймаута)
      if (isSwitchingTypeRef.current) {
        return;
      }
      const currentTargetId = selectedProduct?.id || selectedAgent?.id;
      const currentIdCheck = `${currentTargetId}-${fileFilters.categoryFilter}-${fileFilters.searchTerm}`;
      
      // Проверяем еще раз перед загрузкой
      if (currentTargetId === targetId && lastLoadedIdRef.current !== currentIdCheck && !isLoadingRef.current) {
        loadProductFilesRef.current();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [selectedProduct?.id, selectedAgent?.id, isAuthenticated, fileFilters.searchTerm, fileFilters.categoryFilter]);

  return {
    // State
    products,
    agents,
    selectedProduct,
    selectedAgent,
    files,
    loading,
    refreshing,
    showConfigsFolder,
    targetType,
    isLoadingProducts,
    filteredProductsForSelect,
    displayItems,
    hasItems,
    stats,
    
    // Hooks
    fileSelection,
    fileDialogs,
    fileFilters,
    fileUpload,
    
    // Actions
    setSelectedProduct,
    setSelectedAgent,
    setTargetType,
    loadInitialData,
    loadProductFiles,
    refreshData: loadProductFiles,
    handleRefreshProducts,
    handleFileDownload,
    handleFileDelete,
    handleBulkDownload,
    handleBulkDelete,
    handleFolderClick,
    handleBackToRoot,
  };
}
