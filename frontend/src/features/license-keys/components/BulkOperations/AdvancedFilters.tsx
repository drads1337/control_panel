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
} from '@/shared/constants/filters';
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
    <div className="space-y-2">
      <div className="flex items-center justify-between bg-muted/30 p-1.5 rounded-md border">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs ml-0.5">Operation Filters</Label>
          {keysCount !== null && !showFilters && (
             <Badge variant="secondary" className="text-[10px]">
                {keysCount} keys found
             </Badge>
          )}
        </div>
        <Button
          variant={showFilters ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="h-7 text-xs"
        >
          <Filter className="h-3 w-3 mr-1" />
          {showFilters ? 'Hide' : 'Show'}
        </Button>
      </div>

      {showFilters && (
        <div className="space-y-2 p-2 border rounded-md bg-card shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
          {/* Main Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Key Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter('status', value)}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {KEY_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Activation Status</Label>
              <Select
                value={filters.activationStatus}
                onValueChange={(value) => updateFilter('activationStatus', value)}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select activation status" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {ACTIVATION_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Device Usage</Label>
              <Select
                value={filters.deviceUsage}
                onValueChange={(value) => updateFilter('deviceUsage', value)}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select usage" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {DEVICE_USAGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Max Devices</Label>
              <Select
                value={filters.maxDevices}
                onValueChange={(value) => updateFilter('maxDevices', value)}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select device limit" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {MAX_DEVICES_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-[10px] text-muted-foreground">Creation Period</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => updateFilter('dateRange', value)}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  {DATE_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Date Range - Conditionally rendered */}
          {filters.dateRange === 'custom' && (
            <div className="bg-muted/30 p-2 rounded-md border border-dashed">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium">Custom Range</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={filters.customDateFrom}
                    onChange={(e) => updateFilter('customDateFrom', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={filters.customDateTo}
                    onChange={(e) => updateFilter('customDateTo', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
            {keysCount !== null ? (
              <div className="flex items-center justify-center sm:justify-start gap-1.5 p-1.5 bg-primary/10 border border-primary/20 rounded text-xs w-full sm:w-auto">
                <span className="text-muted-foreground">Result:</span>
                <span className="font-bold text-primary">{keysCount}</span>
                <span className="text-muted-foreground">keys</span>
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}

            <Button
              variant="default"
              onClick={onGetCount}
              disabled={isLoading || disabled}
              className="w-full sm:w-auto min-w-[120px] h-8 text-xs"
            >
              <BarChart2 className={cn("h-3 w-3 mr-1.5", isLoading && "animate-spin")} />
              {isLoading ? 'Calculating...' : 'Count Keys'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

