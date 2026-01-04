import {
  LogOut,
  LayoutDashboard,
  Settings,
  // Monitor, // Temporarily hidden
  Shield,
  Webhook,
  FileText,
  Search,
  User,
  Users,
  Settings2,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { Separator } from "@/components/ui/separator"
import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { useAuthContext } from "@/app/providers/auth-provider"
import { getProject } from "@/entities/project"
import { cn } from "@/lib/utils"
import lightLogo from "@/assets/light-logo.png"
import darkLogo from "@/assets/dark-logo.png"

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

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 lg:px-6 gap-4">
        
        {/* Logo & Title */}
        <div className="flex items-center gap-2 mr-4">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center rounded-md hover:bg-accent/50 p-1 transition-colors"
          >
            <img 
              src={logoImage} 
              alt="Logo" 
              className="h-7 w-7 object-contain"
            />
          </button>
          <Separator orientation="vertical" className="h-5 mx-1 opacity-50" />
          <h1 className="text-sm font-semibold tracking-tight">
            {projectName}
          </h1>
        </div>

        {/* Navigation Pills */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-linear-fade">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-in-out border border-transparent",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]" // Активная: Контрастная, с легкой тенью
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50" // Неактивная: Прозрачная
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Search Input */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden md:flex">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="h-8 w-[200px] pl-8 pr-2 text-sm"
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 pl-4 bg-gradient-to-l from-background via-background to-transparent">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Profile Button */}
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              title="Profile"
            >
              <Link to="/profile">
                <User className="h-4 w-4" />
              </Link>
            </Button>

            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}