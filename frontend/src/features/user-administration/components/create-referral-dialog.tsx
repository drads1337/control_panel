"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { sanitizeString } from "@/lib/sanitization"
import { cn } from "@/lib/utils"

interface Role {
  id: number
  name: string
  description: string
  permissions: string[]
  is_system_role: boolean
  user_count: number
  created_at: string
  updated_at?: string
}

interface CreateReferralDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: () => void
  onGenerate: () => void
  loading: boolean
  form: {
    code: string
    expires_days: number
    work_duration_days: number
    selected_products: number[]
    selected_rbac_role: number | null
    token_balance: number
  }
  onFormChange: (form: any) => void
  roles: Role[]
  products: any[]
  rbacLoading: boolean
  rbacError: string | null
  productsLoading: boolean
  productsError: string | null
}

const CreateReferralDialog: React.FC<CreateReferralDialogProps> = ({
  open,
  onOpenChange,
  onCreate,
  onGenerate,
  loading,
  form,
  onFormChange,
  roles,
  products,
  rbacLoading,
  rbacError,
  productsLoading,
  productsError,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="flex-shrink-0 text-left">
          <DialogTitle className="text-base">Create Referral Code</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Create a referral code for new user registration.
          </DialogDescription>
        </DialogHeader>

        {/* Form Container */}
        <div className="flex-1 flex flex-col min-h-0 mt-2">
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 px-1 pb-4">
            <div className="space-y-2 pr-1">
              <Label htmlFor="referral-code" className="text-sm font-medium">
                Referral Code *
              </Label>
              <div className="flex space-x-2">
                <Input
                  id="referral-code"
                  value={form.code}
                  onChange={(e) =>
                    onFormChange({ ...form, code: e.target.value })
                  }
                  placeholder="Enter or generate code"
                  disabled={loading}
                  className="text-base sm:text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerate}
                  disabled={loading}
                  className="shrink-0"
                >
                  Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Users will use this code to register their own account.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-1">
              <div className="space-y-2">
                <Label htmlFor="expires-days" className="text-sm font-medium">
                  Code Expires (days)
                </Label>
                <Input
                  id="expires-days"
                  type="number"
                  value={form.expires_days}
                  onChange={(e) =>
                    onFormChange({
                      ...form,
                      expires_days: parseInt(e.target.value) || 7,
                    })
                  }
                  min="1"
                  max="365"
                  disabled={loading}
                  className="text-base sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="work-duration-days"
                  className="text-sm font-medium"
                >
                  Access Duration (days)
                </Label>
                <Input
                  id="work-duration-days"
                  type="number"
                  value={form.work_duration_days}
                  onChange={(e) =>
                    onFormChange({
                      ...form,
                      work_duration_days: parseInt(e.target.value) || 7,
                    })
                  }
                  min="1"
                  max="365"
                  disabled={loading}
                  className="text-base sm:text-sm"
                />
              </div>
            </div>

            <div className="space-y-2 pr-1">
              <Label htmlFor="token-balance" className="text-sm font-medium">
                Token Balance
              </Label>
              <Input
                id="token-balance"
                type="number"
                value={form.token_balance}
                onChange={(e) =>
                  onFormChange({
                    ...form,
                    token_balance: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
                disabled={loading}
                className="text-base sm:text-sm"
              />
            </div>

            <div className="space-y-2 pr-1">
              <Label className="text-sm font-medium">RBAC Role *</Label>
              {rbacLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Spinner className="h-4 w-4 animate-spin" />
                  Loading roles...
                </div>
              ) : rbacError ? (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">Error: {rbacError}</div>
              ) : (
                <Select
                  value={form.selected_rbac_role?.toString() || ""}
                  onValueChange={(value) =>
                    onFormChange({
                      ...form,
                      selected_rbac_role: value ? parseInt(value) : null,
                    })
                  }
                  disabled={loading}
                >
                  <SelectTrigger className="w-full text-base sm:text-sm">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((role) => role.name !== "client")
                      .map((role) => (
                        <SelectItem key={role.id} value={role.id.toString()}>
                          {role.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2 pr-1">
              <Label className="text-sm font-medium">Product Access</Label>
              {productsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Spinner className="h-4 w-4 animate-spin" />
                  Loading products...
                </div>
              ) : productsError ? (
                <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">Error: {productsError}</div>
              ) : (
                <div className="border rounded-md bg-card">
                  <div className="max-h-[180px] overflow-y-auto p-1 space-y-1">
                    {products.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">No products available</div>
                    ) : (
                      products.map((product) => (
                        <div 
                          key={product.id} 
                          className="flex items-start space-x-3 p-2 hover:bg-accent/50 rounded-sm transition-colors cursor-pointer"
                          onClick={() => {
                            if (!loading) {
                              const isSelected = form.selected_products.includes(
                                product.id
                              )
                              if (isSelected) {
                                onFormChange({
                                  ...form,
                                  selected_products: form.selected_products.filter(
                                    (id) => id !== product.id
                                  ),
                                })
                              } else {
                                onFormChange({
                                  ...form,
                                  selected_products: [
                                    ...form.selected_products,
                                    product.id,
                                  ],
                                })
                              }
                            }
                          }}
                        >
                          <Checkbox
                            id={`referral-code-product-${product.id}`}
                            checked={form.selected_products.includes(product.id)}
                            onCheckedChange={() => {}} // Handled by parent div click
                            disabled={loading}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <Label 
                              htmlFor={`referral-code-product-${product.id}`} 
                              className="text-sm font-medium cursor-pointer"
                              onClick={(e) => e.stopPropagation()} // Prevent double toggle
                            >
                              {sanitizeString(product.name)}
                            </Label>
                            {product.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {sanitizeString(product.description)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="flex-shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-4 border-t mt-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={onCreate}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Referral Code"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CreateReferralDialog