import { create } from 'zustand'

/**
 * Management store for tab management only.
 * Dialog state has been moved to specialized stores:
 * - useProductDialogStore for product dialogs
 * - useAgentDialogStore for agent dialogs
 */
interface ManagementState {
  activeTab: string
}

interface ManagementActions {
  setActiveTab: (tab: string) => void
}

const initialState: ManagementState = {
  activeTab: 'license-keys',
}

export const useManagementStore = create<ManagementState & ManagementActions>((set) => ({
  ...initialState,
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
