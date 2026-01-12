"use client"

import * as React from "react"
import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Bot,
  Box,
  Cloud,
  Database,
  FileText,
  Folder,
  HardDrive,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  Package,
  Search,
  Server,
  Settings2,
  Trash2,
  Upload,
  RefreshCw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from '@/lib/utils.ts'
import { useFileManagerLogic } from "./hooks/use-file-manager-logic"
import { getProductFiles, getStorageInfo } from "@/entities/file/api/file"
import type { FileItem } from "@/entities/file"
import { formatFileSize } from "@/features/file-manager/utils/file-utils"
import { Spinner } from "@/components/ui/spinner"
import { AccessDenied } from "@/shared/ui/components"
import { useAuthContext } from "@/app/providers/auth-provider"
import { usePermissions } from "@/shared/hooks/use-permissions"
import { hasManagementAccess } from "@/shared/lib/rbac"
import { FileUploadDialog } from "./components"

// --- Types ---

type Scope = "agent" | "product"
type ViewMode = "list" | "grid"

// --- Utilities ---

const getFileIcon = (category: FileItem['category'], size: "sm" | "lg" = "sm") => {
  const baseClass = size === "sm" ? "size-4" : "size-6"
  switch (category) {
    case "folder":
      return <Folder className={cn(baseClass, "text-amber-500 fill-amber-500/20")} />
    case "logo":
    case "banner":
      return <ImageIcon className={cn(baseClass, "text-emerald-500")} />
    case "config":
      return <Settings2 className={cn(baseClass, "text-slate-500")} />
    case "resource":
    case "other":
      return <FileText className={cn(baseClass, "text-blue-500")} />
    default:
      return <FileText className={cn(baseClass, "text-blue-500")} />
  }
}

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateString
  }
}

export default function FileManager() {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const { hasPermission } = usePermissions()
  
  const {
    products,
    agents,
    selectedProduct,
    selectedAgent,
    files,
    loading,
    refreshing,
    targetType,
    setTargetType,
    setSelectedProduct,
    setSelectedAgent,
    displayItems,
    fileSelection,
    fileDialogs,
    fileUpload,
    handleFileDownload,
    handleFileDelete,
    loadProductFiles,
  } = useFileManagerLogic()

  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [storageInfo, setStorageInfo] = useState<{
    usage_percent: number
    storage_limit_human: string | null
    available_space_human: string | null
  } | null>(null)
  const [loadingStorage, setLoadingStorage] = useState(false)
  const [currentPath, setCurrentPath] = useState<string[]>(["Root"])
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  
  // Determine if we're in configs folder based on currentPath
  const isInConfigFolder = useMemo(() => {
    return currentPath.length === 2 && currentPath[0] === "Root" && currentPath[1] === "config"
  }, [currentPath])

  // Check permissions
  const managementAccess = hasManagementAccess(user)
  const canViewFiles = managementAccess.canViewFiles || hasPermission('files.view') || hasPermission('products.upload_files')
  const canUploadFiles = hasPermission('products.files_upload') || hasPermission('products.upload_files')

  if (!isInitialized) {
    return null
  }

  if (!isAuthenticated || !user) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={user}
        message="You need to be logged in to access the file manager."
        useCard={true}
      />
    )
  }

  if (!canViewFiles) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        user={user}
        message="You don't have permission to access the file manager."
        useCard={true}
      />
    )
  }

  // Load storage info
  useEffect(() => {
    const loadStorageInfo = async () => {
      try {
        setLoadingStorage(true)
        const info = await getStorageInfo()
        setStorageInfo({
          usage_percent: info.usage_percent || 0,
          storage_limit_human: info.storage_limit_human,
          available_space_human: info.available_space_human,
        })
      } catch (error) {
        console.error('Failed to load storage info:', error)
      } finally {
        setLoadingStorage(false)
      }
    }

    loadStorageInfo()
    const interval = setInterval(loadStorageInfo, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  // Filter files by search query and ensure config folder is always shown
  const filteredFiles = useMemo(() => {
    let result: FileItem[] = []
    
    const isInRoot = currentPath.length === 1 && currentPath[0] === "Root"
    const isInConfigFolder = currentPath.length === 2 && currentPath[0] === "Root" && currentPath[1] === "config"
    
    // Always add config folder first if we're in root
    if (isInRoot) {
      const configFolder: FileItem = {
        id: "config_folder",
        name: "config",
        type: "folder",
        size: 0,
        path: "/config",
        modified: new Date().toISOString(),
        status: "active",
        category: "folder",
      }
      result.push(configFolder)
    }

    // Add actual files
    const searchLower = searchQuery.toLowerCase()
    const matchingFiles = files.filter((file) => {
      if (searchQuery && !file.name.toLowerCase().includes(searchLower)) {
        return false
      }
      
      // Filter by current path - if we're in config folder, only show config files
      if (isInConfigFolder) {
        return file.category === "config"
      }
      
      // If we're in root, show all files except config files (they're in the config folder)
      if (isInRoot) {
        return file.category !== "config"
      }
      
      return true
    })

    result = [...result, ...matchingFiles]
    
    // Sort: folders first, then by name
    return result.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1
      if (a.type !== "folder" && b.type === "folder") return 1
      return a.name.localeCompare(b.name)
    })
  }, [files, searchQuery, currentPath])

  const selectedItem = useMemo(() => {
    if (targetType === "agent" && selectedAgent) {
      return selectedAgent
    }
    if (targetType === "product" && selectedProduct) {
      return selectedProduct
    }
    return null
  }, [targetType, selectedAgent, selectedProduct])

  const selectedName = useMemo(() => {
    if (selectedItem) {
      return selectedItem.name || "Unknown"
    }
    return "Select"
  }, [selectedItem])

  const handleFolderClick = useCallback((file: FileItem) => {
    if (file.type === "folder") {
      if (file.name === "config") {
        setCurrentPath(["Root", "config"])
        // Reload files with config category filter
        if (selectedProduct?.id || selectedAgent?.id) {
          loadProductFiles()
        }
      } else {
        // Navigate into folder
        setCurrentPath([...currentPath, file.name])
      }
    }
  }, [currentPath, selectedProduct, selectedAgent, loadProductFiles])
  
  const handleFileClick = useCallback((file: FileItem, event: React.MouseEvent) => {
    // Для файлов открываем dropdown меню
    if (file.type !== "folder") {
      event.stopPropagation()
      setOpenDropdownId(file.id)
    }
  }, [])

  const handleBackClick = useCallback(() => {
    if (currentPath.length > 1) {
      setCurrentPath(currentPath.slice(0, -1))
    } else {
      setCurrentPath(["Root"])
    }
  }, [currentPath])

  const handleItemClick = useCallback((item: { type: 'product' | 'agent', item: any }) => {
    if (item.type === 'product') {
      setSelectedProduct(item.item)
      setSelectedAgent(null)
    } else {
      setSelectedAgent(item.item)
      setSelectedProduct(null)
    }
    setCurrentPath(["Root"])
  }, [setSelectedProduct, setSelectedAgent])

  return (
    <div className="flex flex-col gap-4 w-full h-[550px]">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 h-full">
        {/* --- Sidebar --- */}
        <div className="flex flex-col h-full border rounded-lg bg-background shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2.5 border-b bg-muted/30">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Explorer
              </span>
            </div>
            <Tabs
              value={targetType}
              onValueChange={(v) => setTargetType(v as "agent" | "product")}
              className="w-full"
            >
              <TabsList className="h-8 w-full p-0.5 bg-muted/50 grid grid-cols-2">
                <TabsTrigger
                  value="agent"
                  className="h-7 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5"
                >
                  <Bot className="size-3" />
                  <span>Agents</span>
                </TabsTrigger>
                <TabsTrigger
                  value="product"
                  className="h-7 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5"
                >
                  <Box className="size-3" />
                  <span>Products</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Context Items */}
              <div className="space-y-0.5 mb-3">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {targetType === "agent" ? "Active Agents" : "Products"}
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="size-4" />
                  </div>
                ) : displayItems.length === 0 ? (
                  <div className="px-2.5 py-2 text-[10px] text-muted-foreground">
                    No {targetType === "agent" ? "agents" : "products"} available
                  </div>
                ) : (
                  displayItems.map((item) => {
                    const isSelected = 
                      (item.type === 'product' && selectedProduct?.id === item.item.id) ||
                      (item.type === 'agent' && selectedAgent?.id === item.item.id)
                    
                    return (
                      <Button
                        key={`${item.type}-${item.item.id}`}
                        variant={isSelected ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "w-full justify-start h-8 text-xs px-2.5 font-normal rounded-md",
                          isSelected 
                            ? "bg-secondary font-medium shadow-sm" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => handleItemClick(item)}
                      >
                        {item.type === "agent" ? (
                          <Bot className={cn(
                            "size-3.5 mr-2",
                            isSelected ? "text-foreground" : "text-muted-foreground"
                          )} />
                        ) : (
                          <Box className={cn(
                            "size-3.5 mr-2",
                            isSelected ? "text-foreground" : "text-muted-foreground"
                          )} />
                        )}
                        <span className="truncate">{item.item.name}</span>
                      </Button>
                    )
                  })
                )}
              </div>

              <Separator className="my-2" />

              {/* Places */}
              <div className="space-y-0.5">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Locations
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs px-2.5 font-normal rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  onClick={() => setCurrentPath(["Root", "config"])}
                >
                  <HardDrive className="size-3.5 mr-2" />
                  <span>config</span>
                </Button>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t bg-muted/20">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Server className="size-3 text-muted-foreground" />
                  <span>Storage</span>
                </span>
                {loadingStorage ? (
                  <Spinner className="size-3" />
                ) : storageInfo ? (
                  <span className="text-muted-foreground">{Math.round(storageInfo.usage_percent)}% used</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
              <Progress 
                value={storageInfo?.usage_percent || 0} 
                className="h-1.5" 
              />
            </div>
          </div>
        </div>

        {/* --- Main Content --- */}
        <div className="flex flex-col h-full min-w-0 border rounded-lg bg-background shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background h-[52px] shrink-0">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {selectedName}
              </div>
              <div className="flex items-center text-[10px] text-muted-foreground">
                <Home className="size-3 mr-1" />
                {currentPath.map((segment, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span className="mx-1">/</span>}
                    <span 
                      className={cn(
                        index === currentPath.length - 1 ? "text-foreground font-medium" : "",
                        index < currentPath.length - 1 ? "cursor-pointer hover:text-foreground" : ""
                      )}
                      onClick={index < currentPath.length - 1 ? handleBackClick : undefined}
                    >
                      {segment}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  className="h-7 w-[180px] text-xs pl-7 bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Separator orientation="vertical" className="h-4" />
              <Tabs
                value={viewMode}
                onValueChange={(v) => setViewMode(v as ViewMode)}
                className="w-auto"
              >
                <TabsList className="h-7 p-0.5 bg-muted/50">
                  <TabsTrigger
                    value="list"
                    className="h-6 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <ListIcon className="size-3.5" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="grid"
                    className="h-6 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <LayoutGrid className="size-3.5" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={loadProductFiles}
                disabled={refreshing || !selectedItem}
                className="h-7 w-7"
              >
                {refreshing ? (
                  <Spinner className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button 
                size="sm" 
                className="h-7 text-xs px-2.5 ml-1"
                onClick={() => fileDialogs.openUploadDialog()}
              >
                <Upload className="size-3 mr-1.5" /> Upload
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-muted/5">
            {refreshing ? (
              <div className="flex items-center justify-center h-full">
                <Spinner className="size-6" />
              </div>
            ) : !selectedItem ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Select a {targetType === "agent" ? "agent" : "product"} to view files
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No files found
              </div>
            ) : viewMode === "list" ? (
              <Table>
                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                  <TableRow className="h-9 hover:bg-transparent border-b-muted-foreground/10">
                    <TableHead className="w-[40%] text-xs font-medium pl-4">Name</TableHead>
                    <TableHead className="text-xs font-medium">Date Modified</TableHead>
                    <TableHead className="text-xs font-medium">Type</TableHead>
                    <TableHead className="text-xs font-medium text-right pr-4">Size</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFiles.map((file) => (
                    <TableRow
                      key={file.id}
                      className="group h-9 border-b-muted-foreground/5 hover:bg-background hover:shadow-sm transition-all cursor-pointer"
                      onClick={(e) => handleFileClick(file, e)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (file.type === "folder") {
                          handleFolderClick(file)
                        }
                      }}
                    >
                      <TableCell className="py-2 pl-4">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(file.category)}
                          <span className="text-xs font-medium text-foreground">
                            {file.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {formatDate(file.modified)}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground bg-muted/50 border-muted-foreground/10"
                        >
                          {file.type === "folder" ? "Folder" : file.category || "File"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-right font-mono text-muted-foreground pr-4">
                        {file.type === "folder" ? "-" : formatFileSize(file.size)}
                      </TableCell>
                      <TableCell className="py-2 text-right pr-2">
                        <DropdownMenu open={openDropdownId === file.id} onOpenChange={(open) => setOpenDropdownId(open ? file.id : null)}>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="size-3.5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {file.type !== "folder" && (
                              <DropdownMenuItem 
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFileDownload(file)
                                }}
                              >
                                Download
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-xs text-red-600"
                              onClick={async (e) => {
                                e.stopPropagation()
                                setOpenDropdownId(null)
                                await handleFileDelete(file)
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredFiles.map((file) => (
                  <Card
                    key={file.id}
                    className="group border-muted-foreground/10 shadow-sm hover:shadow-md transition-all cursor-pointer bg-background relative"
                    onClick={(e) => handleFileClick(file, e)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      if (file.type === "folder") {
                        handleFolderClick(file)
                      }
                    }}
                  >
                    <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu open={openDropdownId === file.id} onOpenChange={(open) => setOpenDropdownId(open ? file.id : null)}>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                            >
                              <MoreVertical className="size-3.5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            {file.type !== "folder" && (
                              <DropdownMenuItem 
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleFileDownload(file)
                                }}
                              >
                                Download
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-xs text-red-600"
                              onClick={async (e) => {
                                e.stopPropagation()
                                setOpenDropdownId(null)
                                await handleFileDelete(file)
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="size-12 rounded-lg bg-muted/30 flex items-center justify-center mb-1 group-hover:bg-muted/50 transition-colors">
                        {getFileIcon(file.category, "lg")}
                      </div>
                      <div className="space-y-0.5 w-full">
                        <p className="text-xs font-medium truncate w-full" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {file.type === "folder" ? "Folder" : formatFileSize(file.size)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-8 border-t bg-background flex items-center justify-between px-4 text-[10px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-4">
              <span>{filteredFiles.length} items</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{fileSelection.selectedFiles.length} selected</span>
            </div>
            {storageInfo && (
              <div className="flex items-center gap-2 text-[10px]">
                {storageInfo.storage_limit_human && (
                  <>
                    <span>{storageInfo.storage_limit_human} limit</span>
                    <Separator orientation="vertical" className="h-3" />
                  </>
                )}
                {storageInfo.available_space_human && (
                  <span>{storageInfo.available_space_human} available</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File Upload Dialog */}
      <FileUploadDialog
        open={fileDialogs.uploadDialogOpen}
        onOpenChange={fileDialogs.setUploadDialogOpen}
        selectedProduct={selectedProduct}
        selectedAgent={selectedAgent}
        showConfigsFolder={isInConfigFolder}
        canUploadFiles={canUploadFiles}
        uploadForm={fileUpload.uploadForm}
        uploading={fileUpload.uploading}
        uploadProgress={fileUpload.uploadProgress}
        dragOver={fileUpload.dragOver}
        fileInputRef={fileUpload.fileInputRef}
        onUploadFormChange={fileUpload.setUploadForm}
        onDragOver={fileUpload.handleDragOver}
        onDragLeave={fileUpload.handleDragLeave}
        onDrop={(e) => fileUpload.handleDrop(e, (file) => fileUpload.handleFileSelect(file))}
        onFileSelect={fileUpload.handleFileSelect}
        onUpload={() => {
          const fileFromInput = fileUpload.fileInputRef.current?.files?.[0];
          return fileUpload.handleFileUpload(fileFromInput);
        }}
        onResetForm={fileUpload.resetUploadForm}
      />
    </div>
  )
}
