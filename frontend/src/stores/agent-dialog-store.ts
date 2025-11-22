import { create } from 'zustand'
import { produce } from 'immer'

interface AgentDialogState {
  createAgentDialogRequested: boolean
}

interface AgentDialogActions {
  requestCreateAgentDialog: () => void
  clearCreateAgentDialogRequest: () => void
  setCreateAgentDialogRequested: (requested: boolean) => void
}

const initialState: AgentDialogState = {
  createAgentDialogRequested: false,
}

export const useAgentDialogStore = create<AgentDialogState & AgentDialogActions>((set) => ({
  ...initialState,

  requestCreateAgentDialog: () => set(
    produce((state: AgentDialogState) => {
      state.createAgentDialogRequested = true
    })
  ),

  clearCreateAgentDialogRequest: () => set(
    produce((state: AgentDialogState) => {
      state.createAgentDialogRequested = false
    })
  ),

  setCreateAgentDialogRequested: (requested) => set(
    produce((state: AgentDialogState) => {
      state.createAgentDialogRequested = requested
    })
  ),
}))

