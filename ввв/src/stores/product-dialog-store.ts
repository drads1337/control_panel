import { create } from 'zustand'
import { produce } from 'immer'
import type { Product } from '@/entities/product'

interface ProductDialogState {
  viewProductDialogOpen: boolean
  selectedProduct: Product | null
  createProductDialogRequested: boolean
  editProductDialogOpen: boolean
  uploadProductDialogOpen: boolean
  pricesProductDialogOpen: boolean
  notificationsProductDialogOpen: boolean
  changelogProductDialogOpen: boolean
}

interface ProductDialogActions {
  // View dialog
  openViewProductDialog: (product: Product) => void
  closeViewProductDialog: () => void
  setViewProductDialogOpen: (open: boolean) => void
  
  // Create dialog
  requestCreateProductDialog: () => void
  clearCreateProductDialogRequest: () => void
  setCreateProductDialogRequested: (requested: boolean) => void
  
  // Edit dialog
  openEditProductDialog: (product: Product) => void
  closeEditProductDialog: () => void
  
  // Upload dialog
  openUploadProductDialog: (product: Product) => void
  closeUploadProductDialog: () => void
  
  // Prices dialog
  openPricesProductDialog: (product: Product) => void
  closePricesProductDialog: () => void
  
  // Notifications dialog
  openNotificationsProductDialog: (product: Product) => void
  closeNotificationsProductDialog: () => void
  
  // Changelog dialog
  openChangelogProductDialog: (product: Product) => void
  closeChangelogProductDialog: () => void
  
  // Utility
  closeAllProductDialogs: () => void
}

const initialState: ProductDialogState = {
  viewProductDialogOpen: false,
  selectedProduct: null,
  createProductDialogRequested: false,
  editProductDialogOpen: false,
  uploadProductDialogOpen: false,
  pricesProductDialogOpen: false,
  notificationsProductDialogOpen: false,
  changelogProductDialogOpen: false,
}

export const useProductDialogStore = create<ProductDialogState & ProductDialogActions>((set) => ({
  ...initialState,

  // View dialog actions
  openViewProductDialog: (product) => set(
    produce((state: ProductDialogState) => {
      state.viewProductDialogOpen = true
      state.selectedProduct = product
      state.createProductDialogRequested = false
    })
  ),

  closeViewProductDialog: () => set(
    produce((state: ProductDialogState) => {
      state.viewProductDialogOpen = false
      state.selectedProduct = null
    })
  ),

  setViewProductDialogOpen: (open) => set(
    produce((state: ProductDialogState) => {
      state.viewProductDialogOpen = open
      if (!open) {
        state.selectedProduct = null
      }
    })
  ),

  // Create dialog actions
  requestCreateProductDialog: () => set(
    produce((state: ProductDialogState) => {
      state.createProductDialogRequested = true
    })
  ),

  clearCreateProductDialogRequest: () => set(
    produce((state: ProductDialogState) => {
      state.createProductDialogRequested = false
    })
  ),

  setCreateProductDialogRequested: (requested) => set(
    produce((state: ProductDialogState) => {
      state.createProductDialogRequested = requested
    })
  ),

  // Edit dialog actions
  openEditProductDialog: (product) => set(
    produce((state: ProductDialogState) => {
      state.editProductDialogOpen = true
      state.selectedProduct = product
    })
  ),

  closeEditProductDialog: () => set(
    produce((state: ProductDialogState) => {
      state.editProductDialogOpen = false
      state.selectedProduct = null
    })
  ),

  // Upload dialog actions
  openUploadProductDialog: (product) => set(
    produce((state: ProductDialogState) => {
      state.uploadProductDialogOpen = true
      state.selectedProduct = product
    })
  ),

  closeUploadProductDialog: () => set(
    produce((state: ProductDialogState) => {
      state.uploadProductDialogOpen = false
      state.selectedProduct = null
    })
  ),

  // Prices dialog actions
  openPricesProductDialog: (product) => set(
    produce((state: ProductDialogState) => {
      state.pricesProductDialogOpen = true
      state.selectedProduct = product
    })
  ),

  closePricesProductDialog: () => set(
    produce((state: ProductDialogState) => {
      state.pricesProductDialogOpen = false
      state.selectedProduct = null
    })
  ),

  // Notifications dialog actions
  openNotificationsProductDialog: (product) => set(
    produce((state: ProductDialogState) => {
      state.notificationsProductDialogOpen = true
      state.selectedProduct = product
    })
  ),

  closeNotificationsProductDialog: () => set(
    produce((state: ProductDialogState) => {
      state.notificationsProductDialogOpen = false
      state.selectedProduct = null
    })
  ),

  // Changelog dialog actions
  openChangelogProductDialog: (product) => set(
    produce((state: ProductDialogState) => {
      state.changelogProductDialogOpen = true
      state.selectedProduct = product
    })
  ),

  closeChangelogProductDialog: () => set(
    produce((state: ProductDialogState) => {
      state.changelogProductDialogOpen = false
      state.selectedProduct = null
    })
  ),

  // Utility action
  closeAllProductDialogs: () => set(
    produce((state: ProductDialogState) => {
      state.viewProductDialogOpen = false
      state.editProductDialogOpen = false
      state.uploadProductDialogOpen = false
      state.pricesProductDialogOpen = false
      state.notificationsProductDialogOpen = false
      state.changelogProductDialogOpen = false
      state.selectedProduct = null
    })
  ),
}))

