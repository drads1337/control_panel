"use client"

import * as React from "react"
import { useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  TrendingUpIcon,
  TrendingDownIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ChevronDownIcon,
  PlusIcon,
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  MoreVerticalIcon,
  SearchIcon,
  UsersIcon,
  ShieldCheckIcon,
  BanIcon,
} from "lucide-react"
import { useUsersQuery } from "@/entities/user/model/queries"
import type { User } from "@/entities/user/model/types"
import { useEditUserDialog } from "./hooks/use-edit-user-dialog"
import { useCrudDialogs } from "@/shared/hooks/use-crud-dialogs"

import { toast } from "sonner"

const userSchema = z.object({
  id: z.union([z.number(), z.string()]),
  username: z.string(),
  email: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  roles: z.array(z.string()),
  token_balance: z.number(),
  keys_count: z.number(),
  active_keys: z.number(),
  expires_at: z.string().nullable(),
  last_login: z.string().nullable(),
  created_at: z.string().nullable(),
})

export function UsersPage() {
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined)
  const {
    users,
    loading,
    error,
    total,
    pages,
    currentPage,
    perPage,
    stats,
    statsLoading,
    setPage,
    setPerPage,
    setSearch: setSearchQuery,
    setRole,
    deleteUser,
    refetch,
  } = useUsersQuery({
    per_page: 20,
  })

  const { editDialogOpen, openEditDialog, closeEditDialog, selectedEntity } = useCrudDialogs<User>()
  const { handleUpdate, loading: updateLoading, form, setForm } = useEditUserDialog(
    selectedEntity,
    editDialogOpen,
    () => {
      closeEditDialog()
      refetch()
    }
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  const handleSearch = (value: string) => {
    setSearch(value)
    setSearchQuery(value)
  }

  const handleRoleFilter = (value: string) => {
    if (value === "all") {
      setRoleFilter(undefined)
      setRole(undefined)
    } else {
      setRoleFilter(value)
      setRole(value)
    }
  }

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return

    try {
      const userId = typeof userToDelete.id === 'string' ? parseInt(userToDelete.id, 10) : userToDelete.id
      if (!isNaN(userId) && userId > 0) {
        await deleteUser(userId)
        toast.success("User deleted successfully")
        setDeleteDialogOpen(false)
        setUserToDelete(null)
        refetch()
      } else {
        toast.error("Invalid user ID")
      }
    } catch (error) {
      toast.error("Failed to delete user")
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-3 py-3 md:gap-4 md:py-4">
          <SectionCards stats={stats} statsLoading={statsLoading} />
          <DataTable
            data={users}
            loading={loading}
            search={search}
            onSearch={handleSearch}
            roleFilter={roleFilter}
            onRoleFilter={handleRoleFilter}
            total={total}
            pages={pages}
            currentPage={currentPage}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
            onEdit={openEditDialog}
            onDelete={handleDeleteClick}
          />
        </div>
      </div>

      {editDialogOpen && selectedEntity && (
        <EditUserDialog
          open={editDialogOpen}
          onClose={closeEditDialog}
          user={selectedEntity}
          form={form}
          setForm={setForm}
          onUpdate={handleUpdate}
          loading={updateLoading}
        />
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user "{userToDelete?.username}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SectionCards({
  stats,
  statsLoading,
}: {
  stats: { total: number; active: number; blocked: number; admins: number } | null
  statsLoading: boolean
}) {
  const total = stats?.total || 0
  const active = stats?.active || 0
  const blocked = stats?.blocked || 0
  const admins = stats?.admins || 0

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-3 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs">Total Users</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {statsLoading ? "..." : total.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              <UsersIcon className="size-3" />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs pt-2">
          <div className="line-clamp-1 flex gap-1.5 font-medium">
            All registered users{" "}
            <UsersIcon className="size-3" />
          </div>
          <div className="text-muted-foreground">
            Total user accounts in the system
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs">Active Users</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {statsLoading ? "..." : active.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              <TrendingUpIcon className="size-3" />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs pt-2">
          <div className="line-clamp-1 flex gap-1.5 font-medium">
            Active accounts{" "}
            <CheckCircle2Icon className="size-3" />
          </div>
          <div className="text-muted-foreground">
            Users with valid access
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs">Blocked Users</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {statsLoading ? "..." : blocked.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              <BanIcon className="size-3" />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs pt-2">
          <div className="line-clamp-1 flex gap-1.5 font-medium">
            Expired or blocked{" "}
            <XCircleIcon className="size-3" />
          </div>
          <div className="text-muted-foreground">
            Users with expired access
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader className="pb-3">
          <CardDescription className="text-xs">Administrators</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums @[250px]/card:text-2xl">
            {statsLoading ? "..." : admins.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              <ShieldCheckIcon className="size-3" />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs pt-2">
          <div className="line-clamp-1 flex gap-1.5 font-medium">
            Admin accounts{" "}
            <ShieldCheckIcon className="size-3" />
          </div>
          <div className="text-muted-foreground">Users with admin privileges</div>
        </CardFooter>
      </Card>
    </div>
  )
}

const columns: ColumnDef<z.infer<typeof userSchema>>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          data-indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "username",
    header: "User",
    cell: ({ row }) => {
      const user = row.original
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username
      const isExpired = user.expires_at && new Date(user.expires_at) <= new Date()

      return (
        <div className="flex flex-col gap-0.5">
          <div className="font-medium text-sm">{fullName}</div>
          <div className="text-xs text-muted-foreground">{user.email || user.username}</div>
        </div>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: "roles",
    header: "Roles",
    cell: ({ row }) => {
      const roles = row.original.roles || []
      if (roles.length === 0) {
        return (
          <Badge variant="outline" className="text-muted-foreground px-1.5 text-xs h-5">
            No roles
          </Badge>
        )
      }
      return (
        <div className="flex gap-1 flex-wrap">
          {roles.slice(0, 2).map((role) => (
            <Badge key={role} variant="outline" className="text-muted-foreground px-1.5 text-xs h-5">
              {role}
            </Badge>
          ))}
          {roles.length > 2 && (
            <Badge variant="outline" className="text-muted-foreground px-1.5 text-xs h-5">
              +{roles.length - 2}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "token_balance",
    header: () => <div className="w-full text-right">Tokens</div>,
    cell: ({ row }) => (
      <div className="text-right text-sm tabular-nums">
        {row.original.token_balance.toLocaleString()}
      </div>
    ),
  },
  {
    accessorKey: "keys_count",
    header: () => <div className="w-full text-right">Keys</div>,
    cell: ({ row }) => (
      <div className="text-right text-sm tabular-nums">
        {row.original.keys_count} / {row.original.active_keys}
      </div>
    ),
  },
  {
    accessorKey: "expires_at",
    header: "Status",
    cell: ({ row }) => {
      const user = row.original
      const isExpired = user.expires_at && new Date(user.expires_at) <= new Date()
      const isActive = !user.expires_at || new Date(user.expires_at) > new Date()

      return (
        <Badge variant="outline" className="text-muted-foreground px-1.5 text-xs h-5">
          {isExpired ? (
            <>
              <XCircleIcon className="fill-red-500 dark:fill-red-400 size-3 mr-1" />
              Expired
            </>
          ) : isActive ? (
            <>
              <CheckCircle2Icon className="fill-green-500 dark:fill-green-400 size-3 mr-1" />
              Active
            </>
          ) : (
            "Unknown"
          )}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original
      return <UserActions user={user} onEdit={() => { }} onDelete={() => { }} />
    },
  },
]

function UserActions({
  user,
  onEdit,
  onDelete,
}: {
  user: User
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-muted text-muted-foreground flex size-7"
          size="icon"
        >
          <MoreVerticalIcon className="size-3.5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 text-xs">
        <DropdownMenuItem className="text-xs" onClick={onEdit}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="text-xs" onClick={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface DataTableProps {
  data: User[]
  loading: boolean
  search: string
  onSearch: (value: string) => void
  roleFilter: string | undefined
  onRoleFilter: (value: string) => void
  total: number
  pages: number
  currentPage: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  onEdit: (user: User) => void
  onDelete: (user: User) => void
}

function DataTable({
  data,
  loading,
  search,
  onSearch,
  roleFilter,
  onRoleFilter,
  total,
  pages,
  currentPage,
  perPage,
  onPageChange,
  onPerPageChange,
  onEdit,
  onDelete,
}: DataTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: data.map((user) => ({
      ...user,
      id: typeof user.id === 'string' ? parseInt(user.id, 10) || user.id : user.id,
    })),
    columns: columns.map((col) => {
      if (col.id === "actions") {
        return {
          ...col,
          cell: ({ row }: any) => (
            <UserActions
              user={row.original}
              onEdit={() => onEdit(row.original)}
              onDelete={() => onDelete(row.original)}
            />
          ),
        }
      }
      return col
    }),
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination: {
        pageIndex: currentPage - 1,
        pageSize: perPage,
      },
    },
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        const newPagination = updater({ pageIndex: currentPage - 1, pageSize: perPage })
        onPageChange(newPagination.pageIndex + 1)
        onPerPageChange(newPagination.pageSize)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: pages,
  })

  return (
    <Tabs
      value={roleFilter || "all"}
      onValueChange={onRoleFilter}
      className="w-full flex-col justify-start gap-4"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="role-selector" className="sr-only">
            Role
          </Label>
          <Select value={roleFilter || "all"} onValueChange={onRoleFilter}>
            <SelectTrigger
              className="flex w-fit h-7 text-xs @4xl/main:hidden"
              size="sm"
              id="role-selector"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="all" className="text-xs">All Roles</SelectItem>
              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
              <SelectItem value="employee" className="text-xs">Employee</SelectItem>
              <SelectItem value="client" className="text-xs">Client</SelectItem>
            </SelectContent>
          </Select>
          <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden h-8 **:data-[slot=badge]:size-4 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 **:data-[slot=tabs-trigger]:text-xs @4xl/main:flex">
            <TabsTrigger value="all">All Roles</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
            <TabsTrigger value="employee">Employee</TabsTrigger>
            <TabsTrigger value="client">Client</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-40 sm:w-64">
            <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDownIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-xs"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <PlusIcon className="size-3" />
            <span className="hidden lg:inline">Add User</span>
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-9">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan} className="text-xs py-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="h-9"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-xs py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-4">
        <div className="text-muted-foreground hidden flex-1 text-xs lg:flex">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-xs font-medium">
              Rows per page
            </Label>
            <Select
              value={`${perPage}`}
              onValueChange={(value) => {
                onPerPageChange(Number(value))
              }}
            >
              <SelectTrigger size="sm" className="w-20 h-7 text-xs" id="rows-per-page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top" className="text-xs">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`} className="text-xs">
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-xs font-medium">
            Page {currentPage} of {pages || 1}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-7 w-7 p-0 lg:flex"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeftIcon className="size-3" />
            </Button>
            <Button
              variant="outline"
              className="size-7"
              size="icon"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon className="size-3" />
            </Button>
            <Button
              variant="outline"
              className="size-7"
              size="icon"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pages}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="size-3" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-7 lg:flex"
              size="icon"
              onClick={() => onPageChange(pages)}
              disabled={currentPage >= pages}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRightIcon className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </Tabs>
  )
}

function EditUserDialog({
  open,
  onClose,
  user,
  form,
  setForm,
  onUpdate,
  loading,
}: {
  open: boolean
  onClose: () => void
  user: User
  form: any
  setForm: any
  onUpdate: () => void
  loading: boolean
}) {
  // This is a placeholder - the actual edit dialog should use the useEditUserDialog hook properly
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user information and permissions
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Edit user dialog implementation should be added here using the useEditUserDialog hook.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onUpdate} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
