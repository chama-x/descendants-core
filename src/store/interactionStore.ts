import { create } from 'zustand';

interface InteractionState {
    isOpen: boolean;
    targetAgentId: string | null;
    openInteraction: (agentId: string) => void;
    closeInteraction: () => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
    isOpen: false,
    targetAgentId: null,
    openInteraction: (agentId: string) => set({ isOpen: true, targetAgentId: agentId }),
    closeInteraction: () => set({ isOpen: false, targetAgentId: null }),
}));
