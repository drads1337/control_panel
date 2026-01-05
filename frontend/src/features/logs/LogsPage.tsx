import React, { useState, useMemo, useCallback } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { 
  Search, 
  Download, 
  ArrowUp, 
  AlertTriangle, 
  User, 
  Globe, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  ChevronDownIcon,
  Loader2,
  AlertCircle,
  Monitor,
  Hash
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useLogsQuery, useLogActions, type Log } from '@/entities/log'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { useAuthContext } from '@/app/providers/auth-provider'
import { AccessDenied } from '@/shared/ui/components'
import { usePermissions } from '@/shared/hooks/use-permissions'

// Format date helper
const formatTimestamp = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return dateString
  }
}

// Format action for display
const formatAction = (action: string): string => {
  return action.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

// Get action badge color
const getActionBadgeColor = (action: string): string => {
  const actionLower = action.toLowerCase()
  if (actionLower.includes('error') || actionLower.includes('fail')) {
    return 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500 dark:border-rose-500/20'
  }
  if (actionLower.includes('warn') || actionLower.includes('warning')) {
    return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20'
  }
  if (actionLower.includes('success') || actionLower.includes('login') || actionLower.includes('create')) {
    return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20'
  }
  return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-500/20'
}

const columns: ColumnDef<Log>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px] font-mono flex items-center gap-1">
        <Hash className="size-3" />
        {row.original.id}
      </div>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Timestamp",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px] font-mono">
        {formatTimestamp(row.original.created_at)}
      </div>
    ),
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => (
      <Badge variant="outline" className={cn("text-[9px] px-1.5 h-5 font-bold gap-1 pl-1", getActionBadgeColor(row.original.action))}>
        {formatAction(row.original.action)}
      </Badge>
    ),
  },
  {
    accessorKey: "username",
    header: "Username",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px] flex items-center gap-1.5">
        {row.original.username ? (
          <>
            <User className="size-3" />
            <span>{row.original.username}</span>
          </>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "ip_address",
    header: "IP Address",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px] font-mono flex items-center gap-1.5">
        {row.original.ip_address ? (
          <>
            <Globe className="size-3" />
            <span>{row.original.ip_address}</span>
          </>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "city",
    header: "City",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px]">
        {row.original.city || <span className="text-muted-foreground/50">-</span>}
      </div>
    ),
  },
  {
    accessorKey: "country",
    header: "Country",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px]">
        {row.original.country || <span className="text-muted-foreground/50">-</span>}
      </div>
    ),
  },
  {
    accessorKey: "user_agent",
    header: "User Agent",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px] truncate max-w-xs" title={row.original.user_agent || ''}>
        {row.original.user_agent ? (
          <span className="flex items-center gap-1.5">
            <Monitor className="size-3 flex-shrink-0" />
            <span className="truncate">{row.original.user_agent}</span>
          </span>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "details",
    header: "Details",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px] truncate max-w-lg" title={row.original.details || row.original.action || ''}>
        {row.original.details || row.original.action || <span className="text-muted-foreground/50">-</span>}
      </div>
    ),
  },
]

const COLUMN_VISIBILITY_STORAGE_KEY = 'logs-column-visibility'

export function LogsPage() {
  const { user, isAuthenticated, isInitialized } = useAuthContext()
  const { hasPermission } = usePermissions()
  const [searchTerm, setSearchTerm] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  
  // Load column visibility from localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      // Silent fail
    }
    return {}
  })

  // Save column visibility to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(columnVisibility))
    } catch {
      // Silent fail
    }
  }, [columnVisibility])

  // Debounce search term
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const {
    logs,
    loading,
    error,
    stats,
    pagination,
    searchLogsByTerm,
    fetchLogs,
    changePage,
    changePerPage,
    refresh,
  } = useLogsQuery({
    page: 1,
    perPage: 10,
    autoRefresh: false,
  })

  const { exportLogsToCSV, isExporting } = useLogActions()

  // Handle action filter change
  const handleActionFilterChange = useCallback((action: string) => {
    setSelectedAction(action)
    setSearchTerm('') // Clear search when filtering by action
    setDebouncedSearchTerm('') // Clear debounced search
    if (action && action !== 'all') {
      fetchLogs({ action })
    } else {
      fetchLogs({})
    }
  }, [fetchLogs])

  // Handle search input change - clear action filter when user starts typing
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    if (value && selectedAction && selectedAction !== 'all') {
      setSelectedAction('all')
    }
  }, [selectedAction])

  // Handle search - when user types in search box
  React.useEffect(() => {
    if (!isAuthenticated || !isInitialized) {
      return
    }
    // Only search if no action filter is selected (or "all" is selected)
    if (!selectedAction || selectedAction === 'all') {
      searchLogsByTerm(debouncedSearchTerm)
    }
  }, [debouncedSearchTerm, searchLogsByTerm, isAuthenticated, isInitialized, selectedAction])

  const table = useReactTable({
    data: logs,
    columns,
    getRowId: (row) => row.id.toString(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    pageCount: pagination.pages,
    manualPagination: true,
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const newState = updater({
          pageIndex: pagination.page - 1,
          pageSize: pagination.perPage
        })
        changePage(newState.pageIndex + 1)
      } else {
        changePage(updater.pageIndex + 1)
      }
    },
    initialState: {
      pagination: {
        pageSize: pagination.perPage,
      },
    },
  })

  const handleExport = useCallback(async () => {
    if (!isAuthenticated || !isInitialized) {
      toast.error('You must be authenticated to export logs')
      return
    }
    try {
      await exportLogsToCSV({})
      toast.success('Logs exported successfully')
    } catch (err) {
      toast.error('Failed to export logs')
      console.error(err)
    }
  }, [exportLogsToCSV, isAuthenticated, isInitialized])

  if (!isInitialized) {
    return null
  }

  if (!isAuthenticated || !user) {
    return (
      <AccessDenied
        isAuthenticated={false}
        hasAccess={false}
        user={user}
        message="You need to be logged in to view logs."
        useCard={true}
      />
    )
  }

  const canViewLogs = hasPermission('logs.view') || hasPermission('security.view_logs')
  
  if (!canViewLogs) {
    return (
      <AccessDenied
        isAuthenticated={true}
        hasAccess={false}
        user={user}
        message="You don't have permission to view logs."
        useCard={true}
      />
    )
  }

  if (loading && !logs.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
        <span className="ml-2">Loading logs...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-destructive">Error Loading Logs</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => refresh()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4 px-4 lg:px-6">
          <div className="mb-2">
            <h1 className="text-lg xs:text-xl sm:text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
              Logs
            </h1>
            <p className="text-[10px] xs:text-xs sm:text-xs md:text-sm text-muted-foreground mt-1 xs:mt-1.5 sm:mt-2 leading-snug">
              View and analyze system events, errors, and activity logs.
            </p>
          </div>
          
          {/* Top Stats Cards */}
          {stats && (
            <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 md:grid-cols-4 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
              <Card className="@container/card p-3">
                <CardHeader className="p-0 pb-1">
                  <CardDescription className="text-xs">Events Today</CardDescription>
                  <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                    {stats.overview.today.toLocaleString()}
                  </CardTitle>
                  <CardAction>
                    <Badge variant="outline" className="text-xs h-5 px-1.5">
                      <Database className="size-3" />
                      Today
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                  <div className="line-clamp-1 flex gap-1.5 font-medium">
                    Total events today{" "}
                    <Database className="size-3" />
                  </div>
                  <div className="text-muted-foreground">
                    System events logged
                  </div>
                </CardFooter>
              </Card>
              <Card className="@container/card p-3">
                <CardHeader className="p-0 pb-1">
                  <CardDescription className="text-xs">Total Events</CardDescription>
                  <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                    {stats.overview.total.toLocaleString()}
                  </CardTitle>
                  <CardAction>
                    <Badge variant="outline" className="text-xs h-5 px-1.5">
                      <Database className="size-3" />
                      All time
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                  <div className="line-clamp-1 flex gap-1.5 font-medium">
                    Total events{" "}
                    <Database className="size-3" />
                  </div>
                  <div className="text-muted-foreground">
                    All system events
                  </div>
                </CardFooter>
              </Card>
              <Card className="@container/card p-3">
                <CardHeader className="p-0 pb-1">
                  <CardDescription className="text-xs">This Week</CardDescription>
                  <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                    {stats.overview.week.toLocaleString()}
                  </CardTitle>
                  <CardAction>
                    <Badge variant="outline" className="text-xs h-5 px-1.5">
                      <ArrowUp className="size-3" />
                      Week
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                  <div className="line-clamp-1 flex gap-1.5 font-medium">
                    Events this week{" "}
                    <Database className="size-3" />
                  </div>
                  <div className="text-muted-foreground">
                    Last 7 days
                  </div>
                </CardFooter>
              </Card>
              <Card className="@container/card p-3">
                <CardHeader className="p-0 pb-1">
                  <CardDescription className="text-xs">This Month</CardDescription>
                  <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                    {stats.overview.month.toLocaleString()}
                  </CardTitle>
                  <CardAction>
                    <Badge variant="outline" className="text-xs h-5 px-1.5">
                      <Database className="size-3" />
                      Month
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                  <div className="line-clamp-1 flex gap-1.5 font-medium">
                    Events this month{" "}
                    <Database className="size-3" />
                  </div>
                  <div className="text-muted-foreground">
                    Last 30 days
                  </div>
                </CardFooter>
              </Card>
            </div>
          )}

          {/* Toolbar */}
          <div className="p-3 border-b border rounded-t-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Search logs..." 
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="h-8 text-xs pl-8 bg-muted/30 border-muted-foreground/20"
                  disabled={!!(selectedAction && selectedAction !== 'all')}
                />
              </div>
              <Select
                value={selectedAction}
                onValueChange={handleActionFilterChange}
              >
                <SelectTrigger className="w-[180px] h-8 text-xs" disabled={!!searchTerm}>
                  <SelectValue placeholder="Filter by action..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all" className="text-xs">All Actions</SelectItem>
                  {stats?.action_stats
                    ?.sort((a, b) => b.count - a.count)
                    .map((stat) => (
                      <SelectItem key={stat.action} value={stat.action} className="text-xs">
                        {formatAction(stat.action)} ({stat.count})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <span className="hidden lg:inline">Columns</span>
                    <ChevronDownIcon className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 text-xs">
                  {table
                    .getAllColumns()
                    .filter(
                      (column) =>
                        typeof column.accessorFn !== "undefined" &&
                        column.getCanHide()
                    )
                    .map((column) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize text-xs"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) =>
                            column.toggleVisibility(!!value)
                          }
                        >
                          {column.id}
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 text-xs gap-1.5 bg-background"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Download className="size-3" />
                )}
                Export
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border-x border-b rounded-b-lg overflow-auto">
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="h-9">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan} className="text-xs py-2">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      <div className="flex flex-col items-center justify-center py-10">
                        <Loader2 className="size-8 mb-3 animate-spin text-primary" />
                        <p className="text-xs font-medium text-muted-foreground">Loading logs...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="h-9"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="text-xs py-1.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50">
                        <Filter className="size-8 mb-3 stroke-1" />
                        <p className="text-xs font-medium">No logs found matching your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border rounded-b-lg bg-muted/10">
            <div className="text-muted-foreground flex-1 text-xs">
              {table.getFilteredRowModel().rows.length} row(s) total
            </div>
            <div className="flex w-full items-center gap-8 lg:w-fit">
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="rows-per-page" className="text-xs font-medium">
                  Rows per page
                </Label>
                <Select
                  value={`${pagination.perPage}`}
                  onValueChange={(value) => {
                    changePerPage(Number(value))
                  }}
                >
                  <SelectTrigger size="sm" className="w-20 h-7 text-xs" id="rows-per-page">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top" className="text-xs">
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`} className="text-xs">
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-fit items-center justify-center text-xs font-medium">
                Page {pagination.page} of{" "}
                {pagination.pages || 1}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button
                  variant="outline"
                  className="hidden h-7 w-7 p-0 lg:flex"
                  onClick={() => changePage(1)}
                  disabled={pagination.page <= 1}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronsLeft className="size-3" />
                </Button>
                <Button
                  variant="outline"
                  className="size-7"
                  size="icon"
                  onClick={() => changePage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="size-3" />
                </Button>
                <Button
                  variant="outline"
                  className="size-7"
                  size="icon"
                  onClick={() => changePage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="size-3" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden size-7 lg:flex"
                  size="icon"
                  onClick={() => changePage(pagination.pages)}
                  disabled={pagination.page >= pagination.pages}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronsRight className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}