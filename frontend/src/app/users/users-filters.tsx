import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Filter, X } from 'lucide-react';

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
  const handleFilterChange = React.useCallback((key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  const hasActiveFilters = React.useMemo(() => 
    filters.search !== '' || 
    filters.role !== 'all' || 
    filters.status !== 'all' || 
    filters.project !== 'all',
    [filters.search, filters.role, filters.status, filters.project]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span>Filters</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="ml-auto"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username, email..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select
              value={filters.role}
              onValueChange={(value) => handleFilterChange('role', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All roles" />
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
            <label className="text-sm font-medium">Status</label>
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
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
            <label className="text-sm font-medium">Project</label>
            <Select
              value={filters.project}
              onValueChange={(value) => handleFilterChange('project', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="assigned">Has Project</SelectItem>
                <SelectItem value="unassigned">No Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <div className="flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                <span>Search: {filters.search}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFilterChange('search', '')}
                  className="h-auto p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            {filters.role !== 'all' && (
              <div className="flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                <span>Role: {filters.role}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFilterChange('role', 'all')}
                  className="h-auto p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            {filters.status !== 'all' && (
              <div className="flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                <span>Status: {filters.status}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFilterChange('status', 'all')}
                  className="h-auto p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            {filters.project !== 'all' && (
              <div className="flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                <span>Project: {filters.project}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFilterChange('project', 'all')}
                  className="h-auto p-0 ml-1"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

UsersFilters.displayName = 'UsersFilters';

export default UsersFilters;
