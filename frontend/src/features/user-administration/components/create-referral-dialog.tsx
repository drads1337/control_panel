"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Create Referral Code
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a referral code for new user registration.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="referral-code" className="text-xs font-medium">
                Referral Code *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="referral-code"
                  value={form.code}
                  onChange={(e) =>
                    onFormChange({ ...form, code: e.target.value })
                  }
                  placeholder="Enter or generate code"
                  disabled={loading}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onGenerate}
                  disabled={loading}
                  className="h-8 text-xs shrink-0"
                >
                  Generate
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Users will use this code to register their own account.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expires-days" className="text-xs font-medium">
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
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="work-duration-days"
                  className="text-xs font-medium"
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
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="token-balance" className="text-xs font-medium">
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
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">RBAC Role *</Label>
              {rbacLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-md">
                  <Spinner className="h-3 w-3 animate-spin" />
                  Loading roles...
                </div>
              ) : rbacError ? (
                <div className="text-xs text-red-500 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-md">Error: {rbacError}</div>
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
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {roles
                      .filter((role) => role.name !== "client")
                      .map((role) => (
                        <SelectItem key={role.id} value={role.id.toString()} className="text-xs">
                          {role.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Product Access</Label>
              {productsLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-md">
                  <Spinner className="h-3 w-3 animate-spin" />
                  Loading products...
                </div>
              ) : productsError ? (
                <div className="text-xs text-red-500 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-md">Error: {productsError}</div>
              ) : (
                <div className="border rounded-md bg-muted/10">
                  <div className="max-h-[180px] overflow-y-auto p-1">
                    {products.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">No products available</div>
                    ) : (
                      products.map((product) => (
                        <div 
                          key={product.id} 
                          className="flex items-start space-x-2 p-2 hover:bg-accent/50 rounded transition-colors cursor-pointer"
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
                              className="text-xs font-medium cursor-pointer"
                              onClick={(e) => e.stopPropagation()} // Prevent double toggle
                            >
                              {sanitizeString(product.name)}
                            </Label>
                            {product.description && (
                              <p className="text-[10px] text-muted-foreground truncate">
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
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onCreate}
            disabled={loading}
            className="h-8 text-xs min-w-[80px]"
          >
            {loading ? (
              <Spinner className="size-3" />
            ) : (
              "Create Referral Code"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CreateReferralDialog