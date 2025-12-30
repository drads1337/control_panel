"use client"

import React, { useState, useMemo } from 'react'
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
} from '@tanstack/react-table'
import { 
  Search, 
  Download, 
  Trash2, 
  ArrowUp, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  User, 
  Globe, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Terminal,
  ChevronDownIcon
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
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

// --- Types ---

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  source: string
  message: string
  user?: string
  ip?: string
}

// --- Mock Data ---

const LOG_DATA: LogEntry[] = [
  { id: 'log_001', timestamp: '2023-10-27 10:42:15', level: 'ERROR', source: 'API Gateway', message: 'Rate limit exceeded for endpoint /v1/products', ip: '45.22.19.112' },
  { id: 'log_002', timestamp: '2023-10-27 10:41:03', level: 'SUCCESS', source: 'Auth Service', message: 'User login successful', user: 'admin_usr', ip: '192.168.1.5' },
  { id: 'log_003', timestamp: '2023-10-27 10:38:55', level: 'INFO', source: 'System', message: 'Scheduled backup started (Daily_Snapshot_DB)', user: 'system' },
  { id: 'log_004', timestamp: '2023-10-27 10:35:22', level: 'WARN', source: 'License Mgr', message: 'License key validation took > 2000ms', user: 'client_app_v2' },
  { id: 'log_005', timestamp: '2023-10-27 10:30:10', level: 'DEBUG', source: 'Background Worker', message: 'Processing job queue: 124 items pending', user: 'system' },
  { id: 'log_006', timestamp: '2023-10-27 10:28:44', level: 'INFO', source: 'Product Svc', message: 'Product cache invalidated', user: 'admin_usr' },
  { id: 'log_007', timestamp: '2023-10-27 10:25:30', level: 'ERROR', source: 'Database', message: 'Connection pool exhausted, retrying...', ip: 'internal' },
  { id: 'log_008', timestamp: '2023-10-27 10:22:12', level: 'SUCCESS', source: 'Auth Service', message: 'New API Key generated', user: 'dev_team_01', ip: '10.0.0.22' },
  { id: 'log_009', timestamp: '2023-10-27 10:15:00', level: 'INFO', source: 'Webhooks', message: 'Webhook delivery attempt to https://hooks.slack.com/...', user: 'system' },
  { id: 'log_010', timestamp: '2023-10-27 10:10:05', level: 'WARN', source: 'Security', message: 'Multiple failed login attempts detected', ip: '185.200.11.4' },
  { id: 'log_011', timestamp: '2023-10-27 10:05:22', level: 'SUCCESS', source: 'Payments', message: 'Subscription renewed successfully', user: 'client_x99' },
  { id: 'log_012', timestamp: '2023-10-27 10:01:18', level: 'DEBUG', source: 'Analytics', message: 'Flushing event buffer to disk', user: 'system' },
]

const getLevelBadge = (level: LogLevel) => {
  switch (level) {
    case 'ERROR': return 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:text-rose-500 dark:border-rose-500/20'
    case 'WARN': return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20'
    case 'SUCCESS': return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20'
    case 'DEBUG': return 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-500/10 dark:text-purple-500 dark:border-purple-500/20'
    default: return 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:text-blue-500 dark:border-blue-500/20'
  }
}

const getLevelIcon = (level: LogLevel) => {
  switch (level) {
      case 'ERROR': return <AlertCircle className="size-3" />
      case 'WARN': return <AlertTriangle className="size-3" />
      case 'SUCCESS': return <CheckCircle2 className="size-3" />
      case 'DEBUG': return <Terminal className="size-3" />
      default: return <Info className="size-3" />
  }
}

const columns: ColumnDef<LogEntry>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          data-indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="size-3.5"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="size-3.5"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "timestamp",
    header: "Timestamp",
    cell: ({ row }) => (
      <div className="text-muted-foreground text-[11px] font-mono">
        {row.original.timestamp}
      </div>
    ),
  },
  {
    accessorKey: "level",
    header: "Level",
    cell: ({ row }) => (
      <Badge variant="outline" className={cn("text-[9px] px-1.5 h-5 font-bold gap-1 pl-1", getLevelBadge(row.original.level))}>
        {getLevelIcon(row.original.level)} {row.original.level}
      </Badge>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <div className="font-sans font-semibold text-xs">
        {row.original.source}
      </div>
    ),
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ row }) => (
      <div className="text-muted-foreground truncate max-w-md" title={row.original.message}>
        {row.original.message}
      </div>
    ),
  },
  {
    id: "userOrIp",
    header: () => <div className="text-right">User / IP</div>,
    cell: ({ row }) => (
      <div className="text-right text-muted-foreground text-[11px]">
        {row.original.user ? (
          <span className="flex items-center justify-end gap-1.5">
            <User className="size-3" /> {row.original.user}
          </span>
        ) : (
          <span className="flex items-center justify-end gap-1.5">
            <Globe className="size-3" /> {row.original.ip}
          </span>
        )}
      </div>
    ),
  },
]

export function LogsPage() {
  const [filterLevel, setFilterLevel] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const filteredData = useMemo(() => {
    return LOG_DATA.filter(log => {
      const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel
      const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.user?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesLevel && matchesSearch
    })
  }, [filterLevel, searchTerm])

  const table = useReactTable({
    data: filteredData,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

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
          <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 md:grid-cols-4 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
            <Card className="@container/card p-3">
              <CardHeader className="p-0 pb-1">
                <CardDescription className="text-xs">Events Today</CardDescription>
                <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                  14,205
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="text-xs h-5 px-1.5">
                    <ArrowUp className="size-3" />
                    12% up
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
                <CardDescription className="text-xs">Errors</CardDescription>
                <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                  24
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="text-xs h-5 px-1.5">
                    <AlertCircle className="size-3" />
                    Past 24h
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                <div className="line-clamp-1 flex gap-1.5 font-medium">
                  Error events{" "}
                  <AlertCircle className="size-3" />
                </div>
                <div className="text-muted-foreground">
                  Errors in last 24 hours
                </div>
              </CardFooter>
            </Card>
            <Card className="@container/card p-3">
              <CardHeader className="p-0 pb-1">
                <CardDescription className="text-xs">Warnings</CardDescription>
                <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                  156
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="text-xs h-5 px-1.5">
                    <AlertTriangle className="size-3" />
                    Past 24h
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                <div className="line-clamp-1 flex gap-1.5 font-medium">
                  Warning events{" "}
                  <AlertTriangle className="size-3" />
                </div>
                <div className="text-muted-foreground">
                  Warnings in last 24 hours
                </div>
              </CardFooter>
            </Card>
            <Card className="@container/card p-3">
              <CardHeader className="p-0 pb-1">
                <CardDescription className="text-xs">Log Volume</CardDescription>
                <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
                  1.2 GB
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="text-xs h-5 px-1.5">
                    <Database className="size-3" />
                    Storage
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-0.5 text-xs p-0 pt-1">
                <div className="line-clamp-1 flex gap-1.5 font-medium">
                  1.2 GB / 5 GB limit{" "}
                  <Database className="size-3" />
                </div>
                <div className="text-muted-foreground">
                  Log storage usage
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* Main Logs Panel */}
          <Card className="flex flex-col flex-1 border bg-background shadow-sm overflow-hidden">
            
            {/* Toolbar */}
            <div className="p-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-background">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search logs..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-xs pl-8 bg-muted/30 border-muted-foreground/20"
                  />
                </div>
                
                <div className="hidden md:flex bg-muted/30 p-0.5 rounded-lg border border-border/50">
                  {['ALL', 'ERROR', 'WARN', 'INFO'].map(level => (
                    <button 
                      key={level}
                      onClick={() => setFilterLevel(level)}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wide",
                        filterLevel === level 
                          ? "bg-background shadow-sm text-foreground ring-1 ring-border" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
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
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 bg-background">
                  <Download className="size-3" /> Export
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50/50 dark:hover:bg-rose-900/10">
                  <Trash2 className="size-3" /> Clear
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-lg border">
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
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className={cn(
                          "h-9",
                          row.getIsSelected() && "bg-primary/5"
                        )}
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
            <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/10">
              <div className="text-muted-foreground flex-1 text-xs">
                {table.getFilteredSelectedRowModel().rows.length} of{" "}
                {table.getFilteredRowModel().rows.length} row(s) selected.
              </div>
              <div className="flex w-full items-center gap-8 lg:w-fit">
                <div className="hidden items-center gap-2 lg:flex">
                  <Label htmlFor="rows-per-page" className="text-xs font-medium">
                    Rows per page
                  </Label>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                      table.setPageSize(Number(value))
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
                  Page {table.getState().pagination.pageIndex + 1} of{" "}
                  {table.getPageCount()}
                </div>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <Button
                    variant="outline"
                    className="hidden h-7 w-7 p-0 lg:flex"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to first page</span>
                    <ChevronsLeft className="size-3" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-7"
                    size="icon"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="size-3" />
                  </Button>
                  <Button
                    variant="outline"
                    className="size-7"
                    size="icon"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="size-3" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden size-7 lg:flex"
                    size="icon"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <span className="sr-only">Go to last page</span>
                    <ChevronsRight className="size-3" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}