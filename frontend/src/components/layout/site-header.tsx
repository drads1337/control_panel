import {
  LogOut,
  LayoutDashboard,
  Settings,
  // Monitor, // Temporarily hidden
  Shield,
  Webhook,
  FileText,
  Users,
  Settings2,
  Menu,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { useState } from "react"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { SearchBar } from "@/components/ui/search-bar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuthContext } from "@/app/providers/auth-provider"
import { getProject } from "@/entities/project"
import { cn } from "@/lib/utils"
import lightLogo from "@/assets/light-logo.png"
import darkLogo from "@/assets/dark-logo.png"
import { NotificationBell } from "./NotificationBell"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

interface SiteHeaderProps {
  title?: string
}

const navigationItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/management-page", label: "Management", icon: Settings },
  { path: "/users", label: "Users", icon: Users },
  // { path: "/remote-control", label: "Remote Control", icon: Monitor }, // Temporarily hidden
  { path: "/security", label: "Security", icon: Shield },
  { path: "/webhooks", label: "Webhooks", icon: Webhook },
  { path: "/logs", label: "Logs", icon: FileText },
  { path: "/project-settings", label: "Project Settings", icon: Settings2 },
]

export function SiteHeader({ title = "Dashboard" }: SiteHeaderProps) {
  const { logout, user } = useAuthContext()
  const location = useLocation()
  const { toggleSidebar } = useSidebar()
  const { resolvedTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const { data: project } = useQuery({
    queryKey: ['project', user?.project_id],
    queryFn: () => user?.project_id ? getProject(user.project_id) : null,
    enabled: !!user?.project_id,
    staleTime: 5 * 60 * 1000,
  })
  
  const projectName = project?.name || title
  const logoImage = resolvedTheme === "dark" ? darkLogo : lightLogo

  const handleLogout = async () => {
    await logout()
  }

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
    } else if (user?.first_name) {
      return user.first_name.charAt(0).toUpperCase()
    } else if (user?.last_name) {
      return user.last_name.charAt(0).toUpperCase()
    } else if (user?.username) {
      return user.username.charAt(0).toUpperCase()
    }
    return "U"
  }

  const getAvatarUrl = () => {
    if (!user?.avatar) return undefined
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}/uploads/avatars/${user.avatar}`
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-11 items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-1.5 sm:gap-2 mr-2 sm:mr-4 min-w-0">
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center rounded-md hover:bg-accent/50 p-1 transition-colors flex-shrink-0"
            >
              <img 
                src={logoImage} 
                alt="Logo" 
                className="h-5 w-5 sm:h-6 sm:w-6 object-contain"
              />
            </button>
            <Separator orientation="vertical" className="h-3 sm:h-3.5 self-end mb-0.5 opacity-50" />
            <h1 className="text-xs sm:text-sm font-semibold tracking-tight truncate">
              {projectName}
            </h1>
          </div>

          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden h-7 w-7 p-0"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="text-left">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 mt-6">
                {navigationItems.map((item) => {
                  const isActive = location.pathname === item.path
                  const Icon = item.icon
                  
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Navigation Pills - Desktop */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar mask-linear-fade flex-1 min-w-0">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.path
              const Icon = item.icon
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ease-in-out border border-transparent whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]" // Активная: Контрастная, с легкой тенью
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50" // Неактивная: Прозрачная
                  )}
                >
                  <Icon className={cn("h-3 w-3", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

        {/* Search Input */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2 min-w-0">
          <SearchBar 
            variant="inline"
            placeholder="Search..."
            className="hidden lg:flex"
          />

          {/* Right Actions */}
          <div className="flex items-center gap-0.5 sm:gap-1 pl-2 sm:pl-4 bg-gradient-to-l from-background via-background to-transparent">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notifications */}
            <NotificationBell />

            {/* Profile Avatar */}
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-6 w-6 sm:h-7 sm:w-7 p-0"
              title="Profile"
            >
              <Link to="/profile">
                <Avatar className="h-6 w-6 sm:h-7 sm:w-7">
                  <AvatarImage src={getAvatarUrl()} alt={user?.username || "User"} />
                  <AvatarFallback className="text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </Button>

            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}