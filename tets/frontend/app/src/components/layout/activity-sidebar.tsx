import * as React from 'react';
import { Bot, PanelRight, Clock, Activity } from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarProvider,
} from '@/components/animate-ui/components/radix/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  icon: React.ReactNode;
  text: string;
  subtext?: string;
  time: string;
}

const soonActivities: ActivityItem[] = [
  {
    id: '1',
    icon: <Bot className="size-4" />,
    text: 'AI Analysis',
    subtext: 'Processing request...',
    time: 'Now',
  },
  {
    id: '2',
    icon: <Clock className="size-4" />,
    text: 'Maintenance',
    subtext: 'Scheduled system update',
    time: '59m',
  },
];

const mainActivities: ActivityItem[] = [
  {
    id: '5',
    icon: <span className="text-[10px] font-bold">JD</span>,
    text: 'John Doe',
    subtext: 'Commented on "Project Alpha"',
    time: '2m',
  },
  {
    id: '6',
    icon: <span className="text-[10px] font-bold">AS</span>,
    text: 'Alice Smith',
    subtext: 'Invited you to team',
    time: '1h',
  },
  {
    id: '7',
    icon: <div className="size-1.5 rounded-full bg-zinc-400" />,
    text: 'System Update',
    time: '12h',
  },
  {
    id: '8',
    icon: <Activity className="size-4" />,
    text: 'Deployment',
    subtext: 'Production finished',
    time: '1d',
  },
];

function ActivityItem({ item }: { item: ActivityItem }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton className="flex items-start gap-3 h-auto py-2 px-3">
        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-sidebar-foreground/70">
          {item.icon}
        </div>
        <div className="flex flex-col flex-1 min-w-0 gap-0.5 text-left">
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-xs font-medium text-sidebar-foreground truncate">
              {item.text}
            </span>
            <span className="text-[10px] text-sidebar-foreground/50 tabular-nums whitespace-nowrap shrink-0">
              {item.time}
            </span>
          </div>
          {item.subtext && (
            <span className="text-[11px] text-sidebar-foreground/60 truncate leading-tight">
              {item.subtext}
            </span>
          )}
        </div>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ActivitySidebarContent() {
  return (
    <>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Activity">
              <Activity className="size-4" />
              <span>Activity</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Up Next</SidebarGroupLabel>
          <SidebarMenu>
            {soonActivities.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarMenu>
            {mainActivities.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </>
  );
}

function RightSidebarTriggerButton({ 
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
      <PanelRight />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

function RightSidebarTriggerWithSeparator() {
  const { toggleSidebar } = useSidebar();
  
  return (
    <div className="flex items-center gap-2 px-4">
      <Separator orientation="vertical" className="h-4" />
      <RightSidebarTriggerButton onToggle={toggleSidebar} />
    </div>
  );
}

export function ActivitySidebar() {
  return (
    <Sidebar 
      side="right" 
      collapsible="offcanvas"
      className="border-l"
    >
      <ActivitySidebarContent />
    </Sidebar>
  );
}

export function ActivitySidebarProvider({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider 
      defaultOpen={false} 
      className="flex h-full w-full overflow-hidden"
    >
      {children}
      <ActivitySidebar />
    </SidebarProvider>
  );
}

export { RightSidebarTriggerButton, RightSidebarTriggerWithSeparator };