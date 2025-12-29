import { useCallback } from 'react';
import { useAgentsQuery } from '@/entities/agent';
import type { Agent } from '@/entities/agent';

export function useAgentMutations() {
  const {
    updateStatus: updateStatusMutation,
    deleteAgent: deleteAgentMutation,
  } = useAgentsQuery();

  const handleStatusChange = useCallback(
    async (agentId: number, newStatus: Agent['status']) => {
      try {
        await updateStatusMutation(agentId, newStatus);
      } catch (err) {
        // Error handling is done in the mutation
      }
    },
    [updateStatusMutation]
  );

  const handleDeleteAgent = useCallback(
    async (agentId: number) => {
      if (!confirm('Are you sure you want to delete this agent?')) return;
      try {
        await deleteAgentMutation(agentId);
      } catch (err) {
        // Error handling is done in the mutation
      }
    },
    [deleteAgentMutation]
  );

  return {
    handleStatusChange,
    handleDeleteAgent,
  };
}

