import { useState, useCallback } from 'react';
import type { Agent } from '@/entities/agent';

export function useAgentDialogs() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showAssignProductsDialog, setShowAssignProductsDialog] = useState(false);
  const [showNotificationsDialog, setShowNotificationsDialog] = useState(false);
  const [showChangelogDialog, setShowChangelogDialog] = useState(false);
  const [showLibraryHashDialog, setShowLibraryHashDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const openCreateDialog = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  const openEditDialog = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowEditDialog(true);
  }, []);

  const openUploadDialog = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowUploadDialog(true);
  }, []);

  const openDetailsDialog = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowDetailsDialog(true);
  }, []);

  const openConfigDialog = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowConfigDialog(true);
  }, []);

  const openAssignProductsDialog = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowAssignProductsDialog(true);
  }, []);

  const openNotificationsDialog = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowNotificationsDialog(true);
  }, []);

  const openChangelogDialog = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowChangelogDialog(true);
  }, []);

  const openLibraryHashDialog = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setShowLibraryHashDialog(true);
  }, []);

  const closeAllDialogs = useCallback(() => {
    setShowCreateDialog(false);
    setShowEditDialog(false);
    setShowUploadDialog(false);
    setShowDetailsDialog(false);
    setShowConfigDialog(false);
    setShowAssignProductsDialog(false);
    setShowNotificationsDialog(false);
    setShowChangelogDialog(false);
    setShowLibraryHashDialog(false);
    setSelectedAgent(null);
  }, []);

  return {
    // Dialog states
    showCreateDialog,
    showEditDialog,
    showUploadDialog,
    showDetailsDialog,
    showConfigDialog,
    showAssignProductsDialog,
    showNotificationsDialog,
    showChangelogDialog,
    showLibraryHashDialog,
    selectedAgent,
    // Actions
    openCreateDialog,
    openEditDialog,
    openUploadDialog,
    openDetailsDialog,
    openConfigDialog,
    openAssignProductsDialog,
    openNotificationsDialog,
    openChangelogDialog,
    openLibraryHashDialog,
    closeAllDialogs,
    // Setters (for backward compatibility)
    setShowCreateDialog,
    setShowEditDialog,
    setShowUploadDialog,
    setShowDetailsDialog,
    setShowConfigDialog,
    setShowAssignProductsDialog,
    setShowNotificationsDialog,
    setShowChangelogDialog,
    setShowLibraryHashDialog,
    setSelectedAgent,
  };
}

