"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import {
  Archive,
  Bot,
  Box,
  Cloud,
  Database,
  FileText,
  Folder,
  Grid3x3,
  HardDrive,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
  Package,
  Plus,
  Search,
  Server,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// --- Types ---

type Scope = "agent" | "product"
type ViewMode = "list" | "grid"
type FileCategory =
  | "folder"
  | "document"
  | "image"
  | "database"
  | "config"
  | "installer"

interface FileItem {
  id: string
  name: string
  date: string
  type: string
  category: FileCategory
  size: string
}

interface ScopeItem {
  id: number
  name: string
}

// --- Constants ---

const MOCK_FILES: FileItem[] = [
  {
    id: "1",
    name: "Assets",
    date: "Oct 23, 2024",
    type: "Folder",
    category: "folder",
    size: "-",
  },
  {
    id: "2",
    name: "Reports",
    date: "Oct 20, 2024",
    type: "Folder",
    category: "folder",
    size: "-",
  },
  {
    id: "3",
    name: "Logs_Archive",
    date: "Sep 30, 2024",
    type: "Folder",
    category: "folder",
    size: "-",
  },
  {
    id: "4",
    name: "config_v2.json",
    date: "Oct 24, 2024",
    type: "JSON",
    category: "config",
    size: "24 KB",
  },
  {
    id: "5",
    name: "error.log",
    date: "Oct 22, 2024",
    type: "Text",
    category: "document",
    size: "1.2 MB",
  },
  {
    id: "6",
    name: "setup.msi",
    date: "Oct 21, 2024",
    type: "Installer",
    category: "installer",
    size: "156 MB",
  },
  {
    id: "7",
    name: "dump.png",
    date: "Oct 19, 2024",
    type: "Image",
    category: "image",
    size: "2.4 MB",
  },
  {
    id: "8",
    name: "db.sql",
    date: "Oct 18, 2024",
    type: "Database",
    category: "database",
    size: "450 MB",
  },
]

// --- Utilities ---

const getFileIcon = (category: FileCategory, size: "sm" | "lg" = "sm") => {
  const baseClass = size === "sm" ? "size-4" : "size-6"
  switch (category) {
    case "folder":
      return <Folder className={cn(baseClass, "text-amber-500 fill-amber-500/20")} />
    case "image":
      return <ImageIcon className={cn(baseClass, "text-emerald-500")} />
    case "database":
      return <Database className={cn(baseClass, "text-rose-500")} />
    case "installer":
      return <Package className={cn(baseClass, "text-purple-500")} />
    case "config":
      return <Settings2 className={cn(baseClass, "text-slate-500")} />
    default:
      return <FileText className={cn(baseClass, "text-blue-500")} />
  }
}

export default function FileManager() {
  const [scope, setScope] = useState<Scope>("agent")
  const [selectedId, setSelectedId] = useState<number | null>(1)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [searchQuery, setSearchQuery] = useState("")

  const items = useMemo(
    () => [
      { id: 1, name: "Agent-Alpha" },
      { id: 2, name: "Agent-Beta" },
      { id: 3, name: "Agent-Gamma" },
    ],
    []
  )

  const selectedName = useMemo(
    () => items.find((i) => i.id === selectedId)?.name || "Select",
    [selectedId, items]
  )

  return (
    <div className="flex flex-col gap-4 w-full h-[600px]">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 h-full">
        {/* --- Sidebar --- */}
        <div className="flex flex-col h-full border rounded-lg bg-background shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2.5 border-b bg-muted/30">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Explorer
              </span>
            </div>
            <Tabs
              value={scope}
              onValueChange={(v) => setScope(v as Scope)}
              className="w-full"
            >
              <TabsList className="h-8 w-full p-0.5 bg-muted/50 grid grid-cols-2">
                <TabsTrigger
                  value="agent"
                  className="h-7 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5"
                >
                  <Bot className="size-3" />
                  <span>Agents</span>
                </TabsTrigger>
                <TabsTrigger
                  value="product"
                  className="h-7 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm flex items-center gap-1.5"
                >
                  <Box className="size-3" />
                  <span>Products</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Context Items */}
              <div className="space-y-0.5 mb-3">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {scope === "agent" ? "Active Agents" : "Products"}
                </div>
                {items.map((item) => (
                  <Button
                    key={item.id}
                    variant={selectedId === item.id ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "w-full justify-start h-8 text-xs px-2.5 font-normal rounded-md",
                      selectedId === item.id 
                        ? "bg-secondary font-medium shadow-sm" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => setSelectedId(item.id)}
                  >
                    {scope === "agent" ? (
                      <Bot className={cn(
                        "size-3.5 mr-2",
                        selectedId === item.id ? "text-foreground" : "text-muted-foreground"
                      )} />
                    ) : (
                      <Box className={cn(
                        "size-3.5 mr-2",
                        selectedId === item.id ? "text-foreground" : "text-muted-foreground"
                      )} />
                    )}
                    <span className="truncate">{item.name}</span>
                  </Button>
                ))}
              </div>

              <Separator className="my-2" />

              {/* Places */}
              <div className="space-y-0.5">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Locations
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs px-2.5 font-normal rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <HardDrive className="size-3.5 mr-2" />
                  <span>Local Drive</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs px-2.5 font-normal rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <Cloud className="size-3.5 mr-2" />
                  <span>Cloud Storage</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs px-2.5 font-normal rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                >
                  <Trash2 className="size-3.5 mr-2" />
                  <span>Recycle Bin</span>
                </Button>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t bg-muted/20">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px]">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Server className="size-3 text-muted-foreground" />
                  <span>Storage</span>
                </span>
                <span className="text-muted-foreground">75% used</span>
              </div>
              <Progress value={75} className="h-1.5" />
            </div>
          </div>
        </div>

        {/* --- Main Content --- */}
        <div className="flex flex-col h-full min-w-0 border rounded-lg bg-background shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background h-[52px] shrink-0">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {selectedName}
                <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-normal text-muted-foreground">
                  Read Only
                </Badge>
              </div>
              <div className="flex items-center text-[10px] text-muted-foreground">
                <Home className="size-3 mr-1" />
                <span className="mx-1">/</span>
                <span>Root</span>
                <span className="mx-1">/</span>
                <span className="text-foreground font-medium">Documents</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  className="h-7 w-[180px] text-xs pl-7 bg-muted/30 border-muted-foreground/20 focus-visible:bg-background"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Separator orientation="vertical" className="h-4" />
              <Tabs
                value={viewMode}
                onValueChange={(v) => setViewMode(v as ViewMode)}
                className="w-auto"
              >
                <TabsList className="h-7 p-0.5 bg-muted/50">
                  <TabsTrigger
                    value="list"
                    className="h-6 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <ListIcon className="size-3.5" />
                  </TabsTrigger>
                  <TabsTrigger
                    value="grid"
                    className="h-6 px-2 text-[10px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <LayoutGrid className="size-3.5" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button size="sm" className="h-7 text-xs px-2.5 ml-1">
                <Upload className="size-3 mr-1.5" /> Upload
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto bg-muted/5">
            {viewMode === "list" ? (
              <Table>
                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                  <TableRow className="h-9 hover:bg-transparent border-b-muted-foreground/10">
                    <TableHead className="w-[40%] text-xs font-medium pl-4">Name</TableHead>
                    <TableHead className="text-xs font-medium">Date Modified</TableHead>
                    <TableHead className="text-xs font-medium">Type</TableHead>
                    <TableHead className="text-xs font-medium text-right pr-4">Size</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MOCK_FILES.map((file) => (
                    <TableRow
                      key={file.id}
                      className="group h-9 border-b-muted-foreground/5 hover:bg-background hover:shadow-sm transition-all"
                    >
                      <TableCell className="py-2 pl-4">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(file.category)}
                          <span className="text-xs font-medium text-foreground">
                            {file.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {file.date}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="secondary"
                          className="h-5 px-1.5 text-[10px] font-normal text-muted-foreground bg-muted/50 border-muted-foreground/10"
                        >
                          {file.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs text-right font-mono text-muted-foreground pr-4">
                        {file.size}
                      </TableCell>
                      <TableCell className="py-2 text-right pr-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreVertical className="size-3.5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem className="text-xs">Open</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs">Share</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-xs text-red-600">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {MOCK_FILES.map((file) => (
                  <Card
                    key={file.id}
                    className="group border-muted-foreground/10 shadow-sm hover:shadow-md transition-all cursor-pointer bg-background"
                  >
                    <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                      <div className="size-12 rounded-lg bg-muted/30 flex items-center justify-center mb-1 group-hover:bg-muted/50 transition-colors">
                        {getFileIcon(file.category, "lg")}
                      </div>
                      <div className="space-y-0.5 w-full">
                        <p className="text-xs font-medium truncate w-full" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{file.size}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="h-8 border-t bg-background flex items-center justify-between px-4 text-[10px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-4">
              <span>{MOCK_FILES.length} items</span>
              <Separator orientation="vertical" className="h-3" />
              <span>{MOCK_FILES.filter(f => f.id).length} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex size-1.5 rounded-full bg-emerald-500" />
              <span>Syncthing active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}