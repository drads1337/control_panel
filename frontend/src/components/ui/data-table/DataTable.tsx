import React, { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'

export interface Column<T> {
  id: string
  header: string | React.ReactNode
  accessor?: keyof T | ((row: T) => React.ReactNode)
  cell?: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
  width?: string | number
  minWidth?: string | number
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  emptyIcon?: React.ComponentType<{ className?: string }>
  getRowId?: (row: T, index: number) => string | number
  onRowClick?: (row: T) => void
  virtualized?: boolean
  virtualizationThreshold?: number
  estimatedRowHeight?: number
  containerHeight?: string | number
  mobileView?: boolean
  renderMobileCard?: (row: T, index: number) => React.ReactNode
  className?: string
  headerClassName?: string
  rowClassName?: string | ((row: T) => string)
  showHeader?: boolean
}

const DEFAULT_VIRTUALIZATION_THRESHOLD = 30
const DEFAULT_ESTIMATED_ROW_HEIGHT = 65
const DEFAULT_CONTAINER_HEIGHT = '600px'

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error = null,
  emptyMessage = 'No data available',
  emptyIcon: EmptyIcon,
  getRowId = (row, index) => (row.id ?? index) as string | number,
  onRowClick,
  virtualized,
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
  estimatedRowHeight = DEFAULT_ESTIMATED_ROW_HEIGHT,
  containerHeight = DEFAULT_CONTAINER_HEIGHT,
  mobileView = false,
  renderMobileCard,
  className = '',
  headerClassName = '',
  rowClassName = '',
  showHeader = true,
}: DataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const shouldVirtualize = useMemo(() => {
    if (virtualized !== undefined) return virtualized
    return data.length > virtualizationThreshold
  }, [virtualized, data.length, virtualizationThreshold])

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? data.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 5,
    enabled: shouldVirtualize,
  })

  const renderCell = (row: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell(row)
    }
    
    if (column.accessor) {
      if (typeof column.accessor === 'function') {
        return column.accessor(row)
      }
      return row[column.accessor] as React.ReactNode
    }
    
    return null
  }

  const getRowClass = (row: T) => {
    if (typeof rowClassName === 'function') {
      return rowClassName(row)
    }
    return rowClassName || ''
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner message="Loading data..." />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p className="font-medium">Error loading data</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">
          {EmptyIcon && <EmptyIcon className="h-12 w-12 mx-auto mb-4" />}
          <h3 className="text-lg font-medium">{emptyMessage}</h3>
        </div>
      </div>
    )
  }

  // Mobile card view
  if (mobileView && renderMobileCard) {
    if (shouldVirtualize) {
      return (
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: containerHeight, contain: 'strict' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = data[virtualRow.index]
              return (
                <div
                  key={getRowId(row, virtualRow.index)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderMobileCard(row, virtualRow.index)}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        {data.map((row, index) => (
          <div key={getRowId(row, index)}>
            {renderMobileCard(row, index)}
          </div>
        ))}
      </div>
    )
  }

  // Desktop table view
  if (shouldVirtualize) {
    return (
      <div className={`rounded-md border ${className}`}>
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: containerHeight, contain: 'strict' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            <Table>
              {showHeader && (
                <TableHeader className={headerClassName}>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead
                        key={column.id}
                        className={column.headerClassName}
                        style={{
                          width: column.width,
                          minWidth: column.minWidth,
                        }}
                      >
                        {column.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
              )}
              <TableBody>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = data[virtualRow.index]
                  const rowId = getRowId(row, virtualRow.index)
                  return (
                    <TableRow
                      key={rowId}
                      className={getRowClass(row)}
                      onClick={() => onRowClick?.(row)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        cursor: onRowClick ? 'pointer' : 'default',
                      }}
                    >
                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          className={column.className}
                        >
                          {renderCell(row, column)}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    )
  }

  // Non-virtualized table
  return (
    <div className={`rounded-md border ${className}`}>
      <Table>
        {showHeader && (
          <TableHeader className={headerClassName}>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={column.headerClassName}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth,
                  }}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {data.map((row, index) => {
            const rowId = getRowId(row, index)
            return (
              <TableRow
                key={rowId}
                className={getRowClass(row)}
                onClick={() => onRowClick?.(row)}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={column.className}
                  >
                    {renderCell(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
