import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Filter, BarChart2 } from 'lucide-react';
import {
  KEY_STATUS_OPTIONS,
  ACTIVATION_STATUS_OPTIONS,
  DEVICE_USAGE_OPTIONS,
  MAX_DEVICES_OPTIONS,
  DATE_RANGE_OPTIONS,
} from '@/shared/constants';

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
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Operation Filters</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-1" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      {showFilters && (
        <div className="space-y-4 p-4 border rounded-lg bg-secondary/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Key Status</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter('status', value)}
              >
                <SelectTrigger>
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

            <div>
              <Label className="text-sm font-medium">Activation Status</Label>
              <Select
                value={filters.activationStatus}
                onValueChange={(value) => updateFilter('activationStatus', value)}
              >
                <SelectTrigger>
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

            <div>
              <Label className="text-sm font-medium">Device Usage</Label>
              <Select
                value={filters.deviceUsage}
                onValueChange={(value) => updateFilter('deviceUsage', value)}
              >
                <SelectTrigger>
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

            <div>
              <Label className="text-sm font-medium">Max Devices</Label>
              <Select
                value={filters.maxDevices}
                onValueChange={(value) => updateFilter('maxDevices', value)}
              >
                <SelectTrigger>
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

            <div>
              <Label className="text-sm font-medium">Creation Period</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => updateFilter('dateRange', value)}
              >
                <SelectTrigger>
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

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={onGetCount}
                disabled={isLoading || disabled}
                className="w-full"
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                Count Keys
              </Button>
            </div>
          </div>

          {filters.dateRange === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">From</Label>
                <Input
                  type="date"
                  value={filters.customDateFrom}
                  onChange={(e) => updateFilter('customDateFrom', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">To</Label>
                <Input
                  type="date"
                  value={filters.customDateTo}
                  onChange={(e) => updateFilter('customDateTo', e.target.value)}
                />
              </div>
            </div>
          )}

          {keysCount !== null && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium">
                Keys found: <span className="text-primary">{keysCount}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
