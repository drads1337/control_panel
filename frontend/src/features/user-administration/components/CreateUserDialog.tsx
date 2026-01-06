"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Spinner } from "@/components/ui/spinner"
import { enhancedApi, getErrorMessage } from "@/shared/api/enhanced-client"
import { createUser } from "@/entities/user/api/user"
import { getProducts } from "@/entities/product/api/product"
import { type Product } from "@/entities/product"
import { toast } from "sonner"
import {
  createUserSchema,
  type CreateUserInput,
} from "@/lib/validations/user"
import { measurePerformance } from "@/shared/lib/sentry-config"
import { sanitizeString } from "@/lib/sanitization"
import { cn } from '@/lib/utils.ts'

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

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      username: "",
      password: "",
      first_name: "",
      last_name: "",
      email: "",
      token_balance: 0,
      work_duration_days: 7,
      selected_products: [],
      selected_rbac_role: undefined,
    },
  })

  const [loading, setLoading] = useState(false)
  const [rbacLoading, setRbacLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)

  const [rbacError, setRbacError] = useState<string | null>(null)
  const [productsError, setProductsError] = useState<string | null>(null)

  const [roles, setRoles] = useState<Role[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const loadRoles = useCallback(async () => {
    try {
      setRbacLoading(true)
      setRbacError(null)
      const response = await enhancedApi.get("/api/rbac/roles")
      setRoles(response.data.roles || [])
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      setRbacError(errorMessage)
    } finally {
      setRbacLoading(false)
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true)
      setProductsError(null)
      const response = await getProducts("all")
      setProducts(response.products || [])
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      setProductsError(errorMessage)
    } finally {
      setProductsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadRoles()
      loadProducts()
    }
  }, [open, loadRoles, loadProducts])

  useEffect(() => {
    if (!open) {
      form.reset({
        username: "",
        password: "",
        first_name: "",
        last_name: "",
        email: "",
        token_balance: 0,
        work_duration_days: 7,
        selected_products: [],
        selected_rbac_role: undefined,
      })
      setRbacError(null)
      setProductsError(null)
    }
  }, [open, form])

  const handleCreate = form.handleSubmit(
    async (data) => {
      try {
        setLoading(true)

        const userData = {
          username: data.username,
          password: data.password,
          first_name: data.first_name || undefined,
          last_name: data.last_name || undefined,
          email: data.email || undefined,
          token_balance: data.token_balance,
          work_duration_days: data.work_duration_days,
          product_ids: Array.isArray(data.selected_products)
            ? data.selected_products
            : [],
          rbac_role_ids: data.selected_rbac_role
            ? [data.selected_rbac_role]
            : [],
        }

        await measurePerformance(
          "user_creation",
          () => createUser(userData),
          {
            has_email: !!data.email,
            has_products: data.selected_products.length > 0,
            has_role: !!data.selected_rbac_role,
            token_balance: data.token_balance,
          }
        )

        toast.success("Employee created successfully")
        onOpenChange(false)
        onSuccess()
      } catch (error) {
        const errorMessage = getErrorMessage(error)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    (errors) => {
      toast.error("Please fill in all required fields")
    }
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[420px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 pb-1 bg-muted/5">
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold">
              Create Employee
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a new employee in the system.
            </DialogDescription>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleCreate} className="flex flex-col">
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Username *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter username"
                          disabled={loading}
                          className="h-8 text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Password *</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Min 8 chars"
                          disabled={loading}
                          className="h-8 text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">First Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="First name"
                            disabled={loading}
                            className="h-8 text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Last Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Last name"
                            disabled={loading}
                            className="h-8 text-xs"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter email"
                          disabled={loading}
                          className="h-8 text-xs"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="token_balance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Token Balance</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            disabled={loading}
                            className="h-8 text-xs"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="work_duration_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Work Duration (days)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            disabled={loading}
                            className="h-8 text-xs"
                            {...field}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="selected_rbac_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">RBAC Role *</FormLabel>
                      {rbacLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-md">
                          <Spinner className="h-3 w-3 animate-spin" />
                          Loading roles...
                        </div>
                      ) : rbacError ? (
                        <div className="text-xs text-red-500 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-md">Error: {rbacError}</div>
                      ) : (
                        <FormControl>
                          <Select
                            value={field.value ? field.value.toString() : ""}
                            onValueChange={(value) => {
                              const numValue = parseInt(value, 10)
                              if (!isNaN(numValue) && numValue > 0) {
                                field.onChange(numValue)
                                setTimeout(() => form.trigger("selected_rbac_role"), 0)
                              }
                            }}
                            disabled={loading}
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                              {roles
                                .filter((role) => role.name !== "client")
                                .map((role) => (
                                  <SelectItem
                                    key={role.id}
                                    value={role.id.toString()}
                                    className="text-xs"
                                  >
                                    {role.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="selected_products"
                  render={({ field }) => {
                    const handleProductToggle = (productId: number) => {
                      if (loading) return
                      const currentProducts = Array.isArray(field.value)
                        ? field.value
                        : []
                      const normalizedProductId =
                        typeof productId === "number"
                          ? productId
                          : parseInt(String(productId), 10)
                      const normalizedCurrent = currentProducts.map((id) =>
                        typeof id === "number" ? id : parseInt(String(id), 10)
                      )
                      const isSelected = normalizedCurrent.includes(
                        normalizedProductId
                      )

                      if (isSelected) {
                        field.onChange(
                          normalizedCurrent.filter(
                            (id) => id !== normalizedProductId
                          )
                        )
                      } else {
                        field.onChange([...normalizedCurrent, normalizedProductId])
                      }
                    }

                    const isProductSelected = (productId: number | string) => {
                      const currentProducts = Array.isArray(field.value)
                        ? field.value
                        : []
                      const normalizedProductId =
                        typeof productId === "number"
                          ? productId
                          : parseInt(String(productId), 10)
                      return currentProducts
                        .map((id) =>
                          typeof id === "number" ? id : parseInt(String(id), 10)
                        )
                        .includes(normalizedProductId)
                    }

                    return (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Product Access</FormLabel>
                        {productsLoading ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded-md">
                            <Spinner className="h-3 w-3 animate-spin" />
                            Loading products...
                          </div>
                        ) : productsError ? (
                          <div className="text-xs text-red-500 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-md">Error: {productsError}</div>
                        ) : (
                          <div className="max-h-[200px] overflow-y-auto border rounded-md bg-muted/10 p-1">
                            {products.length === 0 ? (
                              <div className="text-center p-4 text-xs text-muted-foreground">No products available</div>
                            ) : (
                              products.map((product) => {
                                const productId =
                                  typeof product.id === "number"
                                    ? product.id
                                    : parseInt(String(product.id), 10)
                                const selected = isProductSelected(productId)

                                return (
                                  <div
                                    key={product.id}
                                    className="flex items-start space-x-2 p-2 hover:bg-accent/50 rounded transition-colors"
                                  >
                                    <Checkbox
                                      id={`product-${product.id}`}
                                      checked={selected}
                                      onCheckedChange={() => {
                                        handleProductToggle(productId)
                                      }}
                                      disabled={loading}
                                      className="mt-1"
                                    />
                                    <Label
                                      htmlFor={`product-${product.id}`}
                                      className="text-xs flex-1 cursor-pointer"
                                    >
                                      <div>
                                        <div className="font-medium">
                                          {sanitizeString(product.name)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                          {product.description
                                            ? sanitizeString(product.description)
                                            : "No description"}
                                        </div>
                                      </div>
                                    </Label>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || rbacLoading || productsLoading}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || rbacLoading || productsLoading}
                className="h-8 text-xs min-w-[80px]"
              >
                {loading ? (
                  <Spinner className="size-3" />
                ) : (
                  "Create Employee"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateUserDialog