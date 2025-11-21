import { create } from 'zustand'
import { produce } from 'immer'
import type { Product } from '@/entities/product'

// Backward compatibility type alias
type Product = Product

interface ManagementState {
  activeTab: string
  dialogs: {
    // Product/Product dialogs
    viewProductDialogOpen: boolean
    selectedProduct: Product | null
    createProductDialogRequested: boolean
    editProductDialogOpen: boolean
    uploadProductDialogOpen: boolean
    pricesProductDialogOpen: boolean
    notificationsProductDialogOpen: boolean
    changelogProductDialogOpen: boolean
    // Agent dialogs
    createAgentDialogRequested: boolean
    // Backward compatibility
    viewProductDialogOpen: boolean
    selectedProduct: Product | null
    createProductDialogRequested: boolean
  }
}

interface ManagementActions {
  setActiveTab: (tab: string) => void
  
  // Product dialog actions
  openViewProductDialog: (product: Product) => void
  closeViewProductDialog: () => void
  setViewProductDialogOpen: (open: boolean) => void
  requestCreateProductDialog: () => void
  clearCreateProductDialogRequest: () => void
  setCreateProductDialogRequested: (requested: boolean) => void
  openEditProductDialog: (product: Product) => void
  closeEditProductDialog: () => void
  openUploadProductDialog: (product: Product) => void
  closeUploadProductDialog: () => void
  openPricesProductDialog: (product: Product) => void
  closePricesProductDialog: () => void
  openNotificationsProductDialog: (product: Product) => void
  closeNotificationsProductDialog: () => void
  openChangelogProductDialog: (product: Product) => void
  closeChangelogProductDialog: () => void
  closeAllProductDialogs: () => void
  
  // Agent dialog actions
  requestCreateAgentDialog: () => void
  clearCreateAgentDialogRequest: () => void
  setCreateAgentDialogRequested: (requested: boolean) => void
  
  // Backward compatibility actions
  openViewProductDialog: (product: Product) => void
  closeViewProductDialog: () => void
  setViewProductDialogOpen: (open: boolean) => void
  requestCreateProductDialog: () => void
  clearCreateProductDialogRequest: () => void
  setCreateProductDialogRequested: (requested: boolean) => void
}

const initialState: ManagementState = {
  activeTab: 'license-keys',
  dialogs: {
    // Product dialogs
    viewProductDialogOpen: false,
    selectedProduct: null,
    createProductDialogRequested: false,
    editProductDialogOpen: false,
    uploadProductDialogOpen: false,
    pricesProductDialogOpen: false,
    notificationsProductDialogOpen: false,
    changelogProductDialogOpen: false,
    // Agent dialogs
    createAgentDialogRequested: false,
    // Backward compatibility
    viewProductDialogOpen: false,
    selectedProduct: null,
    createProductDialogRequested: false,
  }
}

export const useManagementStore = create<ManagementState & ManagementActions>((set) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),

  // Product dialog actions
  openViewProductDialog: (product) => set(
    produce((state: ManagementState) => {
      state.dialogs.viewProductDialogOpen = true
      state.dialogs.selectedProduct = product
      state.dialogs.createProductDialogRequested = false
      // Backward compatibility
      state.dialogs.viewProductDialogOpen = true
      state.dialogs.selectedProduct = product
      state.dialogs.createProductDialogRequested = false
    })
  ),

  closeViewProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.viewProductDialogOpen = false
      state.dialogs.selectedProduct = null
      // Backward compatibility
      state.dialogs.viewProductDialogOpen = false
      state.dialogs.selectedProduct = null
    })
  ),

  setViewProductDialogOpen: (open) => set(
    produce((state: ManagementState) => {
      state.dialogs.viewProductDialogOpen = open
      if (!open) {
        state.dialogs.selectedProduct = null
      }
      // Backward compatibility
      state.dialogs.viewProductDialogOpen = open
      if (!open) {
        state.dialogs.selectedProduct = null
      }
    })
  ),

  requestCreateProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createProductDialogRequested = true
      // Backward compatibility
      state.dialogs.createProductDialogRequested = true
    })
  ),

  clearCreateProductDialogRequest: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createProductDialogRequested = false
      // Backward compatibility
      state.dialogs.createProductDialogRequested = false
    })
  ),

  setCreateProductDialogRequested: (requested) => set(
    produce((state: ManagementState) => {
      state.dialogs.createProductDialogRequested = requested
      // Backward compatibility
      state.dialogs.createProductDialogRequested = requested
    })
  ),

  openEditProductDialog: (product) => set(
    produce((state: ManagementState) => {
      state.dialogs.editProductDialogOpen = true
      state.dialogs.selectedProduct = product
    })
  ),

  closeEditProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.editProductDialogOpen = false
      state.dialogs.selectedProduct = null
    })
  ),

  openUploadProductDialog: (product) => set(
    produce((state: ManagementState) => {
      state.dialogs.uploadProductDialogOpen = true
      state.dialogs.selectedProduct = product
    })
  ),

  closeUploadProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.uploadProductDialogOpen = false
      state.dialogs.selectedProduct = null
    })
  ),

  openPricesProductDialog: (product) => set(
    produce((state: ManagementState) => {
      state.dialogs.pricesProductDialogOpen = true
      state.dialogs.selectedProduct = product
    })
  ),

  closePricesProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.pricesProductDialogOpen = false
      state.dialogs.selectedProduct = null
    })
  ),

  openNotificationsProductDialog: (product) => set(
    produce((state: ManagementState) => {
      state.dialogs.notificationsProductDialogOpen = true
      state.dialogs.selectedProduct = product
    })
  ),

  closeNotificationsProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.notificationsProductDialogOpen = false
      state.dialogs.selectedProduct = null
    })
  ),

  openChangelogProductDialog: (product) => set(
    produce((state: ManagementState) => {
      state.dialogs.changelogProductDialogOpen = true
      state.dialogs.selectedProduct = product
    })
  ),

  closeChangelogProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.changelogProductDialogOpen = false
      state.dialogs.selectedProduct = null
    })
  ),

  closeAllProductDialogs: () => set(
    produce((state: ManagementState) => {
      state.dialogs.viewProductDialogOpen = false
      state.dialogs.editProductDialogOpen = false
      state.dialogs.uploadProductDialogOpen = false
      state.dialogs.pricesProductDialogOpen = false
      state.dialogs.notificationsProductDialogOpen = false
      state.dialogs.changelogProductDialogOpen = false
      state.dialogs.selectedProduct = null
      // Backward compatibility
      state.dialogs.viewProductDialogOpen = false
      state.dialogs.selectedProduct = null
    })
  ),

  // Agent dialog actions
  requestCreateAgentDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createAgentDialogRequested = true
    })
  ),

  clearCreateAgentDialogRequest: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createAgentDialogRequested = false
    })
  ),

  setCreateAgentDialogRequested: (requested) => set(
    produce((state: ManagementState) => {
      state.dialogs.createAgentDialogRequested = requested
    })
  ),

  // Backward compatibility actions
  openViewProductDialog: (product) => set(
    produce((state: ManagementState) => {
      state.dialogs.viewProductDialogOpen = true
      state.dialogs.selectedProduct = product
      state.dialogs.viewProductDialogOpen = true
      state.dialogs.selectedProduct = product
      state.dialogs.createProductDialogRequested = false
    })
  ),

  closeViewProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.viewProductDialogOpen = false
      state.dialogs.selectedProduct = null
      state.dialogs.viewProductDialogOpen = false
      state.dialogs.selectedProduct = null
    })
  ),

  setViewProductDialogOpen: (open) => set(
    produce((state: ManagementState) => {
      state.dialogs.viewProductDialogOpen = open
      state.dialogs.viewProductDialogOpen = open
      if (!open) {
        state.dialogs.selectedProduct = null
        state.dialogs.selectedProduct = null
      }
    })
  ),

  requestCreateProductDialog: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createProductDialogRequested = true
      state.dialogs.createProductDialogRequested = true
    })
  ),

  clearCreateProductDialogRequest: () => set(
    produce((state: ManagementState) => {
      state.dialogs.createProductDialogRequested = false
      state.dialogs.createProductDialogRequested = false
    })
  ),

  setCreateProductDialogRequested: (requested) => set(
    produce((state: ManagementState) => {
      state.dialogs.createProductDialogRequested = requested
      state.dialogs.createProductDialogRequested = requested
    })
  ),
}))
