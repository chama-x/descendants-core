import { create } from 'zustand';
import * as THREE from 'three';

export interface Obstacle {
    position: THREE.Vector3;
    radius: number;
}

interface GameState {
    debugText: string;
    setDebugText: (text: string) => void;
    viewMode: 'third';
    setViewMode: (mode: 'third') => void;
    isCameraLocked: boolean;
    setCameraLocked: (locked: boolean) => void;
    isNight: boolean;
    setIsNight: (isNight: boolean) => void;
    collidableMeshes: THREE.Object3D[];
    addCollidableMesh: (mesh: THREE.Object3D) => void;
    removeCollidableMesh: (uuid: string) => void;
    obstacles: Obstacle[];
    addObstacles: (obstacles: Obstacle[]) => void;
    removeObstacles: (obstacles: Obstacle[]) => void;

    // Interactables (for actions like sitting)
    interactables: { id: string; type: string; position: THREE.Vector3; rotation: THREE.Quaternion }[];
    addInteractables: (items: { id: string; type: string; position: THREE.Vector3; rotation: THREE.Quaternion }[]) => void;
    removeInteractables: (ids: string[]) => void;

    // Robot State
    isSitting: boolean;
    setSitting: (sitting: boolean) => void;

    isTeleporting: boolean;
    setTeleporting: (teleporting: boolean) => void;

    // Settings
    invertedMouse: boolean;
    setInvertedMouse: (inverted: boolean) => void;
    sensitivity: number;
    setSensitivity: (sensitivity: number) => void;
    volume: number;
    setVolume: (volume: number) => void;

    // Menu State
    isMenuOpen: boolean;
    setMenuOpen: (isOpen: boolean) => void;

    // Key Bindings
    keyBindings: {
        forward: string;
        backward: string;
        left: string;
        right: string;
        jump: string;
        sprint: string;
        crouch: string;
        interact: string;
        menu: string;
    };
    setKeyBinding: (action: string, key: string) => void;

    // --- NEW SETTINGS ---
    aiSettings: {
        enabled: boolean;
        llmEnabled: boolean;
        allowedCommands: string[];
    };
    setAISetting: (settings: Partial<{ enabled: boolean; llmEnabled: boolean; allowedCommands: string[] }>) => void;

    graphicsSettings: {
        quality: 'low' | 'medium' | 'high';
        shadows: boolean;
        weather: boolean;
    };
    setGraphicsSetting: (settings: Partial<{ quality: 'low' | 'medium' | 'high'; shadows: boolean; weather: boolean }>) => void;

    gameplaySettings: {
        headBob: boolean;
        sprintToggle: boolean;
    };
    setGameplaySetting: (settings: Partial<{ headBob: boolean; sprintToggle: boolean }>) => void;
}

export const useGameStore = create<GameState>((set) => ({
    debugText: '',
    setDebugText: (text) => set({ debugText: text }),
    viewMode: 'third',
    setViewMode: (mode) => set({ viewMode: mode }),
    isCameraLocked: false,
    setCameraLocked: (locked) => set({ isCameraLocked: locked }),
    isNight: false,
    setIsNight: (isNight) => set({ isNight }),

    collidableMeshes: [],
    addCollidableMesh: (mesh) => set((state) => ({ collidableMeshes: [...state.collidableMeshes, mesh] })),
    removeCollidableMesh: (uuid) => set((state) => ({ collidableMeshes: state.collidableMeshes.filter((m) => m.uuid !== uuid) })),

    obstacles: [],
    addObstacles: (newObstacles) => set((state) => ({ obstacles: [...state.obstacles, ...newObstacles] })),
    removeObstacles: (obsToRemove) => set((state) => ({
        obstacles: state.obstacles.filter(o => !obsToRemove.some(r => r.position.equals(o.position)))
    })),

    interactables: [],
    addInteractables: (items) => set((state) => ({ interactables: [...state.interactables, ...items] })),
    removeInteractables: (ids) => set((state) => ({ interactables: state.interactables.filter(i => !ids.includes(i.id)) })),

    isSitting: false,
    setSitting: (sitting) => set({ isSitting: sitting }),
    isTeleporting: false,
    setTeleporting: (teleporting) => set({ isTeleporting: teleporting }),

    // Settings
    invertedMouse: false,
    setInvertedMouse: (inverted) => set({ invertedMouse: inverted }),
    sensitivity: 1.0,
    setSensitivity: (sensitivity) => set({ sensitivity }),
    volume: 0.5,
    setVolume: (volume) => set({ volume }),

    // Menu State
    isMenuOpen: false,
    setMenuOpen: (isOpen) => set({ isMenuOpen: isOpen }),

    // Key Bindings
    keyBindings: {
        forward: 'KeyW',
        backward: 'KeyS',
        left: 'KeyA',
        right: 'KeyD',
        jump: 'Space',
        sprint: 'ShiftLeft',
        crouch: 'KeyC',
        interact: 'KeyE',
        menu: 'Escape'
    },
    setKeyBinding: (action, key) => set((state) => ({
        keyBindings: { ...state.keyBindings, [action]: key }
    })),

    // --- NEW SETTINGS IMPLEMENTATION ---
    aiSettings: {
        enabled: true,
        llmEnabled: true,
        allowedCommands: ['FOLLOW_ENTITY', 'NAVIGATE_TO_ANCHOR', 'NAVIGATE_TO_COORD', 'SOCIAL_INTERACT', 'HOLD_POSITION', 'IDLE']
    },
    setAISetting: (newSettings) => set((state) => ({
        aiSettings: { ...state.aiSettings, ...newSettings }
    })),

    graphicsSettings: {
        quality: 'high',
        shadows: true,
        weather: true
    },
    setGraphicsSetting: (newSettings) => set((state) => ({
        graphicsSettings: { ...state.graphicsSettings, ...newSettings }
    })),

    gameplaySettings: {
        headBob: true,
        sprintToggle: false
    },
    setGameplaySetting: (newSettings) => set((state) => ({
        gameplaySettings: { ...state.gameplaySettings, ...newSettings }
    })),
}));
