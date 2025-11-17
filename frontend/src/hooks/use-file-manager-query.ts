import React, { useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/contexts/auth-context'
import { getGames } from '@/entities/game'
import { getGameFiles } from '@/entities/file'
import { toast } from 'sonner'
import type { Game } from '@/entities/game'
import type { FileItem } from '@/entities/file'

// Cache keys
export const fileManagerKeys = {
  all: ['fileManager'] as const,
  games: () => [...fileManagerKeys.all, 'games'] as const,
  files: (gameId: number, filters: any) => [...fileManagerKeys.all, 'files', gameId, filters] as const,
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
  // State
  games: Game[]
  selectedGame: Game | null
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
  
  // Actions
  selectGame: (game: Game | null) => void
  updateFilters: (newFilters: Partial<FileManagerFilters>) => void
  refreshData: () => void
  loadGameFiles: () => void
}

export function useFileManagerQuery(): UseFileManagerReturn {
  const { isAuthenticated } = useAuthContext()
  
  // Local state
  const [selectedGameId, setSelectedGameId] = React.useState<number | null>(null)
  const [filters, setFilters] = React.useState<FileManagerFilters>({
    searchTerm: '',
    categoryFilter: 'all',
    sortBy: 'name',
    sortOrder: 'asc',
  })

  // Query for games
  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: fileManagerKeys.games(),
    queryFn: () => getGames('all'),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const games = gamesData?.games || []

  // Auto-select first game
  React.useEffect(() => {
    if (games.length > 0 && !selectedGameId) {
      setSelectedGameId(games[0].id)
    }
  }, [games, selectedGameId])

  const selectedGame = games.find(g => g.id === selectedGameId) || null

  // Query for files
  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: fileManagerKeys.files(selectedGameId || 0, {
      category: filters.categoryFilter,
      search: filters.searchTerm,
    }),
    queryFn: () => {
      if (!selectedGameId) throw new Error('No game selected')
      return getGameFiles(
        selectedGameId,
        filters.categoryFilter,
        'all',
        filters.searchTerm
      )
    },
    enabled: isAuthenticated && !!selectedGameId,
    staleTime: 30 * 1000, // 30 seconds
  })

  const files = filesData?.files || []

  // Filtered and sorted files
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

  // Stats
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

  // Actions
  const selectGame = useCallback((game: Game | null) => {
    setSelectedGameId(game?.id || null)
  }, [])

  const updateFilters = useCallback((newFilters: Partial<FileManagerFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const refreshData = useCallback(() => {
    refetchFiles()
  }, [refetchFiles])

  const loadGameFiles = useCallback(() => {
    refetchFiles()
  }, [refetchFiles])

  return {
    games,
    selectedGame,
    files,
    loading: gamesLoading || filesLoading,
    refreshing: false, // React Query handles this internally
    filters,
    filteredFiles,
    stats,
    selectGame,
    updateFilters,
    refreshData,
    loadGameFiles,
  }
}
