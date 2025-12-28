import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface UsersFiltersProps {
  filters: {
    search: string;
    role: string;
    status: string;
    project: string;
  };
  onFiltersChange: (filters: {
    search: string;
    role: string;
    status: string;
    project: string;
  }) => void;
  onClearFilters: () => void;
}

const UsersFilters: React.FC<UsersFiltersProps> = React.memo(({
  filters,
  onFiltersChange,
  onClearFilters
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFilterChange = React.useCallback((key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (filters.role !== 'all') count++;
    if (filters.status !== 'all') count++;
    if (filters.project !== 'all') count++;
    return count;
  }, [filters]);

  const hasActiveFilters = filters.search !== '' || activeFiltersCount > 0;

  return (
    <Card className="border-0 shadow-none bg-transparent md:border md:shadow-sm md:bg-card">
      <CardContent className="p-0 md:p-6 space-y-4">
        {/* Top Row: Search + Toggle Button (Mobile) */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 w-full text-base sm:text-sm" // text-base prevents iOS zoom
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "md:hidden shrink-0",
              (isExpanded || activeFiltersCount > 0) && "border-primary text-primary bg-primary/5"
            )}
          >
            <Filter className="h-4 w-4" />
            {activeFiltersCount > 0 && !isExpanded && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
            )}
          </Button>
        </div>

        {/* Collapsible Filters Area */}
        <div className={cn(
          "grid gap-4 transition-all",
          // Mobile styles
          "grid-cols-1",
          isExpanded ? "block" : "hidden",
          // Desktop styles (always visible)
          "md:grid md:grid-cols-3"
        )}>
          <div className="space-y-2">
            <label className="text-sm font-medium md:hidden">Role</label>
            <Select
              value={filters.role}
              onValueChange={(value) => handleFilterChange('role', value)}
            >
              <SelectTrigger className="w-full text-base sm:text-sm">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium md:hidden">Status</label>
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger className="w-full text-base sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium md:hidden">Project</label>
            <Select
              value={filters.project}
              onValueChange={(value) => handleFilterChange('project', value)}
            >
              <SelectTrigger className="w-full text-base sm:text-sm">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="assigned">Has Project</SelectItem>
                <SelectItem value="unassigned">No Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 pt-2 md:pt-0 items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-7 px-2 text-xs hover:bg-destructive/10 hover:text-destructive"
            >
              Clear All
            </Button>
            
            {filters.role !== 'all' && (
              <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
                Role: {filters.role}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-full hover:bg-muted-foreground/20"
                  onClick={() => handleFilterChange('role', 'all')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.status !== 'all' && (
              <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
                Status: {filters.status}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-full hover:bg-muted-foreground/20"
                  onClick={() => handleFilterChange('status', 'all')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filters.project !== 'all' && (
              <Badge variant="secondary" className="h-7 gap-1 pl-2 pr-1">
                Project: {filters.project}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-full hover:bg-muted-foreground/20"
                  onClick={() => handleFilterChange('project', 'all')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

UsersFilters.displayName = 'UsersFilters';

export default UsersFilters;