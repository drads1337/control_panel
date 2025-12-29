import { useMemo, useState, useCallback } from 'react';
import type { Agent } from '@/entities/agent';

export interface AgentFilters {
  searchTerm: string;
  status: 'all' | 'active' | 'inactive' | 'maintenance' | 'testing';
  sortBy: 'name' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}

const defaultFilters: AgentFilters = {
  searchTerm: '',
  status: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
};

export function useAgentFilters(agents: Agent[]) {
  const [filters, setFilters] = useState<AgentFilters>(defaultFilters);

  const updateFilters = useCallback((newFilters: Partial<AgentFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const filteredAgents = useMemo(() => {
    let result = [...agents];

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(searchLower) ||
          agent.description?.toLowerCase().includes(searchLower) ||
          agent.id.toString().includes(searchLower)
      );
    }

    if (filters.status !== 'all') {
      result = result.filter((agent) => agent.status === filters.status);
    }

    result.sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison =
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime();
          break;
        case 'updated_at':
          comparison =
            new Date(a.updated_at || 0).getTime() -
            new Date(b.updated_at || 0).getTime();
          break;
      }

      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [agents, filters]);

  return {
    filters,
    filteredAgents,
    updateFilters,
    resetFilters,
  };
}

