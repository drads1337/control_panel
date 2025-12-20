import React, { useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/app/providers/auth-provider'
import { getProducts } from '@/entities/product'
import { getProductFiles } from '@/entities/file'
import { toast } from 'sonner'
import type { Product } from '@/entities/product'
import type { FileItem } from '@/entities/file'

export const fileManagerKeys = {
  all: ['fileManager'] as const,
  products: () => [...fileManagerKeys.all, 'products'] as const,
  files: (productId: number, filters: any) => [...fileManagerKeys.all, 'files', productId, filters] as const,
}

export interface FileManagerFilters {
  searchTerm: string
  categoryFilter: string
  sortBy: 'name' | 'size' | 'date' | 'type'
  sortOrder: 'asc' | 'desc'
}

export type SortBy = FileManagerFilters['sortBy']
export type SortOrder = FileManagerFilters['sortOrder']

interface UseFileManagerReturn {

  products: Product[]
  selectedProduct: Product | null
  files: FileItem[]
  loading: boolean
  refreshing: boolean
  filters: FileManagerFilters
  filteredFiles: FileItem[]
  stats: {
    total: number
    files: number
    folders: number
    totalSize: number
    active: number
    archived: number
    configs: number
    resources: number
  }

  selectProduct: (product: Product | null) => void
  updateFilters: (newFilters: Partial<FileManagerFilters>) => void
  refreshData: () => void
  loadProductFiles: () => void
}

export function useFileManagerQuery(): UseFileManagerReturn {
  const { isAuthenticated } = useAuthContext()

  const [selectedProductId, setSelectedProductId] = React.useState<number | null>(null)
  const [filters, setFilters] = React.useState<FileManagerFilters>({
    searchTerm: '',
    categoryFilter: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: fileManagerKeys.products(),
    queryFn: () => getProducts('all'),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  const products = productsData?.products || []

  React.useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id)
    }
  }, [products, selectedProductId])

  const selectedProduct = products.find(g => g.id === selectedProductId) || null

  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: fileManagerKeys.files(selectedProductId || 0, {
      category: filters.categoryFilter,
      search: filters.searchTerm,
    }),
    queryFn: () => {
      if (!selectedProductId) throw new Error('No product selected')
      return getProductFiles(
        selectedProductId,
        filters.categoryFilter,
        'all',
        filters.searchTerm
      )
    },
    enabled: isAuthenticated && !!selectedProductId,
    staleTime: 30 * 1000,
  })

  const files = filesData?.files || []

  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      const searchMatch = file.name.toLowerCase().includes(filters.searchTerm.toLowerCase())
      const categoryMatch = filters.categoryFilter === 'all' || file.category === filters.categoryFilter
      return searchMatch && categoryMatch
    }).sort((a, b) => {
      let comparison = 0

      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'date':
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime()
          break
        case 'type':
          comparison = a.category.localeCompare(b.category)
          break
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison
    })
  }, [files, filters])

  const stats = useMemo(() => ({
    total: files.length,
    files: files.filter(f => f.type === 'file').length,
    folders: files.filter(f => f.type === 'folder').length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    active: files.filter(f => f.status === 'active').length,
    archived: files.filter(f => f.status === 'archived').length,
    configs: files.filter(f => f.category === 'config').length,
    resources: files.filter(f => f.category === 'resource').length,
  }), [files])

  const selectProduct = useCallback((product: Product | null) => {
    setSelectedProductId(product?.id || null)
  }, [])

  const updateFilters = useCallback((newFilters: Partial<FileManagerFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const refreshData = useCallback(() => {
    refetchFiles()
  }, [refetchFiles])

  const loadProductFiles = useCallback(() => {
    refetchFiles()
  }, [refetchFiles])

  return {
    products,
    selectedProduct,
    files,
    loading: productsLoading || filesLoading,
    refreshing: false,
    filters,
    filteredFiles,
    stats,
    selectProduct,
    updateFilters,
    refreshData,
    loadProductFiles,
  }
}
