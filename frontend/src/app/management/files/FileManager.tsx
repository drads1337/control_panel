import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { 
  FolderOpen, Plus, Upload, Download, Trash2, Edit, Eye, FileText, 
  Image, Package, HardDrive, Search, AlertTriangle, CheckCircle,
  Folder, File, Archive, Video, Music, Code, Settings, FileUp, Zap,
  MoreVertical, Star, Calendar, User as UserIcon, CloudUpload,
  RefreshCw, X, Check, ChevronRight, Home, FolderPlus, Gamepad2, Container
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ConditionalRender } from '@/components/rbac/conditional-render';
import { getGames } from '@/entities/game'
import { getLoaders } from '@/entities/loader'
import { getGameFiles, getGameFileStats, createFolder, deleteFolder, uploadGameConfig, uploadGameExtraFile, deleteGameConfig, deleteGameExtraFile, deleteGameFile, downloadGameConfig, downloadGameExtraFile, downloadGameFile } from '@/entities/file';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { getErrorMessage } from '@/shared/api/enhanced-client';
import MultiFileUploadDialog from './MultiFileUploadDialog';
import type { User } from '@/entities/user';
import type { Game } from '@/entities/game';
import type { FileItem } from '@/entities/file';
import type { Loader } from '@/entities/loader';

interface FileManagerProps {
  onSwitchToGameDatabase?: () => void;
}

// Memoized file item component for better performance
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
  return (
    <div
      className={`group relative border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onClick={() => {
        if (file.type === 'folder' && file.name === 'configs') {
          onFolderClick(file.name);
        } else {
          onToggleSelection(String(file.id));
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 mt-1">
            {getFileIcon(file.name, file.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{file.name}</h3>
            {file.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {file.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{formatFileSize(file.size)}</span>
              <span>•</span>
              <span>{new Date(file.modified).toLocaleDateString()}</span>
              {file.category && (
                <>
                  <span>•</span>
                  <Badge variant="secondary" className="text-xs">
                    {file.category}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        
        <ConditionalRender 
          permissions={['games.files_view', 'games.files_download', 'games.files_delete']}
          requireAll={false}
          fallback={null}
        >
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {file.type !== 'folder' && (
                  <>
                    <ConditionalRender permission="games.files_download" fallback={null}>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canDownload) onDownload(file);
                        }}
                        disabled={!canDownload}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                    </ConditionalRender>
                    <ConditionalRender permission="games.files_view" fallback={null}>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        onView(file);
                      }}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                    </ConditionalRender>
                    <ConditionalRender permission="games.files_delete" fallback={null}>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canDelete) onDelete(file);
                        }}
                        className="text-destructive"
                        disabled={!canDelete}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </ConditionalRender>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ConditionalRender>
      </div>
    </div>
  );
});

const FileManager: React.FC<FileManagerProps> = ({ onSwitchToGameDatabase }) => {
  const { isAuthenticated } = useAuth();
  const { hasPermission } = usePermissions();
  
  const canViewFiles = hasPermission('games.files_view');
  const canUploadFiles = hasPermission('games.files_upload');
  const canDeleteFiles = hasPermission('games.files_delete');
  const canDownloadFiles = hasPermission('games.files_download');
  
  // Check permissions for target type selection
  const canViewGames = hasPermission('games.view');
  const canViewLoaders = hasPermission('loaders.view');
  const showTargetTypeToggle = canViewGames && canViewLoaders;
  
  // Early return if user doesn't have permission to view files
  if (!canViewFiles) {
    return (
      <Card className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">You don't have permission to view files.</p>
      </Card>
    );
  }
  
  // Main state
  const [games, setGames] = useState<Game[]>([]);
  const [loaders, setLoaders] = useState<Loader[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedLoader, setSelectedLoader] = useState<Loader | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [showConfigsFolder, setShowConfigsFolder] = useState(false);
  const [targetType, setTargetType] = useState<'application' | 'loader'>('application');
  
  // Rate limiting protection
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [lastGamesLoad, setLastGamesLoad] = useState<number>(0);
  const GAMES_LOAD_COOLDOWN = 5000; // 5 seconds cooldown between game loads
  
  // UI state
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Key for localStorage
  const FILTERS_STORAGE_KEY = 'fileManager_filters';
  
  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [fileDetailsOpen, setFileDetailsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  
  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  
  // Upload form
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    category: 'resource' as 'config' | 'resource',
    uploadPath: '/'
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    if (isAuthenticated && canViewFiles) {
      loadInitialData();
      loadFiltersFromStorage();
    }
  }, [isAuthenticated, canViewFiles]);
  
  // Check access
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

  // Load filters from localStorage
  const loadFiltersFromStorage = () => {
    try {
      const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        setCategoryFilter(filters.categoryFilter || 'all');
      }
    } catch (error) {
      console.error('Failed to load filters from storage:', error);
    }
  };

  // Save filters to localStorage
  const saveFiltersToStorage = () => {
    try {
      const filters = {
        categoryFilter
      };
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Failed to save filters to storage:', error);
    }
  };

  // Save filters when they change
  useEffect(() => {
    saveFiltersToStorage();
  }, [categoryFilter]);

  // Filter games and loaders based on targetType (for auto-select)
  const filteredGamesForSelect = useMemo(() => {
    if (targetType === 'application') {
      return games.filter(g => g.is_multi_app === false);
    } else {
      return games.filter(g => g.is_multi_app === true);
    }
  }, [games, targetType]);

  // Automatically select the first game/loader
  useEffect(() => {
    if (targetType === 'application' && filteredGamesForSelect.length > 0 && !selectedGame) {
      setSelectedGame(filteredGamesForSelect[0]);
      setSelectedLoader(null);
    } else if (targetType === 'loader') {
      const allItems = [...loaders, ...filteredGamesForSelect];
      if (allItems.length > 0 && !selectedGame && !selectedLoader) {
        // Prefer loader if available, otherwise game
        const firstLoader = loaders[0];
        if (firstLoader) {
          setSelectedLoader(firstLoader);
          setSelectedGame(null);
        } else if (filteredGamesForSelect.length > 0) {
          setSelectedGame(filteredGamesForSelect[0]);
          setSelectedLoader(null);
        }
      }
    }
  }, [filteredGamesForSelect, loaders, selectedGame, selectedLoader, targetType]);

  // Load files when the selected game/loader changes
  useEffect(() => {
    if ((selectedGame || selectedLoader) && isAuthenticated) {
      loadGameFiles();
    }
  }, [selectedGame, selectedLoader, isAuthenticated]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if ((selectedGame || selectedLoader) && isAuthenticated) {
        loadGameFiles();
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, categoryFilter]);

  // Auto-set target type based on permissions
  useEffect(() => {
    if (!showTargetTypeToggle) {
      if (canViewGames && !canViewLoaders && targetType !== 'application') {
        setTargetType('application');
      } else if (canViewLoaders && !canViewGames && targetType !== 'loader') {
        setTargetType('loader');
      }
    }
  }, [showTargetTypeToggle, canViewGames, canViewLoaders, targetType]);

  // Clear selection when targetType changes
  useEffect(() => {
    setSelectedGame(null);
    setSelectedLoader(null);
    setFiles([]);
  }, [targetType]);

  const loadInitialData = async (retryCount = 0) => {
    // Rate limiting protection
    const now = Date.now();
    if (isLoadingGames || (now - lastGamesLoad < GAMES_LOAD_COOLDOWN)) {
      console.log('Games loading is rate limited, skipping request');
      return;
    }

    try {
      setIsLoadingGames(true);
      setLoading(true);
      setLastGamesLoad(now);
      
      // Load games
      const response = await getGames('all');
      setGames(response.games);
      
      // Load loaders if in loader mode or always to have them available
      try {
        const loadersResponse = await getLoaders();
        setLoaders(loadersResponse.loaders || []);
      } catch (loaderError) {
        console.error('Failed to load loaders:', loaderError);
        // Don't show error for loaders as it's not critical if we're in application mode
      }
      
      // Automatically create a configs folder for each game
      await ensureConfigsFoldersExist(response.games);
    } catch (error: any) {
      console.error('Failed to load games:', error);
      
      // Handle rate limiting specifically
      if (error.message?.includes('429') || error.message?.includes('TOO MANY REQUESTS')) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
        
        if (retryCount < 3) {
          console.log(`Rate limited, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/3)`);
          toast.error(`Rate limited. Retrying in ${Math.ceil(retryDelay/1000)}s...`);
          
          setTimeout(() => {
            loadInitialData(retryCount + 1);
          }, retryDelay);
          return;
        } else {
          toast.error('Too many requests. Please wait a moment and refresh the page.');
        }
      } else {
        toast.error('Error loading games');
      }
    } finally {
      setLoading(false);
      setIsLoadingGames(false);
    }
  };

  const ensureConfigsFoldersExist = async (games: Game[]) => {
    if (!isAuthenticated) return;
    
    try {
      // Create a configs folder for each game
      const promises = games.map(async (game) => {
        try {
          await createFolder({
            name: 'configs',
            parent_path: '/',
            game_id: game.id
          });
        } catch (error) {
          // Ignore errors if the folder already exists
          console.log(`Configs folder might already exist for game ${game.name}:`, error);
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to ensure configs folders exist:', error);
      // Do not show an error to the user as it is not critical
    }
  };

  const loadGameFiles = async () => {
    const targetId = selectedGame?.id || selectedLoader?.id;
    const targetType = selectedGame ? 'game' : 'loader';
    const targetName = selectedGame?.name || selectedLoader?.name || 'Unknown';
    
    console.log('📂 [FileManager] loadGameFiles called:', {
      targetId,
      targetType,
      targetName,
      selectedGame: selectedGame ? { id: selectedGame.id, name: selectedGame.name } : null,
      selectedLoader: selectedLoader ? { id: selectedLoader.id, name: selectedLoader.name } : null,
      categoryFilter,
      status: 'all',
      searchTerm,
      timestamp: new Date().toISOString()
    });
    
    if (!targetId) {
      console.warn('📂 [FileManager] No game or loader selected, cannot load files');
      return;
    }
    
    try {
      console.log('📂 [FileManager] Starting file load process:', {
        targetId,
        targetType,
        targetName,
        categoryFilter,
        searchTerm,
        isAuthenticated
      });
      
      setRefreshing(true);
      
      // Use game files API for both games and loaders
      // Pass target_type to help backend identify if it's a game or loader
      console.log('📂 [FileManager] Calling getGameFiles API...');
      const apiStartTime = performance.now();
      
      const targetTypeForApi = selectedLoader ? 'loader' : selectedGame ? 'game' : 'auto';
      
      const response = await getGameFiles(
        targetId, 
        categoryFilter, 
        'all', 
        searchTerm,
        targetTypeForApi as 'game' | 'loader' | 'auto'
      );
      
      const apiDuration = performance.now() - apiStartTime;
      
      console.log('📂 [FileManager] API call completed:', {
        duration: `${apiDuration.toFixed(2)}ms`,
        responseKeys: Object.keys(response),
        filesCount: response.files?.length || 0,
        total: response.total,
        hasFiles: Array.isArray(response.files)
      });
      
      if (response.files) {
        console.log('📂 [FileManager] Setting files state:', {
          filesCount: response.files.length,
          fileIds: response.files.map(f => f.id).slice(0, 5),
          categories: [...new Set(response.files.map(f => f.category))],
          sampleFile: response.files[0] || null
        });
        
        setFiles(response.files);
        console.log('📂 [FileManager] Files loaded successfully:', response.files.length);
      } else {
        console.warn('📂 [FileManager] No files in response, setting empty array:', {
          response,
          responseType: typeof response,
          responseKeys: response ? Object.keys(response) : []
        });
        setFiles([]);
      }
    } catch (error: unknown) {
      // Log error details for debugging (in development)
      if (import.meta.env.DEV) {
        console.error('📂 [FileManager] Failed to load files - detailed error:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          targetId,
          targetType,
          targetName,
          categoryFilter,
          searchTerm
        });
      }
      
      // Use standardized error message utility for user-friendly messages
      const errorMessage = getErrorMessage(error)
      toast.error(`Failed to load files: ${errorMessage}`);
      setFiles([]); // Set empty array on error
    } finally {
      console.log('📂 [FileManager] loadGameFiles completed, setting refreshing to false');
      setRefreshing(false);
    }
  };

  const refreshData = async () => {
    if (selectedGame || selectedLoader) {
      await loadGameFiles();
    }
  };

  const handleRefreshGames = async () => {
    if (isLoadingGames) {
      toast.info('Games are already loading, please wait...');
      return;
    }
    
    const now = Date.now();
    if (now - lastGamesLoad < GAMES_LOAD_COOLDOWN) {
      const remainingTime = Math.ceil((GAMES_LOAD_COOLDOWN - (now - lastGamesLoad)) / 1000);
      toast.info(`Please wait ${remainingTime} seconds before refreshing again`);
      return;
    }
    
    await loadInitialData();
  };

  // File selection handlers
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId) 
        : [...prev, fileId]
    );
  };

  const selectAllFiles = () => {
    setSelectedFiles(filteredFiles.map(f => f.id));
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  // File upload handlers
  const handleFileUpload = async (file: File) => {
    const targetId = selectedGame?.id || selectedLoader?.id;
    if (!targetId) {
      toast.error('Please select an application or loader first');
      return false;
    }

    if (!file) {
      toast.error('Please select a file to upload');
      return false;
    }

    // File size validation removed - now handled by project storage limits on backend

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 200);

      let uploadResult;
      
      const gameId = selectedGame?.id || selectedLoader?.id;
      if (!gameId) {
        toast.error('No application or loader selected');
        return false;
      }

      // If we are in the configs folder, upload as an extra file
      if (showConfigsFolder || uploadForm.uploadPath === '/configs') {
        uploadResult = await uploadGameExtraFile(
          file,
          gameId,
          uploadForm.name || file.name,
          uploadForm.description
        );
      } else if (uploadForm.category === 'config') {
        uploadResult = await uploadGameConfig(
          file,
          gameId,
          uploadForm.name || file.name,
          uploadForm.description,
          uploadForm.version,
          true
        );
      } else {
        uploadResult = await uploadGameExtraFile(
          file,
          gameId,
          uploadForm.name || file.name,
          uploadForm.description
        );
      }

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast.success(`File "${file.name}" uploaded successfully`);
      setUploadDialogOpen(false);
      resetUploadForm();
      
      // Refresh the file list
      await loadGameFiles();
      
      return true;
    } catch (error: any) {
      console.error('Failed to upload file:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Error uploading file';
      if (error.message) {
        if (error.message.includes('File too large')) {
          errorMessage = 'File size exceeds the limit';
        } else if (error.message.includes('Insufficient storage')) {
          errorMessage = 'Insufficient storage space';
        } else if (error.message.includes('File type not allowed')) {
          errorMessage = 'File type not allowed';
        } else if (error.message.includes('Game not found')) {
          errorMessage = 'Selected game not found';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      return false;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const resetUploadForm = () => {
    setUploadForm({
      name: '',
      description: '',
      version: '1.0.0',
      category: 'config',
      uploadPath: showConfigsFolder ? '/configs' : '/'
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      toast.error('No files found in the drop');
      return;
    }

    if (files.length > 1) {
      toast.error('Please drop only one file at a time');
      return;
    }

    const file = files[0];
    
    // Validate file size
    const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
    if (file.size > maxSize) {
      toast.error('File size exceeds 5GB limit');
      return;
    }

    // Pre-populate the upload form with the dropped file
    setUploadForm(prev => ({
      ...prev,
      name: file.name,
      category: file.name.toLowerCase().includes('config') ? 'config' : 'resource'
    }));
    
    setUploadDialogOpen(true);
    toast.success(`File "${file.name}" ready for upload`);
  };

  // File handlers
  const handleFileDownload = async (file: FileItem) => {
    try {
      let blob: Blob;
      let filename: string = file.name;
      
      // Show loading state
      toast.loading(`Downloading ${file.name}...`);
      
      if (file.category === 'config') {
        const configId = parseInt(file.id.replace('config_', ''));
        if (isNaN(configId)) {
          toast.error('Invalid config ID');
          return;
        }
        blob = await downloadGameConfig(configId);
      } else if (file.category === 'resource') {
        const fileId = parseInt(file.id.replace('extra_', ''));
        if (isNaN(fileId)) {
          toast.error('Invalid file ID');
          return;
        }
        const result = await downloadGameExtraFile(fileId);
        blob = result.blob;
        filename = result.filename || file.name; // Use the original file name
      } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'loader') {
        const gameId = file.gameId;
        if (!gameId) {
          toast.error('Could not determine game ID to download the file');
          return;
        }
        const fileType = file.category as 'logo' | 'banner' | 'loader';
        blob = await downloadGameFile(gameId, fileType);
        // Generate appropriate filename for game files
        filename = `${file.name}_${fileType}.${fileType === 'loader' ? 'exe' : 'png'}`;
      } else {
        toast.error('Unsupported file type for download');
        return;
      }
      
      // Validate blob
      if (!blob || blob.size === 0) {
        toast.error('Downloaded file is empty or corrupted');
        return;
      }
      
      // Create a link for downloading
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
    } catch (error: any) {
      console.error('Failed to download file:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Error downloading file';
      if (error.message) {
        if (error.message.includes('File not found')) {
          errorMessage = 'File not found on server';
        } else if (error.message.includes('Access denied')) {
          errorMessage = 'Access denied to this file';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error during download';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const handleFileDelete = async (file: FileItem) => {
    // More descriptive confirmation dialog
    const confirmMessage = `Are you sure you want to delete "${file.name}"?\n\nThis action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return false;
    }

    try {
      // Show loading state
      toast.loading(`Deleting ${file.name}...`);
      
      if (file.category === 'config') {
        const configId = parseInt(file.id.replace('config_', ''));
        if (isNaN(configId)) {
          toast.error('Invalid config ID');
          return false;
        }
        await deleteGameConfig(configId);
      } else if (file.category === 'resource') {
        const fileId = parseInt(file.id.replace('extra_', ''));
        if (isNaN(fileId)) {
          toast.error('Invalid file ID');
          return false;
        }
        await deleteGameExtraFile(fileId);
      } else if (file.category === 'logo' || file.category === 'banner' || file.category === 'loader') {
        const gameId = file.gameId;
        if (!gameId) {
          toast.error('Could not determine game ID to delete the file');
          return false;
        }
        const fileType = file.category as 'logo' | 'banner' | 'loader';
        await deleteGameFile(gameId, fileType);
      } else {
        toast.error('Unsupported file type for deletion');
        return false;
      }

      toast.success(`File "${file.name}" deleted successfully`);
      
      // Remove from selected files if it was selected
      setSelectedFiles(prev => prev.filter(id => id !== file.id));
      
      // Refresh the file list
      await loadGameFiles();
      
      return true;
    } catch (error: any) {
      console.error('Failed to delete file:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Error deleting file';
      if (error.message) {
        if (error.message.includes('File not found')) {
          errorMessage = 'File not found on server';
        } else if (error.message.includes('Access denied')) {
          errorMessage = 'Access denied to delete this file';
        } else if (error.message.includes('Permission')) {
          errorMessage = 'Insufficient permissions to delete this file';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
      return false;
    }
  };

  const handleBulkDownload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected for download');
      return;
    }
    
    const selectedFileObjects = files.filter(f => selectedFiles.includes(f.id));
    if (selectedFileObjects.length === 0) {
      toast.error('Selected files not found');
      return;
    }
    
    toast.loading(`Downloading ${selectedFileObjects.length} files...`);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const file of selectedFileObjects) {
        try {
          await handleFileDownload(file);
          successCount++;
          // Small delay between downloads to avoid overwhelming the browser
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Failed to download ${file.name}:`, error);
          errorCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`Successfully downloaded ${successCount} files`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to download ${errorCount} files`);
      }
    } catch (error) {
      console.error('Failed to bulk download:', error);
      toast.error('Bulk download failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected for deletion');
      return;
    }
    
    const selectedFileObjects = files.filter(f => selectedFiles.includes(f.id));
    if (selectedFileObjects.length === 0) {
      toast.error('Selected files not found');
      return;
    }
    
    const confirmMessage = `Are you sure you want to delete ${selectedFileObjects.length} files?\n\nThis action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    toast.loading(`Deleting ${selectedFileObjects.length} files...`);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const file of selectedFileObjects) {
        try {
          const success = await handleFileDelete(file);
          if (success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Failed to delete ${file.name}:`, error);
          errorCount++;
        }
      }
      
      setSelectedFiles([]);
      
      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} files`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} files`);
      }
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      toast.error('Bulk deletion failed');
    }
  };

  const handleViewFile = (file: FileItem) => {
    setSelectedFile(file);
    setFileDetailsOpen(true);
  };

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

  const hasActiveFilters = searchTerm !== '' || categoryFilter !== 'all';

  const getFileIcon = (fileName: string, fileType?: string) => {
    // If it's a folder, show the folder icon
    if (fileType === 'folder') {
      return <Folder className="h-5 w-5 text-blue-500" />;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'txt':
      case 'md':
      case 'log':
        return <FileText className="h-5 w-5 text-muted-foreground" />;
      case 'exe':
      case 'dll':
      case 'so':
      case 'dylib':
        return <Zap className="h-5 w-5 text-primary" />;
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return <Package className="h-5 w-5 text-orange-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'ico':
        return <Image className="h-5 w-5 text-green-500" />;
      case 'mp4':
      case 'avi':
      case 'mov':
      case 'wmv':
        return <Video className="h-5 w-5 text-purple-500" />;
      case 'mp3':
      case 'wav':
      case 'flac':
      case 'aac':
        return <Music className="h-5 w-5 text-blue-500" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'xls':
      case 'xlsx':
        return <FileText className="h-5 w-5 text-green-600" />;
      case 'ppt':
      case 'pptx':
        return <FileText className="h-5 w-5 text-orange-600" />;
      default:
        return <File className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // Filtering utilities
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Memoized calculations
  const filteredFiles = useMemo(() => {
    if (!files || files.length === 0) {
      return [];
    }

    if (showConfigsFolder) {
      // Show only files from the configs folder
      return files.filter(file => {
        const searchMatch = searchTerm === '' || 
          file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (file.description && file.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const categoryMatch = categoryFilter === 'all' || file.category === categoryFilter;
        const pathMatch = file.path && file.path.includes('/configs/');
        
        return searchMatch && categoryMatch && pathMatch;
      }).sort((a, b) => {
        // Sort folders first, then files
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
    } else {
      // Show regular files + the configs folder
      const regularFiles = files.filter(file => {
        const searchMatch = searchTerm === '' || 
          file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (file.description && file.description.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const categoryMatch = categoryFilter === 'all' || file.category === categoryFilter;
        const notInConfigs = !file.path || !file.path.includes('/configs/');
        
        return searchMatch && categoryMatch && notInConfigs;
      }).sort((a, b) => {
        // Sort folders first, then files
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });

      // Add the virtual configs folder if it matches the search
      const configsFolderMatches = searchTerm === '' || 
        'configs'.toLowerCase().includes(searchTerm.toLowerCase()) ||
        'user settings'.toLowerCase().includes(searchTerm.toLowerCase());

      if (configsFolderMatches && (categoryFilter === 'all' || categoryFilter === 'folder')) {
        const configsFolder: FileItem = {
          id: 'configs_folder',
          name: 'configs',
          type: 'folder',
          category: 'folder',
          size: 0,
          modified: new Date().toISOString(),
          status: 'active',
          path: '/configs',
          description: 'Folder for user settings',
          gameId: selectedGame?.id
        };

        return [configsFolder, ...regularFiles];
      }

      return regularFiles;
    }
  }, [files, searchTerm, categoryFilter, showConfigsFolder, selectedGame]);

  const stats = useMemo(() => ({
    total: files.length,
    files: files.filter(f => f.type === 'file').length,
    folders: files.filter(f => f.type === 'folder').length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    active: files.filter(f => f.status === 'active').length,
    archived: files.filter(f => f.status === 'archived').length
  }), [files]);


  // Filter games and loaders based on targetType
  const filteredGames = useMemo(() => {
    if (targetType === 'application') {
      // Only show games from app library (is_multi_app === false)
      return games.filter(g => g.is_multi_app === false);
    } else {
      // Show games with loaders (is_multi_app === true)
      return games.filter(g => g.is_multi_app === true);
    }
  }, [games, targetType]);

  // Get display items for loader mode (loaders + games with loaders)
  const displayItems = useMemo(() => {
    if (targetType === 'loader') {
      // Combine loaders and games with loaders
      return [
        ...loaders.map(l => ({ type: 'loader' as const, item: l })),
        ...filteredGames.map(g => ({ type: 'game' as const, item: g }))
      ];
    } else {
      // Only games for application mode
      return filteredGames.map(g => ({ type: 'game' as const, item: g }));
    }
  }, [targetType, loaders, filteredGames]);

  const hasItems = targetType === 'application' 
    ? filteredGames.length > 0 
    : (loaders.length > 0 || filteredGames.length > 0);

  if (loading) {
    return (
      <div className="p-8">
        <Spinner message="Loading..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Empty State - No Games/Loaders */}
      {!hasItems && !loading && (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">
                {targetType === 'application' ? 'No Applications Yet' : 'No Loaders Yet'}
              </h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
                {targetType === 'application' 
                  ? 'Get started by creating your first application. You can manage settings, upload files, and track usage.'
                  : 'Get started by creating your first loader or game with loader support.'}
              </p>
              <Button 
                onClick={() => onSwitchToGameDatabase?.()}
                className="gap-2"
                size="lg"
              >
                <Plus className="h-5 w-5" />
                {targetType === 'application' ? 'Create Your First Application' : 'Create Loader'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Game/Loader Selection */}
      {hasItems && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Application</CardTitle>
                <CardDescription>
                  Choose an application to manage its files and resources
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target Type Selection - only show if user has both permissions */}
            {showTargetTypeToggle ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <ToggleGroup
                  type="single"
                  value={targetType}
                  onValueChange={(value) => value && setTargetType(value as 'application' | 'loader')}
                  className="grid grid-cols-2 w-full"
                >
                  <ToggleGroupItem 
                    value="application" 
                    className="flex items-center justify-center gap-2 h-8 text-xs font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted hover:border-muted-foreground/20 transition-colors"
                  >
                    <Gamepad2 className="h-3 w-3" />
                    App
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="loader" 
                    className="flex items-center justify-center gap-2 h-8 text-xs font-medium border border-border bg-background text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary hover:bg-muted hover:border-muted-foreground/20 transition-colors"
                  >
                    <Container className="h-3 w-3" />
                    Loader
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            ) : null}


            {/* Application/Loader Grid */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayItems.map(({ type, item }) => {
                const isSelected = type === 'loader' 
                  ? selectedLoader?.id === item.id
                  : selectedGame?.id === item.id;
                
                return (
                  <div
                    key={`${type}-${item.id}`}
                    className={`relative border rounded-lg p-4 cursor-pointer transition-all hover:shadow-sm ${
                      isSelected
                        ? 'ring-2 ring-primary bg-primary/5 border-primary' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      if (type === 'loader') {
                        setSelectedLoader(item as Loader);
                        setSelectedGame(null);
                      } else {
                        setSelectedGame(item as Game);
                        setSelectedLoader(null);
                      }
                      setSelectedFiles([]);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded flex items-center justify-center">
                        {type === 'loader' ? (
                          <Container className="h-5 w-5 text-primary" />
                        ) : (
                          <Gamepad2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{item.name}</h3>
                        {isSelected && (
                          <p className="text-xs text-muted-foreground">
                            {stats.total} files • {formatFileSize(stats.totalSize)}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 bg-primary rounded-2xl flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </CardContent>
        </Card>
      )}

      {/* Bulk Actions */}
      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Selected: {selectedFiles.length} files
                </span>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <ConditionalRender permission="games.files_download" fallback={null}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleBulkDownload}
                    disabled={!canDownloadFiles}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download All
                  </Button>
                </ConditionalRender>
                <ConditionalRender permission="games.files_delete" fallback={null}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700"
                    onClick={handleBulkDelete}
                    disabled={!canDeleteFiles}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All
                  </Button>
                </ConditionalRender>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files Display */}
      {hasItems && !selectedGame && !selectedLoader ? (
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">Select an Application</h3>
              <p className="text-muted-foreground text-lg mb-6 max-w-md mx-auto">
                Choose an application from the list above to view and manage its files, 
                configurations, and resources.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-xs font-medium">
                  {targetType === 'application' 
                    ? `${filteredGames.length} applications available`
                    : `${loaders.length + filteredGames.length} loaders available`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : hasItems && (selectedGame || selectedLoader) ? (
        <Card 
          className={`transition-colors ${dragOver ? 'border-primary bg-primary/5' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {showConfigsFolder && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBackToRoot}
                      className="p-1 h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </Button>
                  )}
                  <CardTitle>
                    {showConfigsFolder 
                      ? 'Configs Folder' 
                      : `${selectedGame?.name || selectedLoader?.name || 'Unknown'} Files`}
                  </CardTitle>
                </div>
                <CardDescription>
                  {showConfigsFolder ? 'User settings and configurations' : `${filteredFiles.length} files`}
                  {dragOver && (
                    <span className="text-primary ml-2">• Drag files here to upload</span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllFiles}
                  disabled={filteredFiles.length === 0}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Select All
                </Button>
                <ConditionalRender permission="games.files_upload" fallback={null}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setUploadDialogOpen(true)}
                    disabled={!canUploadFiles}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                </ConditionalRender>
                {selectedGame && (
                  <MultiFileUploadDialog 
                    game={selectedGame}
                    onUploadComplete={loadGameFiles}
                  />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredFiles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No files found</h3>
                <p className="mb-4">Try changing your search query or upload some files.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredFiles.map((file) => (
                  <FileItemComponent
                    key={file.id}
                    file={file}
                    isSelected={selectedFiles.includes(file.id)}
                    canDownload={canDownloadFiles}
                    canDelete={canDeleteFiles}
                    onToggleSelection={toggleFileSelection}
                    onFolderClick={handleFolderClick}
                    onDownload={handleFileDownload}
                    onView={handleViewFile}
                    onDelete={handleFileDelete}
                    getFileIcon={getFileIcon}
                    formatFileSize={formatFileSize}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}


      {/* File Details Dialog */}
      <Dialog open={fileDetailsOpen} onOpenChange={setFileDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              File Information
            </DialogTitle>
            <DialogDescription>
              Detailed information about the selected file
            </DialogDescription>
          </DialogHeader>
          {selectedFile && (
            <div className="grid gap-6 py-4">
              <div className="flex items-center gap-3">
                {getFileIcon(selectedFile.name)}
                <div>
                  <div className="font-medium text-lg">{selectedFile.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedFile.category === 'config' && 'Configuration file'}
                    {selectedFile.category === 'resource' && 'Extra file'}
                    {selectedFile.category === 'logo' && 'Logo'}
                    {selectedFile.category === 'banner' && 'Banner'}
                    {selectedFile.category === 'loader' && 'Loader'}
                  </div>
                </div>
              </div>
              
              {selectedFile.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedFile.description}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">File ID</Label>
                  <div className="text-sm text-muted-foreground font-mono">
                    {selectedFile.id}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Size</Label>
                  <div className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="text-sm">
                    <Badge variant={selectedFile.status === 'active' ? 'default' : 'secondary'}>
                      {selectedFile.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Modified</Label>
                  <div className="text-sm text-muted-foreground">
                    {new Date(selectedFile.modified).toLocaleString()}
                  </div>
                </div>
              </div>
              
              {selectedFile.version && (
                <div>
                  <Label className="text-sm font-medium">Version</Label>
                  <div className="text-sm text-muted-foreground">
                    v{selectedFile.version}
                  </div>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium">Last Modified</Label>
                <div className="text-sm text-muted-foreground">
                  {new Date(selectedFile.modified).toLocaleString('en-US')}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFileDetailsOpen(false)}>
              Close
            </Button>
            {selectedFile && (
              <ConditionalRender permission="games.files_download" fallback={null}>
                <Button onClick={() => {
                  setFileDetailsOpen(false);
                  handleFileDownload(selectedFile);
                }} disabled={!canDownloadFiles}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </ConditionalRender>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudUpload className="w-5 h-5 text-primary" />
              Upload File
            </DialogTitle>
            <DialogDescription>
              {selectedGame || selectedLoader
                ? `Upload a file for ${selectedGame?.name || selectedLoader?.name || 'the selected item'}${showConfigsFolder ? ' to the configs folder' : ''}`
                : 'Select an application or loader to upload a file'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">File to upload</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <CloudUpload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop a file here or click to select
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setUploadForm(prev => ({ ...prev, name: file.name }));
                    }
                  }}
                />
              </div>
            </div>
            
            {!showConfigsFolder && (
              <div className="grid gap-2">
                <Label htmlFor="upload-category">File type</Label>
                <Select 
                  value={uploadForm.category} 
                  onValueChange={(value: 'config' | 'resource') => 
                    setUploadForm(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <ConditionalRender permission="games.files_manage_configs" fallback={null}>
                      <SelectItem value="config">Configuration</SelectItem>
                    </ConditionalRender>
                    <ConditionalRender permission="games.files_manage_resources" fallback={null}>
                      <SelectItem value="resource">Resource</SelectItem>
                    </ConditionalRender>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {showConfigsFolder && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Files will be uploaded to the <strong>configs</strong> folder for user settings
                </p>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="upload-name">Name (optional)</Label>
              <Input
                id="upload-name"
                placeholder="Leave empty to use the original file name"
                value={uploadForm.name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="upload-description">Description</Label>
              <Textarea
                id="upload-description"
                placeholder="File description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            {!showConfigsFolder && uploadForm.category === 'config' && (
              <ConditionalRender permission="games.files_manage_configs" fallback={null}>
                <div className="grid gap-2">
                  <Label htmlFor="upload-version">Version</Label>
                  <Input
                    id="upload-version"
                    placeholder="1.0.0"
                    value={uploadForm.version}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, version: e.target.value }))}
                  />
                </div>
              </ConditionalRender>
            )}
            
            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-2xl h-2">
                  <div 
                    className="bg-primary h-2 rounded-2xl transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadDialogOpen(false);
              resetUploadForm();
            }} disabled={uploading}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                const file = fileInputRef.current?.files?.[0];
                if (file) {
                  handleFileUpload(file);
                } else {
                  toast.error('Select a file to upload');
                }
              }}
              disabled={uploading || (!selectedGame && !selectedLoader)}
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  Uploading...
                </div>
              ) : (
                'Upload'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileManager;