import { useState, useCallback } from 'react'

/**
 * Generic hook for managing CRUD dialog states
 * Reduces code duplication across different entity management pages
 * 
 * @template T - The entity type (e.g., User, Product, Webhook)
 */
export function useCrudDialogs<T extends { id: number | string }>() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<T | null>(null)

  const openCreateDialog = useCallback(() => {
    setSelectedEntity(null)
    setCreateDialogOpen(true)
  }, [])

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false)
    setSelectedEntity(null)
  }, [])

  const openEditDialog = useCallback((entity: T) => {
    setSelectedEntity(entity)
    setEditDialogOpen(true)
  }, [])

  const closeEditDialog = useCallback(() => {
    setEditDialogOpen(false)
    setSelectedEntity(null)
  }, [])

  const openDeleteDialog = useCallback((entity: T) => {
    setSelectedEntity(entity)
    setDeleteDialogOpen(true)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false)
    setSelectedEntity(null)
  }, [])

  const openViewDialog = useCallback((entity: T) => {
    setSelectedEntity(entity)
    setViewDialogOpen(true)
  }, [])

  const closeViewDialog = useCallback(() => {
    setViewDialogOpen(false)
    setSelectedEntity(null)
  }, [])

  const closeAllDialogs = useCallback(() => {
    setCreateDialogOpen(false)
    setEditDialogOpen(false)
    setDeleteDialogOpen(false)
    setViewDialogOpen(false)
    setSelectedEntity(null)
  }, [])

  return {
    // Dialog states
    createDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    viewDialogOpen,
    selectedEntity,
    
    // Dialog actions
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
    openDeleteDialog,
    closeDeleteDialog,
    openViewDialog,
    closeViewDialog,
    closeAllDialogs,
    
    // Setters (for direct control if needed)
    setCreateDialogOpen,
    setEditDialogOpen,
    setDeleteDialogOpen,
    setViewDialogOpen,
    setSelectedEntity
  }
}
