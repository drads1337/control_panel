import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthContext } from '@/app/providers/auth-provider'
import { PageErrorBoundary } from '@/widgets/page-error-boundary'
import { Footer } from '@/widgets/footer'
import { 
  LayoutDashboard, 
  Key, 
  Users, 
  Terminal, 
  Shield, 
  Webhook, 
  FileText,
  Search,
  Bell,
  LogOut
} from 'lucide-react'
import { Spinner } from '@/shared/ui/components/spinner'

// --- 1. CONFIGURATION (Single Source of Truth) ---
// Добавлять новые страницы теперь нужно только здесь.
const NAV_CONFIG = [
  { 
    path: 'dashboard', 
    label: 'Dashboard', 
    Icon: LayoutDashboard, 
    title: 'Executive Dashboard', 
    desc: 'Briefing: Overview of system performance, licenses, and agents.' 
  },
  { 
    path: 'management', 
    label: 'Management', 
    Icon: Key, 
    title: 'Management', 
    desc: 'Manage system resources and administrative keys.' 
  },
  { 
    path: 'users', 
    label: 'Users', 
    Icon: Users, 
    title: 'Users Management', 
    desc: 'User administration and role assignments.' 
  },
  { 
    path: 'remote', 
    label: 'Remote Control', 
    Icon: Terminal, 
    title: 'Remote Control', 
    desc: 'Direct terminal access to agents.' 
  },
  { 
    path: 'security', 
    label: 'Security', 
    Icon: Shield, 
    title: 'Security Audit', 
    desc: 'Security logs and breach attempts.' 
  },
  { 
    path: 'webhooks', 
    label: 'Webhooks', 
    Icon: Webhook, 
    title: 'Webhooks', 
    desc: 'Event subscription management.' 
  },
  { 
    path: 'logs', 
    label: 'Logs', 
    Icon: FileText, 
    title: 'System Logs', 
    desc: 'Monitor and analyze system activity and user actions.' 
  },
] as const

// --- 2. UI HELPERS (Atoms) ---

const UserAvatar = ({ username, className = "w-9 h-9" }: { username?: string, className?: string }) => {
  const initials = username ? username.substring(0, 2).toUpperCase() : 'U'
  return (
    <div className={`${className} rounded bg-primary flex items-center justify-center text-background-dark font-bold text-sm font-display shadow-glow shrink-0`}>
      {initials}
    </div>
  )
}

const SystemStatusBadge = () => (
  <div className="flex flex-col items-end gap-2">
    <div className="flex items-center gap-2 bg-surface-dark/50 border border-border-dark px-3 py-1.5 rounded-sm">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest">System Optimal</span>
    </div>
    <span className="text-[10px] font-mono text-text-secondary-dark opacity-50 uppercase tracking-widest">Updated: Just now</span>
  </div>
)

// --- 3. SUB-COMPONENTS ---

const TopNavigation = ({ user, onLogout }: { user: any, onLogout: () => void }) => {
  const projectName = user?.username?.substring(0, 10) || 'YMPHE66H64'

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 whitespace-nowrap ${
      isActive
        ? 'bg-surface-dark/80 text-white shadow-sm border border-border-dark'
        : 'text-text-secondary-dark hover:text-text-primary-dark hover:bg-white/5 border border-transparent'
    }`

  return (
    <nav 
      className="h-16 border-b border-border-dark/50 bg-[#0F1115]/80 flex items-center justify-between px-6 shrink-0 fixed top-0 left-0 right-0 z-50"
      style={{
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {/* Left: Brand & Menu */}
      <div className="flex items-center gap-8 overflow-hidden">
        <div className="flex items-center gap-3 shrink-0">
          <UserAvatar username={user?.username} />
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-bold text-white tracking-wide font-display">{projectName}</span>
            <span className="text-[10px] text-text-secondary-dark uppercase tracking-wider font-mono">Enterprise</span>
          </div>
        </div>

        <div className="h-6 w-px bg-border-dark/60 shrink-0"></div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right">
          {NAV_CONFIG.map((item) => (
            <NavLink key={item.path} to={`/${item.path}`} className={getNavLinkClass}>
              <item.Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-5 shrink-0 pl-4">
        {/* Search */}
        <div className="relative group w-64 hidden md:block">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
          </span>
          <input 
            className="w-full bg-surface-dark border border-border-dark rounded pl-10 pr-10 py-1.5 text-xs text-text-primary-dark focus:ring-1 focus:ring-primary focus:border-primary placeholder-text-secondary-dark transition-all outline-none" 
            placeholder="Search system..." 
            type="text" 
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <span className="text-[10px] text-text-secondary-dark border border-border-dark bg-background-dark/50 rounded px-1.5 py-0.5 font-mono">⌘K</span>
          </div>
        </div>

        {/* Notifications */}
        <button className="text-text-secondary-dark hover:text-white transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0.5 w-2 h-2 bg-primary rounded-full border-2 border-[#0F1115]"></span>
        </button>

        {/* Profile Dropdown Trigger */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center p-0.5 cursor-pointer hover:border-primary transition-colors">
            <UserAvatar username={user?.username} className="w-full h-full text-[10px]" />
          </div>
          <span className="text-xs font-medium text-text-secondary-dark hover:text-white cursor-pointer transition-colors hidden sm:inline-block">
            {user?.roles?.[0] || 'Admin'}
          </span>
          <button onClick={onLogout} className="text-text-secondary-dark hover:text-white transition-colors ml-1" title="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  )
}

const PageHeader = () => {
  const location = useLocation()
  
  // Автоматический поиск активной конфигурации
  const currentPath = location.pathname.split('/').filter(Boolean)[0] || 'dashboard'
  const activePage = NAV_CONFIG.find(c => c.path === currentPath) || NAV_CONFIG[0]

  return (
    <header className="flex items-end justify-between border-b border-border-dark/60 pb-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold text-white tracking-tight font-display">
            {activePage.title}
          </h1>
          <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider border border-white/10">
            Live
          </span>
        </div>
        <p className="text-text-secondary-dark text-sm font-medium">
          {activePage.desc}
        </p>
      </div>
      <SystemStatusBadge />
    </header>
  )
}

// --- 4. MAIN LAYOUT ---

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthContext()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [prevPath, setPrevPath] = useState(location.pathname)

  useEffect(() => {
    if (location.pathname !== prevPath) {
      setIsTransitioning(true)
      const timer = setTimeout(() => {
        setIsTransitioning(false)
        setPrevPath(location.pathname)
      }, 200) // Small delay for smooth transition
      return () => clearTimeout(timer)
    }
  }, [location.pathname, prevPath])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background-dark text-text-primary-dark font-body flex flex-col">
      
      <TopNavigation user={user} onLogout={handleLogout} />

      {/* Main Content (with padding-top for fixed header) */}
      <main className="flex-1 overflow-y-auto pt-16">
        <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8">
          
          <PageHeader />

          <div 
            key={location.pathname}
            className={`
              transition-all duration-300 ease-in-out
              ${isTransitioning 
                ? 'opacity-0 translate-y-2' 
                : 'opacity-100 translate-y-0'
              }
            `}
          >
            {isTransitioning ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                  <Spinner size="lg" />
                  <span className="text-text-secondary-dark text-sm">Loading...</span>
                </div>
              </div>
            ) : (
              <PageErrorBoundary pageName="Page">
                <Outlet />
              </PageErrorBoundary>
            )}
          </div>
          
          <Footer />
          
        </div>
      </main>
    </div>
  )
}