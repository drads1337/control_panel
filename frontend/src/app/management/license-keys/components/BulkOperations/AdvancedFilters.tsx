import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Filter, BarChart2, CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  KEY_STATUS_OPTIONS,
  ACTIVATION_STATUS_OPTIONS,
  DEVICE_USAGE_OPTIONS,
  MAX_DEVICES_OPTIONS,
  DATE_RANGE_OPTIONS,
} from '@/shared/constants';
import { cn } from '@/lib/utils';

export interface FilterState {
  status: string;
  activationStatus: string;
  deviceUsage: string;
  maxDevices: string;
  dateRange: string;
  customDateFrom: string;
  customDateTo: string;
}

interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onGetCount: () => void;
  keysCount: number | null;
  isLoading: boolean;
  disabled: boolean;
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  onGetCount,
  keysCount,
  isLoading,
  disabled,
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg border">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium ml-1">Operation Filters</Label>
          {keysCount !== null && !showFilters && (
             <Badge variant="secondary" className="text-xs">
                {keysCount} keys found
             </Badge>
          )}
        </div>
        <Button
          variant={showFilters ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="h-8"
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          {showFilters ? 'Hide' : 'Show'}
        </Button>
      </div>

      {showFilters && (
        <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
          {/* Main Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Key Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter('status', value)}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {KEY_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Activation Status</Label>
              <Select
                value={filters.activationStatus}
                onValueChange={(value) => updateFilter('activationStatus', value)}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select activation status" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVATION_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Device Usage</Label>
              <Select
                value={filters.deviceUsage}
                onValueChange={(value) => updateFilter('deviceUsage', value)}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select usage" />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_USAGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max Devices</Label>
              <Select
                value={filters.maxDevices}
                onValueChange={(value) => updateFilter('maxDevices', value)}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select device limit" />
                </SelectTrigger>
                <SelectContent>
                  {MAX_DEVICES_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs text-muted-foreground">Creation Period</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => updateFilter('dateRange', value)}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range - Conditionally rendered */}
          {filters.dateRange === 'custom' && (
            <div className="bg-muted/30 p-3 rounded-md border border-dashed">
              <div className="flex items-center gap-2 mb-2">
                <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium">Custom Range</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={filters.customDateFrom}
                    onChange={(e) => updateFilter('customDateFrom', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={filters.customDateTo}
                    onChange={(e) => updateFilter('customDateTo', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
            {keysCount !== null ? (
              <div className="flex items-center justify-center sm:justify-start gap-2 p-2 bg-primary/10 border border-primary/20 rounded text-sm w-full sm:w-auto">
                <span className="text-muted-foreground">Result:</span>
                <span className="font-bold text-primary">{keysCount}</span>
                <span className="text-muted-foreground">keys</span>
              </div>
            ) : (
              <div className="hidden sm:block" /> /* Spacer */
            )}

            <Button
              variant="default"
              onClick={onGetCount}
              disabled={isLoading || disabled}
              className="w-full sm:w-auto min-w-[140px]"
            >
              <BarChart2 className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              {isLoading ? 'Calculating...' : 'Count Keys'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};