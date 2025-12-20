import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Database,
  Users,
  KeyRound,
  Server,
  CalendarDays,
  Clock,
  MoreVertical,
  Settings,
  Play,
  Pause,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/date-utils';
import { getStatusClasses, getStatusText, type StatusType } from '@/lib/status-utils';
import type { Project } from '@/entities/project';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  onManage?: (project: Project) => void;
  onQuickAction?: (project: Project, action: 'activate' | 'deactivate' | 'extend') => void;
}

import { formatRelativeTime } from '@/lib/utils/date-utils';

const getIconColor = (status: string | null) => {
  if (!status) return 'bg-accent text-accent-foreground';
  switch (status.toLowerCase()) {
    case 'active': return 'bg-primary/10 text-primary';
    case 'inactive': return 'bg-secondary text-secondary-foreground';
    case 'expired': return 'bg-destructive/10 text-destructive';
    default: return 'bg-accent text-accent-foreground';
  }
};

const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return null;
  const statusType = status.toLowerCase() as StatusType;
  return (
    <span className={getStatusClasses(statusType)}>
      {getStatusText(statusType)}
    </span>
  );
};

const ProjectActionsMenu = ({ project, onManage, onQuickAction }: Pick<ProjectCardProps, 'project' | 'onManage' | 'onQuickAction'>) => {
  if (!onManage && !onQuickAction) return null;

  const handleAction = (e: React.MouseEvent, callback: () => void) => {
    e.stopPropagation();
    callback();
  };

  const showExtendAction = project.status === 'expired' || (project.days_until_expiry !== null && project.days_until_expiry <= 7);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onManage && (
          <DropdownMenuItem onClick={(e) => handleAction(e, () => onManage(project))}>
            <Settings className="h-4 w-4 mr-2" />
            Manage
          </DropdownMenuItem>
        )}
        {onQuickAction && project.status === 'inactive' && (
          <DropdownMenuItem onClick={(e) => handleAction(e, () => onQuickAction(project, 'activate'))}>
            <Play className="h-4 w-4 mr-2" />
            Activate
          </DropdownMenuItem>
        )}
        {onQuickAction && project.status === 'active' && (
          <DropdownMenuItem onClick={(e) => handleAction(e, () => onQuickAction(project, 'deactivate'))}>
            <Pause className="h-4 w-4 mr-2" />
            Deactivate
          </DropdownMenuItem>
        )}
        {onQuickAction && showExtendAction && (
          <DropdownMenuItem onClick={(e) => handleAction(e, () => onQuickAction(project, 'extend'))}>
            <CalendarDays className="h-4 w-4 mr-2" />
            Extend by 30 days
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ProjectCardHeader = ({ project, onManage, onQuickAction }: Pick<ProjectCardProps, 'project' | 'onManage' | 'onQuickAction'>) => (
  <CardHeader className="p-4 sm:p-6">
    <div className="flex items-start justify-between gap-2 sm:gap-4">
      <div className={cn('w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shrink-0', getIconColor(project.status))}>
        <Database className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="flex flex-col items-end gap-1 sm:gap-2">
          <StatusBadge status={project.status} />
          <StatusBadge status={project.subscription_status_display} />
        </div>
        <ProjectActionsMenu project={project} onManage={onManage} onQuickAction={onQuickAction} />
      </div>
    </div>
    <div className="pt-3 sm:pt-4">
      <CardTitle className="text-base sm:text-lg break-words">{project.name}</CardTitle>
      <CardDescription className="line-clamp-2 mt-1 text-xs sm:text-sm">
        {project.description || 'No description provided.'}
      </CardDescription>
      <div className="mt-2">
        <Badge variant="outline" className="text-xs">
          ID: {project.unique_id}
        </Badge>
      </div>
    </div>
  </CardHeader>
);

const ProjectStats = ({ project }: { project: Project }) => {
  const stats: { icon: LucideIcon; label: string; value: string | number }[] = [
    { icon: Users, label: 'Users', value: project.stats.users },
    { icon: KeyRound, label: 'Keys', value: project.stats.keys },
    { icon: Database, label: 'Products', value: project.stats.products },
    { icon: Server, label: 'Servers', value: project.stats.servers },
    { icon: Database, label: 'Storage', value: `${project.storage_limit_gb} GB` },
  ];

  const expiryDays = project.days_until_expiry;

  return (
    <ul className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm">
      {stats.map(({ icon: Icon, label, value }) => (
        <li key={label} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </div>
          <span className="font-medium shrink-0">{value}</span>
        </li>
      ))}
      {expiryDays !== null && (
        <li className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span>Expires in</span>
          </div>
          <span className={cn('font-medium shrink-0', expiryDays <= 7 && 'text-destructive')}>
            {expiryDays} {expiryDays === 1 ? 'day' : 'days'}
          </span>
        </li>
      )}
    </ul>
  );
};

const ProjectCardFooter = ({ project }: { project: Project }) => (
  <CardFooter className="text-xs text-muted-foreground p-4 sm:p-6 pt-0">
    <div className="flex items-center gap-1.5">
      <Clock className="h-3 w-3 shrink-0" />
      <span className="truncate">Last updated {formatRelativeTime(project.created_at)}</span>
    </div>
  </CardFooter>
);

export const ProjectCard = React.memo(function ProjectCard({ project, onClick, onManage, onQuickAction }: ProjectCardProps) {
  return (
    <Card
      className="@container/card flex flex-col h-full hover:border-primary/80 transition-all cursor-pointer group"
      onClick={onClick}
    >
      <ProjectCardHeader project={project} onManage={onManage} onQuickAction={onQuickAction} />
      <CardContent className="flex-grow space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
        <ProjectStats project={project} />
      </CardContent>
      <ProjectCardFooter project={project} />
    </Card>
  );
});