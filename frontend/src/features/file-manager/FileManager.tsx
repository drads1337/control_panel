import React from 'react';
import { 
  Rocket, 
  Puzzle, 
  Code, 
  Plus, 
  Folder, 
  FileText, 
  Lock, 
  Info, 
  RefreshCw, 
  Upload, 
  LayoutGrid,
  Download,
  Trash2
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/shared/ui/components/card';
import { Button } from '@/shared/ui/components/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui/components/table';
import { Badge } from '@/shared/ui/components/badge';
import { useFileManagerLogic } from '@/features/file-manager/hooks/use-file-manager-logic';
import type { FileItem } from '@/entities/file';
import type { Product } from '@/entities/product';
import type { Agent } from '@/entities/agent';

// --- Helper Functions ---

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  } catch {
    return dateString;
  }
};

const getFileIcon = (file: FileItem) => {
  if (file.type === 'folder') {
    return <Folder className="h-4 w-4 text-yellow-500/80" fill="currentColor" />;
  }
  
  switch (file.category) {
    case 'config':
      return <FileText className="h-4 w-4 text-blue-400/80" />;
    case 'logo':
    case 'banner':
      return <FileText className="h-4 w-4 text-purple-400/80" />;
    case 'agent':
      return <Rocket className="h-4 w-4 text-green-400/80" />;
    case 'resource':
      return <FileText className="h-4 w-4 text-indigo-400/80" />;
    default:
      return <FileText className="h-4 w-4 text-gray-400/80" />;
  }
};

const getProjectIcon = (item: Product | Agent) => {
  if ('is_multi_app' in item && item.is_multi_app) {
    return <Puzzle className="h-4 w-4" />;
  }
  return <Rocket className="h-4 w-4" />;
};

// --- Sub-Components ---

const ProjectItem: React.FC<{ 
  item: Product | Agent;
  type: 'product' | 'agent';
  isActive: boolean; 
  onClick: () => void 
}> = ({ item, type, isActive, onClick }) => (
  <div 
    onClick={onClick}
    className={`
      px-2 py-2 rounded-sm transition-all cursor-pointer group flex items-center gap-2.5 mb-0.5
      ${isActive 
        ? 'bg-surface-dark border border-border-dark text-text-primary-dark shadow-sm' 
        : 'border border-transparent hover:bg-white/5 text-text-secondary-dark'}
    `}
  >
    <div className={`transition-opacity ${isActive ? 'text-primary' : 'opacity-70 group-hover:opacity-100'}`}>
      {getProjectIcon(item)}
    </div>
    <div className="flex-1 min-w-0 flex flex-col">
      <span className={`text-[11px] font-medium truncate leading-tight ${isActive ? 'text-text-primary-dark' : 'text-text-secondary-dark'}`}>
        {item.name}
      </span>
      <div className="flex items-center gap-1.5 opacity-60">
        <span className="text-[9px] font-mono">#{item.id}</span>
      </div>
    </div>
    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"></div>}
  </div>
);

const FileRow: React.FC<{ 
  file: FileItem;
  isSelected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
}> = ({ file, isSelected, onSelect, onDownload, onDelete }) => (
  <TableRow 
    className={`hover:bg-white/5 border-b border-transparent hover:border-border-dark/30 cursor-pointer group transition-colors ${isSelected ? 'bg-white/10' : ''}`}
    onClick={onSelect}
  >
    <TableCell className="px-4 py-1.5">
      <div className="flex items-center gap-2.5">
        {getFileIcon(file)}
        <span className={`${file.type === 'folder' ? 'text-text-primary-dark font-medium' : 'text-text-secondary-dark group-hover:text-text-primary-dark'} transition-colors`}>
          {file.name}
        </span>
        {file.category && file.category !== 'folder' && (
          <Badge variant="outline" className="px-1 py-0 text-[9px] border-border-dark bg-background-dark text-text-secondary-dark">
            {file.category}
          </Badge>
        )}
      </div>
    </TableCell>
    <TableCell className="px-4 py-1.5 text-right text-text-secondary-dark opacity-60 font-mono text-[10px]">
      {file.type === 'folder' ? '--' : formatFileSize(file.size)}
    </TableCell>
    <TableCell className="px-4 py-1.5 text-right text-text-secondary-dark opacity-60 font-mono text-[10px]">
      {formatDate(file.modified)}
    </TableCell>
    <TableCell className="px-4 py-1.5 text-right">
      <div className="flex items-center justify-end gap-1">
        {file.type === 'file' && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-text-secondary-dark hover:text-primary hover:bg-white/5"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-text-secondary-dark hover:text-destructive hover:bg-white/5"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </TableCell>
  </TableRow>
);

// --- Main Component ---

export const FileManager: React.FC = () => {
  const {
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
    displayItems,
    hasItems,
    stats,
    fileSelection,
    fileDialogs,
    fileFilters,
    fileUpload,
    setSelectedProduct,
    setSelectedAgent,
    setTargetType,
    loadProductFiles,
    refreshData,
    handleRefreshProducts,
    handleFileDownload,
    handleFileDelete,
    handleBulkDownload,
    handleBulkDelete,
    handleFolderClick,
    handleBackToRoot,
  } = useFileManagerLogic();

  const activeItem = selectedProduct || selectedAgent;
  const activeItemType = selectedProduct ? 'product' : 'agent';

  const handleProjectClick = (item: Product | Agent, type: 'product' | 'agent') => {
    if (type === 'product') {
      setSelectedProduct(item as Product);
      setSelectedAgent(null);
    } else {
      setSelectedAgent(item as Agent);
      setSelectedProduct(null);
    }
  };

  const handleFileRowClick = (file: FileItem) => {
    if (file.type === 'folder') {
      handleFolderClick(file.name);
    } else {
      fileSelection.toggleFileSelection(file.id);
    }
  };

  const breadcrumbs = showConfigsFolder 
    ? ['ROOT', 'PRODUCTS', activeItem?.name.toUpperCase() || 'UNKNOWN', 'CONFIGS']
    : ['ROOT', 'PRODUCTS', activeItem?.name.toUpperCase() || 'UNKNOWN'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[480px] font-sans">
      {/* Left Column: Projects List */}
      <Card className="lg:col-span-3 flex flex-col h-full bg-background-dark border-border-dark rounded-md overflow-hidden p-0 shadow-lg">
        <CardHeader className="px-3 py-2 flex flex-row items-center justify-between border-b border-border-dark shrink-0">
          <h3 className="text-[10px] font-bold text-text-secondary-dark uppercase tracking-widest">Projects</h3>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-5 w-5 text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/10 transition-colors"
              onClick={handleRefreshProducts}
              disabled={isLoadingProducts}
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-1.5 custom-scrollbar">
          {loading && !hasItems ? (
            <div className="py-4 text-center text-text-secondary-dark text-xs">
              Loading projects...
            </div>
          ) : !hasItems ? (
            <div className="py-4 text-center text-text-secondary-dark text-xs">
              No projects available
            </div>
          ) : (
            displayItems.map(({ type, item }) => (
              <ProjectItem 
                key={`${type}-${item.id}`}
                item={item}
                type={type}
                isActive={
                  (type === 'product' && selectedProduct?.id === item.id) ||
                  (type === 'agent' && selectedAgent?.id === item.id)
                }
                onClick={() => handleProjectClick(item, type)}
              />
            ))
          )}
        </CardContent>
        
        <CardFooter className="px-3 py-1.5 border-t border-border-dark flex justify-between items-center text-[9px] font-mono text-text-secondary-dark uppercase opacity-60 shrink-0 bg-surface-dark/10">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-500/50' : 'bg-emerald-500/50'} ${loading ? '' : 'animate-pulse'}`}></span>
            {loading ? 'Loading' : 'Online'}
          </span>
          <span>{stats.total} items</span>
        </CardFooter>
      </Card>

      {/* Right Column: File Explorer */}
      <Card className="lg:col-span-9 flex flex-col h-full bg-surface-dark/10 border-border-dark rounded-md overflow-hidden p-0 shadow-lg">
        {/* Toolbar */}
        <CardHeader className="px-3 py-1.5 flex flex-row items-center justify-between border-b border-border-dark bg-surface-dark/5 shrink-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-secondary-dark">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="opacity-40">/</span>}
                <span 
                  className={index === breadcrumbs.length - 1 
                    ? 'text-primary font-bold uppercase' 
                    : 'hover:text-text-primary-dark cursor-pointer transition-colors'}
                  onClick={index === breadcrumbs.length - 1 && showConfigsFolder ? handleBackToRoot : undefined}
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6 text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 transition-colors"
              onClick={refreshData}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {fileSelection.selectedFiles.length > 0 && (
              <>
                <Button 
                  variant="outline"
                  size="sm"
                  className="bg-white/5 hover:bg-white/10 border-border-dark text-text-primary-dark px-2 h-6 rounded text-[9px] font-bold tracking-wide transition-colors"
                  onClick={handleBulkDownload}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  DOWNLOAD ({fileSelection.selectedFiles.length})
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  className="bg-white/5 hover:bg-white/10 border-border-dark text-destructive px-2 h-6 rounded text-[9px] font-bold tracking-wide transition-colors"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  DELETE ({fileSelection.selectedFiles.length})
                </Button>
              </>
            )}
            <Button 
              variant="outline"
              size="sm"
              className="bg-white/5 hover:bg-white/10 border-border-dark text-text-primary-dark px-2 h-6 rounded text-[9px] font-bold tracking-wide transition-colors"
              onClick={fileDialogs.openUploadDialog}
              disabled={!activeItem}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              UPLOAD
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col p-0 bg-background-dark/50">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading && files.length === 0 ? (
              <div className="py-8 text-center text-text-secondary-dark text-xs">
                Loading files...
              </div>
            ) : !activeItem ? (
              <div className="py-8 text-center text-text-secondary-dark text-xs">
                Select a project to view files
              </div>
            ) : files.length === 0 ? (
              <div className="py-8 text-center text-text-secondary-dark text-xs">
                No files found
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-surface-dark/90 backdrop-blur-sm z-10 shadow-sm">
                  <TableRow className="border-b border-border-dark hover:bg-transparent">
                    <TableHead className="px-4 py-2 h-auto text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest w-[50%]">Name</TableHead>
                    <TableHead className="px-4 py-2 h-auto text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Size</TableHead>
                    <TableHead className="px-4 py-2 h-auto text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Date</TableHead>
                    <TableHead className="px-4 py-2 h-auto text-[9px] font-bold text-text-secondary-dark uppercase tracking-widest text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="font-mono text-[11px]">
                  {files.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      isSelected={fileSelection.selectedFiles.includes(file.id)}
                      onSelect={() => handleFileRowClick(file)}
                      onDownload={() => handleFileDownload(file)}
                      onDelete={() => handleFileDelete(file)}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>

        <CardFooter className="px-3 py-1.5 border-t border-border-dark flex justify-between items-center bg-surface-dark/30 shrink-0">
          <div className="text-[9px] font-mono text-text-secondary-dark uppercase tracking-wider">
            {stats.total} Items • {stats.files} Files • {stats.folders} Folders
            {fileSelection.selectedFiles.length > 0 && ` • ${fileSelection.selectedFiles.length} Selected`}
          </div>
          <div className="flex items-center gap-2 opacity-60">
            <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
              <LayoutGrid className="h-3.5 w-3.5 text-text-secondary-dark hover:text-primary transition-colors" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
