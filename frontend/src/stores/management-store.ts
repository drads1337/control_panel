import { create } from 'zustand'
import { produce } from 'immer'
import type { Game } from '@/entities/game'

// State management types
// Note: stats are now managed by TanStack Query (useManagementStats hook)
// Zustand is only used for UI state (tabs, dialogs)

interface ManagementState {
  activeTab: string
  dialogs: {
    viewGameDialogOpen: boolean
    selectedGame: Game | null
    createGameDialogRequested: boolean
    createLoaderDialogRequested: boolean
  }
}

interface ManagementActions {
  setActiveTab: (tab: string) => void
  openViewGameDialog: (game: Game) => void
  closeViewGameDialog: () => void
  setViewGameDialogOpen: (open: boolean) => void
  requestCreateGameDialog: () => void
  clearCreateGameDialogRequest: () => void
  setCreateGameDialogRequested: (requested: boolean) => void
  requestCreateLoaderDialog: () => void
  clearCreateLoaderDialogRequest: () => void
  setCreateLoaderDialogRequested: (requested: boolean) => void
}

const initialState: ManagementState = {
  activeTab: 'license-keys',
  dialogs: {
    viewGameDialogOpen: false,
    selectedGame: null,
    createGameDialogRequested: false,
    createLoaderDialogRequested: false
  }
}

export const useManagementStore = create<ManagementState & ManagementActions>((set) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),

  openViewGameDialog: (game) => set(
    produce((state: ManagementState) => {
      state.dialogs.viewGameDialogOpen = true
      state.dialogs.selectedGame = game
      state.dialogs.createGameDialogRequested = false
      state.dialogs.createLoaderDialogRequested = false
    })
  ),

  closeViewGameDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.viewGameDialogOpen = false
      state.dialogs.selectedGame = null
      state.dialogs.createGameDialogRequested = false
      state.dialogs.createLoaderDialogRequested = false
    })
  ),

  setViewGameDialogOpen: (open) => set(
    produce((state: ManagementState) => {
      state.dialogs.viewGameDialogOpen = open
      if (!open) {
        state.dialogs.selectedGame = null
      }
    })
  ),

  requestCreateGameDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createGameDialogRequested = true
    })
  ),

  clearCreateGameDialogRequest: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createGameDialogRequested = false
    })
  ),

  setCreateGameDialogRequested: (requested) => set(
    produce((state: ManagementState) => {
      state.dialogs.createGameDialogRequested = requested
    })
  ),

  requestCreateLoaderDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createLoaderDialogRequested = true
    })
  ),

  clearCreateLoaderDialogRequest: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createLoaderDialogRequested = false
    })
  ),

  setCreateLoaderDialogRequested: (requested) => set(
    produce((state: ManagementState) => {
      state.dialogs.createLoaderDialogRequested = requested
    })
  )
}))

