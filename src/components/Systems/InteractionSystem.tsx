'use client';

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';

export default function InteractionSystem() {
    const { camera, scene } = useThree();
    const raycaster = useRef(new THREE.Raycaster());
    const center = useRef(new THREE.Vector2(0, 0));

    // Store Actions
    const setHoveredAgentId = useGameStore(state => state.setHoveredAgentId);
    const setInspectedAgentId = useGameStore(state => state.setInspectedAgentId);
    const setChatOpen = useGameStore(state => state.setChatOpen);
    const inspectedAgentId = useGameStore(state => state.inspectedAgentId);
    const isChatOpen = useGameStore(state => state.isChatOpen);

    // Raycast loop
    useFrame(() => {
        // If chat is open, don't update hover (mouse is released)
        if (isChatOpen) return;

        raycaster.current.setFromCamera(center.current, camera);

        // Find all vehicles/agents in the scene
        // We'll search for objects with userData.id (set in useYukaAI)
        const agents: THREE.Object3D[] = [];
        scene.traverse((obj) => {
            if (obj.userData && obj.userData.id) {
                agents.push(obj);
            }
        });

        const intersects = raycaster.current.intersectObjects(agents, true);

        if (intersects.length > 0) {
            // Find first agent
            const hit = intersects.find(i => i.object.userData.id || i.object.parent?.userData.id);
            if (hit) {
                const agentId = hit.object.userData.id || hit.object.parent?.userData.id;
                setHoveredAgentId(agentId);
            } else {
                setHoveredAgentId(null);
            }
        } else {
            setHoveredAgentId(null);
        }
    });

    // Input Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'e') {
                const hoveredId = useGameStore.getState().hoveredAgentId;
                if (hoveredId) {
                    setInspectedAgentId(hoveredId);
                    setChatOpen(true);

                    // Unlock cursor for UI interaction
                    const element = document.body;
                    if (document.pointerLockElement === element) {
                        document.exitPointerLock();
                    }
                    useGameStore.getState().setCameraLocked(false);
                }
            } else if (e.key === 'Escape') {
                if (useGameStore.getState().isChatOpen) {
                    setChatOpen(false);
                    setInspectedAgentId(null);

                    // Relock cursor
                    const element = document.body;
                    element.requestPointerLock();
                    useGameStore.getState().setCameraLocked(true);
                }
            }
        };

        const handleMouseDown = (e: MouseEvent) => {
            // If clicked while hovering, also inspect (optional, maybe stick to 'E'?)
            // Let's stick to key for now to avoid accidental shooting/clicks
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setInspectedAgentId, setChatOpen]);

    return null;
}
