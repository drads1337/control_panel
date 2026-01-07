"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  CopyIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  Trash2Icon,
  RotateCcwIcon,
  PlayCircleIcon,
  PencilIcon,
  FileTextIcon,
  ShieldBanIcon,
  PauseCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Package,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { KEY_STATUS } from '@/shared/constants/key-status'
import { LoadingState } from './components'
import { EmptyState } from '@/shared/ui/components'
import { isMaskedKey } from '@/shared/lib/key-masking'
import { revealLicenseKey } from '@/entities/key'
import { toast } from 'sonner'

// Types (Mocked for context)
import type { StatusType } from '@/lib/status-utils'
import { getStatusClasses, getStatusText } from '@/lib/status-utils'
import { cn } from '@/lib/utils'
import type { LicenseKey } from '@/entities/key'

interface LicenseKeysListProps {
  keys: LicenseKey[]
  loading: boolean
  showKey: Record<number, boolean>
  fullKeys: Record<number, string>
  selectedKeys: Set<number>
  actionLoading: Set<number>
  pagination: {
    page: number
    perPage: number
    total: number
    pages: number
  }
  onToggleKeyVisibility: (keyId: number) => void
  onSelectKey: (keyId: number, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onKeyAction: (action: string, keyId: number) => void
  onViewDetails: (key: LicenseKey) => void
  onPageChange: (page: number) => void
  canEdit?: boolean
  canDelete?: boolean
  canReset?: boolean
  canPauseResume?: boolean
  canBlock?: boolean
  canManage?: boolean
  currentUserId?: number
}

const LicenseKeysList: React.FC<LicenseKeysListProps> = ({
  keys,
  loading,
  showKey,
  fullKeys,
  selectedKeys,
  actionLoading,
  pagination,
  onToggleKeyVisibility,
  onSelectKey,
  onSelectAll,
  onKeyAction,
  onViewDetails,
  onPageChange,
  canEdit = false,
  canDelete = false,
  canReset = false,
  canPauseResume = false,
  canBlock = false,
  canManage = false,
  currentUserId
}) => {
  
  // --- Helpers ---
  const isOwnKey = React.useCallback((key: LicenseKey) => {
    return key.user_id === currentUserId
  }, [currentUserId])

  const getStatusType = React.useCallback((status: number, is_expired?: boolean, activated_at?: string | null): StatusType => {
    if (status === KEY_STATUS.BLOCKED) return 'inactive'
    // If key is not activated, show "Not activated"
    if (!activated_at) return 'not_activated'
    // Only check expiration if key was activated
    if (status === KEY_STATUS.ACTIVE && is_expired) return 'expired'
    switch (status) {
      case KEY_STATUS.BLOCKED: return 'inactive'
      case KEY_STATUS.ACTIVE: return 'active'
      case KEY_STATUS.PAUSED: return 'inactive'
      default: return 'inactive'
    }
  }, [])

  // --- React Table State ---
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  
  const rowSelection = React.useMemo(() => {
    const selection: Record<string, boolean> = {}
    selectedKeys.forEach(id => { selection[id] = true })
    return selection
  }, [selectedKeys])

  // --- Columns Definition ---
  const columns = React.useMemo<ColumnDef<LicenseKey>[]>(() => [
    {
      accessorKey: "key",
      header: "License Key",
      cell: ({ row }) => {
        const key = row.original
        const isVisible = showKey[key.id]
        const fullKey = fullKeys[key.id] // Используем только явно загруженный полный ключ
        
        // Всегда показываем начало ключа (первые 8-12 символов)
        let displayKey: string
        if (isVisible && fullKey) {
          // Если ключ открыт, показываем полный ключ
          displayKey = fullKey
        } else {
          // Если ключ скрыт, показываем начало + маскировку
          const originalKey = key.key || ""
          const isKeyMasked = isMaskedKey(originalKey)
          
          // Если key.key уже маскирован, используем его как есть
          if (isKeyMasked) {
            displayKey = originalKey
          } else {
            // Если key.key - полный ключ, берем префикс и маскируем
            const keyPrefix = (key as any).key_prefix || 
                             (originalKey.length > 12 ? originalKey.substring(0, 12) : originalKey) ||
                             "****"
            displayKey = keyPrefix && !keyPrefix.includes('****') && !keyPrefix.includes('*')
              ? `${keyPrefix}******` 
              : (keyPrefix || "****")
          }
        }
        
        return (
          <div className="font-mono text-xs font-medium text-foreground/90">
            <span className="truncate max-w-[180px] block" title={isVisible && fullKey ? fullKey : "Hidden"}>
              {displayKey}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: "product",
      header: "Product",
      cell: ({ row }) => (
        <span className="font-medium text-xs truncate max-w-[120px] block">
            {row.original.product_name || "Unknown"}
        </span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const key = row.original
        const typeLabel = key.is_access_code ? 'Access Code' : (key.generation_type === 'access_code' ? 'Access Code' : 'License Key')
        return (
          <Badge variant="secondary" className="text-muted-foreground px-1.5 text-[10px] h-5 font-normal bg-muted/50 border-muted-foreground/10">
            {typeLabel}
          </Badge>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const statusType = getStatusType(row.original.status, row.original.is_expired, row.original.activated_at)
        
        // Handle special cases that don't map directly to status types
        if (row.original.status === KEY_STATUS.BLOCKED) {
          return (
            <span className={cn(getStatusClasses('inactive'), "rounded-none")}>
              Blocked
            </span>
          )
        } else if (row.original.status === KEY_STATUS.PAUSED) {
          return (
            <span className={cn(getStatusClasses('inactive'), "rounded-none")}>
              Paused
            </span>
          )
        }

        return (
          <span className={cn(getStatusClasses(statusType), "rounded-none")}>
            {getStatusText(statusType)}
          </span>
        )
      },
    },
    {
      accessorKey: "devices",
      header: "Devices",
      cell: ({ row }) => (
         <span className="text-xs text-muted-foreground font-mono">
            {row.original.device_count || 0}/{row.original.max_devices}
         </span>
      ),
    },
    {
      accessorKey: "created_by",
      header: "Created By",
      cell: ({ row }) => (
         <div className="text-xs">
            {isOwnKey(row.original) ? (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-muted/50 border-muted-foreground/10">You</Badge>
            ) : (
                <span className="text-muted-foreground">{row.original.creator_username || "System"}</span>
            )}
         </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right pr-2">Actions</div>,
      cell: ({ row }) => {
        const key = row.original
        const isActionLoading = actionLoading.has(key.id)
        const canPerformActions = canManage || isOwnKey(key)
        const isVisible = showKey[key.id]
        
        return (
          <div className="flex justify-end items-center gap-0.5 pr-1">
            {isActionLoading && (
              <RefreshCwIcon className="size-3.5 animate-spin text-muted-foreground mr-1" />
            )}
            
            {/* === Show/Hide Button === */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/50"
                    onClick={() => onToggleKeyVisibility(key.id)}
                    disabled={isActionLoading}
                  >
                    {isVisible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isVisible ? "Hide key" : "Show full key"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* === Copy Button === */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/50"
                    onClick={async () => {
                      try {
                        let fullKey: string;
                        
                        // Если ключ уже загружен и не замаскирован, используем его
                        if (fullKeys[key.id] && !isMaskedKey(fullKeys[key.id])) {
                          fullKey = fullKeys[key.id];
                        } else {
                          // Получаем полный ключ через API
                          const revealResponse = await revealLicenseKey(key.id);
                          fullKey = revealResponse.key;
                          
                          if (isMaskedKey(fullKey) || revealResponse.key_masked) {
                            toast.error('You do not have permission to copy full keys.');
                            return;
                          }
                        }
                        
                        // Копируем ключ
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                          await navigator.clipboard.writeText(fullKey);
                        } else {
                          // Fallback to execCommand for older browsers
                          const textArea = document.createElement('textarea');
                          textArea.value = fullKey;
                          textArea.style.position = 'fixed';
                          textArea.style.left = '-999999px';
                          textArea.style.top = '-999999px';
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          document.execCommand('copy');
                          textArea.remove();
                        }
                        
                        toast.success('Key copied to clipboard');
                      } catch (err: unknown) {
                        console.error('Failed to copy key:', err);
                        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                        if (errorMessage.includes('403') || errorMessage.includes('permission')) {
                          toast.error('You do not have permission to copy full keys.');
                        } else {
                          toast.error('Failed to copy key. Please try again.');
                        }
                      }
                    }}
                    disabled={isActionLoading}
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy key</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Divider for visual separation */}
            <div className="w-[1px] h-4 bg-muted-foreground/10 mx-1" />

            {/* === Details === */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/50"
                    onClick={() => onViewDetails(key)}
                    disabled={isActionLoading}
                  >
                    <FileTextIcon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {canPerformActions && (
              <>
                {canEdit && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/50"
                          onClick={() => onKeyAction('edit', key.id)}
                          disabled={isActionLoading}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit Key</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                
                {canReset && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/50"
                          onClick={() => onKeyAction('reset', key.id)}
                          disabled={isActionLoading}
                        >
                          <RotateCcwIcon className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reset HWID</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {canPauseResume && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted/50"
                          onClick={() => onKeyAction(key.status === KEY_STATUS.PAUSED ? 'resume' : 'pause', key.id)}
                          disabled={isActionLoading}
                        >
                          {key.status === KEY_STATUS.PAUSED ? (
                            <PlayCircleIcon className="size-4" />
                          ) : (
                            <PauseCircleIcon className="size-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{key.status === KEY_STATUS.PAUSED ? 'Resume' : 'Pause'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {canBlock && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${key.status === KEY_STATUS.BLOCKED ? 'text-green-600 hover:text-green-700 hover:bg-muted/50' : 'text-orange-500 hover:text-orange-600 hover:bg-muted/50'}`}
                          onClick={() => onKeyAction(key.status === KEY_STATUS.BLOCKED ? 'unblock' : 'block', key.id)}
                          disabled={isActionLoading}
                        >
                          {key.status === KEY_STATUS.BLOCKED ? (
                              <CheckCircle2Icon className="size-4" />
                          ) : (
                              <ShieldBanIcon className="size-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{key.status === KEY_STATUS.BLOCKED ? 'Unblock' : 'Block'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {canDelete && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onKeyAction('delete', key.id)}
                          disabled={isActionLoading}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </>
            )}
          </div>
        )
      },
    },
  ], [
    showKey, 
    fullKeys, 
    actionLoading, 
    onToggleKeyVisibility, 
    onSelectAll, 
    onSelectKey, 
    onKeyAction, 
    onViewDetails, 
    canManage, 
    canEdit, 
    canReset, 
    canPauseResume, 
    canBlock, 
    canDelete, 
    isOwnKey, 
    getStatusType
  ])

  // --- Table Instance ---
  const table = useReactTable({
    data: keys,
    columns,
    pageCount: pagination.pages,
    state: {
      columnVisibility,
      rowSelection,
      pagination: {
        pageIndex: pagination.page - 1,
        pageSize: pagination.perPage,
      },
    },
    enableRowSelection: true,
    manualPagination: true,
    onPaginationChange: (updater) => {
        if (typeof updater === 'function') {
            const newState = updater({
                pageIndex: pagination.page - 1,
                pageSize: pagination.perPage
            });
            onPageChange(newState.pageIndex + 1);
        } else {
             onPageChange(updater.pageIndex + 1);
        }
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id.toString(),
  })

  if (loading) return <LoadingState message="Loading keys..." />
  if (keys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <EmptyState
          title="No License Keys Found"
          description="Create your first license key to get started"
          icon={Package}
          iconStyle="dashed"
          useCard={true}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
             <span className="text-sm text-muted-foreground hidden sm:block">
                Manage your license keys
             </span>
        </div>
        <div className="flex items-center gap-2">
           {selectedKeys.size > 0 && (
                <Badge variant="secondary" className="h-7 text-xs bg-muted/50 border-muted-foreground/10">
                    {selectedKeys.size} selected
                </Badge>
           )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs ml-auto hover:bg-muted/50">
                <ChevronDownIcon className="size-3 mr-1" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs">
              {table
                .getAllColumns()
                .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-xs"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id === 'created_by' ? 'Created By' : column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="rounded-lg border bg-background shadow-sm">
        <Table>
          <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-9 hover:bg-transparent border-b-muted-foreground/10">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-xs h-9 font-medium text-muted-foreground">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="h-12 text-xs border-b-muted-foreground/5 hover:bg-background hover:shadow-sm transition-all"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-xs text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-muted-foreground hidden flex-1 text-xs lg:flex">
             Showing {((pagination.page - 1) * pagination.perPage) + 1} to {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total} keys
        </div>
        
        <div className="flex w-full items-center gap-6 lg:w-fit">
            <div className="flex w-fit items-center justify-center text-xs font-medium">
              Page {pagination.page} of {pagination.pages}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-7 w-7 p-0 lg:flex hover:bg-muted/50"
                onClick={() => onPageChange(1)}
                disabled={pagination.page === 1}
              >
                <ChevronsLeftIcon className="size-3" />
              </Button>
              <Button
                variant="outline"
                className="size-7 hover:bg-muted/50"
                size="icon"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeftIcon className="size-3" />
              </Button>
              <Button
                variant="outline"
                className="size-7 hover:bg-muted/50"
                size="icon"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
              >
                <ChevronRightIcon className="size-3" />
              </Button>
              <Button
                variant="outline"
                className="hidden size-7 lg:flex hover:bg-muted/50"
                size="icon"
                onClick={() => onPageChange(pagination.pages)}
                disabled={pagination.page === pagination.pages}
              >
                <ChevronsRightIcon className="size-3" />
              </Button>
            </div>
          </div>
      </div>
    </div>
  )
}

export default LicenseKeysList