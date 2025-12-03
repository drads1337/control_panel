import * as React from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import { Separator } from '@/components/ui/separator';

import {
  SidebarProvider,
  SidebarInset,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/animate-ui/components/radix/sidebar';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/animate-ui/primitives/radix/collapsible';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/animate-ui/components/radix/dropdown-menu';

import {
  AudioWaveform,
  BadgeCheck,
  Bell,
  ChevronRight,
  ChevronsUpDown,
  Command,
  CreditCard,
  GalleryVerticalEnd,
  LogOut,
  PieChart,
  Plus,
  Sparkles,
  Truck,
  Users,
  ClipboardList,
  Navigation,
  DollarSign,
  Wrench,
  Fuel,
  FileCheck,
  Route,
  BarChart3,
  Clock,
} from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';

import { Button } from '@/components/ui/button';
import { PanelLeftIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useIsMobile } from '@/hooks/use-mobile';
import { api, ApiError } from '@/lib/api';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ActivitySidebarProvider, RightSidebarTriggerWithSeparator } from './activity-sidebar';

const DATA = {
  user: {
    name: 'User',
    email: 'user@example.com',
    avatar: '',
  },
  teams: [
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
    {
      name: 'Evil Corp.',
      logo: Command,
      plan: 'Free',
    },
  ],
  navMain: [
    {
      title: 'Dashboard',
      url: '/',
      icon: PieChart,
      isActive: true,
      items: [],
    },
    {
      title: 'Fleet Management',
      url: '/fleet',
      icon: Truck,
      items: [
        {
          title: 'All Vehicles',
          url: '/fleet',
        },
        {
          title: 'Add Vehicle',
          url: '/fleet/new',
        },
      ],
    },
    {
      title: 'Driver Management',
      url: '/drivers',
      icon: Users,
      items: [
        {
          title: 'All Drivers',
          url: '/drivers',
        },
        {
          title: 'Add Driver',
          url: '/drivers/new',
        },
      ],
    },
    {
      title: 'Dispatching',
      url: '/dispatch',
      icon: ClipboardList,
      items: [
        {
          title: 'Dispatch Board',
          url: '/dispatch',
        },
        {
          title: 'All Trips',
          url: '/trips',
        },
        {
          title: 'New Trip',
          url: '/trips/new',
        },
      ],
    },
    {
      title: 'GPS Tracking',
      url: '/tracking',
      icon: Navigation,
      items: [],
    },
    {
      title: 'Financial',
      url: '/financial',
      icon: DollarSign,
      items: [
        {
          title: 'Overview',
          url: '/financial',
        },
        {
          title: 'Transactions',
          url: '/financial/transactions',
        },
        {
          title: 'Reports',
          url: '/financial/reports',
        },
      ],
    },
  ],
  phase2Nav: [
    {
      title: 'HOS / ELD',
      url: '/hos',
      icon: Clock,
      items: [],
    },
    {
      title: 'Route Optimization',
      url: '/routes',
      icon: Route,
      items: [],
    },
    {
      title: 'Analytics',
      url: '/analytics',
      icon: BarChart3,
      items: [],
    },
    {
      title: 'Maintenance',
      url: '/maintenance',
      icon: Wrench,
      items: [],
    },
    {
      title: 'Fuel Management',
      url: '/fuel',
      icon: Fuel,
      items: [],
    },
    {
      title: 'Compliance',
      url: '/compliance',
      icon: FileCheck,
      items: [],
    },
  ],
};

interface AppSidebarProps {
  children: React.ReactNode;
}

function MainSidebarTriggerButton({ 
  className, 
  onToggle 
}: { 
  className?: string;
  onToggle: () => void;
}) {
  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn('size-7', className)}
      onClick={onToggle}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

export const AppSidebar = ({ children }: AppSidebarProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [activeTeam, setActiveTeam] = React.useState(DATA.teams[0]);
  const [user, setUser] = React.useState(DATA.user);

  React.useEffect(() => {
    const loadUser = async () => {
      // Only try to load user data if authenticated
      if (!api.isAuthenticated()) {
        return;
      }
      
      try {
        const userData = await api.getCurrentUser();
        setUser({
          name: `${userData.first_name} ${userData.last_name}`,
          email: userData.email,
          avatar: '',
        });
      } catch (error) {
        // Silently handle 401 (unauthorized) - user is not authenticated
        if (error instanceof ApiError && error.status === 401) {
          // User is not authenticated, keep default user data
          return;
        }
        console.error('Failed to load user data:', error);
      }
    };
    loadUser();
  }, []);

  const handleLogout = () => {
    api.removeToken();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  if (!activeTeam) return null;

  return (
    <SidebarProvider>
      <MainSidebarContent 
        activeTeam={activeTeam}
        setActiveTeam={setActiveTeam}
        user={user}
        handleLogout={handleLogout}
        isMobile={isMobile}
        children={children}
      />
    </SidebarProvider>
  );
}

function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 transition-all duration-300">
      {children}
    </div>
  );
}

function MainSidebarContent({
  activeTeam,
  setActiveTeam,
  user,
  handleLogout,
  isMobile,
  children,
}: {
  activeTeam: typeof DATA.teams[0];
  setActiveTeam: (team: typeof DATA.teams[0]) => void;
  user: typeof DATA.user;
  handleLogout: () => void;
  isMobile: boolean;
  children: React.ReactNode;
}) {
  const { toggleSidebar } = useSidebar();
  const location = useLocation();

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <activeTeam.logo className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {activeTeam.name}
                      </span>
                      <span className="truncate text-xs">
                        {activeTeam.plan}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  align="start"
                  side={isMobile ? 'bottom' : 'right'}
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Teams
                  </DropdownMenuLabel>
                  {DATA.teams.map((team, index) => (
                    <DropdownMenuItem
                      key={team.name}
                      onClick={() => setActiveTeam(team)}
                      className="gap-2 p-2"
                    >
                      <div className="flex size-6 items-center justify-center rounded-sm border">
                        <team.logo className="size-4 shrink-0" />
                      </div>
                      {team.name}
                      <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 p-2">
                    <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                      <Plus className="size-4" />
                    </div>
                    <div className="font-medium text-muted-foreground">
                      Add team
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarMenu>
              {DATA.navMain.map((item) => {
                const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + '/');
                return (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={isActive}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      {item.items && item.items.length > 0 ? (
                        <>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.title} isActive={isActive}>
                              {item.icon && <item.icon />}
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.items?.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.title}>
                                  <SidebarMenuSubButton asChild>
                                    <Link to={subItem.url}>
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </>
                      ) : (
                        <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                          <Link to={item.url}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel>Phase 2 Features</SidebarGroupLabel>
            <SidebarMenu>
              {DATA.phase2Nav.map((item) => {
                const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + '/');
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                      <Link to={item.url}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage
                        src={user.avatar}
                        alt={user.name}
                      />
                      <AvatarFallback className="rounded-lg">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user.name}
                      </span>
                      <span className="truncate text-xs">
                        {user.email}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  side={isMobile ? 'bottom' : 'right'}
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage
                          src={user.avatar}
                          alt={user.name}
                        />
                        <AvatarFallback className="rounded-lg">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user.name}
                        </span>
                        <span className="truncate text-xs">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Sparkles />
                      Upgrade to Pro
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <BadgeCheck />
                      Account
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <CreditCard />
                      Billing
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Bell />
                      Notifications
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <ActivitySidebarProvider>
          <div className="flex flex-1 flex-col h-full w-full overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div className="flex items-center gap-2 px-4 flex-1">
                  <MainSidebarTriggerButton className="-ml-1" onToggle={toggleSidebar} />
                  <Separator orientation="vertical" className="mr-2 h-4" />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem className="hidden md:block">
                        <BreadcrumbLink asChild>
                          <Link to="/">Fleet Management</Link>
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem>
                        <BreadcrumbPage>
                          {location.pathname === '/' ? 'Dashboard' : location.pathname.split('/').pop()?.replace('-', ' ') || 'Page'}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
                <RightSidebarTriggerWithSeparator />
            </header>
            <MainContent>
              {children}
            </MainContent>
          </div>
        </ActivitySidebarProvider>
      </SidebarInset>
    </>
  );
}