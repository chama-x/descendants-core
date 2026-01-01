/**
 * Neuro-Symbolic Integration Layer
 * 
 * Bridges the gap between:
 * 1. The Semantic World (LLM / Graph Memory)
 * 2. The Physical World (Yuka / Three.js)
 */

import * as THREE from 'three';

// =============================================================================
// TYPES
// =============================================================================

export interface SpatialAnchor {
    id: string;
    position: THREE.Vector3;
    type: 'STATIC' | 'DYNAMIC';
    zone: string; // "Office", "Warehouse", etc.
    tags: string[]; // "Furniture", "Cover", "Exit"
}

export interface PhysicsQuery {
    canReach: boolean;
    distance: number;
    estimatedTime: number; // Seconds
    obstacles: string[]; // Names of blocking entities
}

// =============================================================================
// WORLD REGISTRY (The Spatial Index)
// =============================================================================

/**
 * Maintains the authoritative mapping between Semantic IDs ("Office_Desk")
 * and Physical Coordinates (x,y,z).
 */
export class WorldRegistry {
    private static instance: WorldRegistry;

    private anchors: Map<string, SpatialAnchor> = new Map();
    private dynamicGetters: Map<string, () => THREE.Vector3> = new Map();

    private constructor() { }

    static getInstance(): WorldRegistry {
        if (!WorldRegistry.instance) {
            WorldRegistry.instance = new WorldRegistry();
        }
        return WorldRegistry.instance;
    }

    /** Register a static landmark (e.g., Furniture, Rooms) */
    registerStatic(id: string, position: THREE.Vector3, zone: string, tags: string[] = []): void {
        this.anchors.set(id, {
            id,
            position: position.clone(),
            type: 'STATIC',
            zone,
            tags
        });
    }

    /** Register a dynamic entity (e.g., Player, Agents) */
    registerDynamic(id: string, positionGetter: () => THREE.Vector3): void {
        this.dynamicGetters.set(id, positionGetter);
    }

    /** Get current exact position of ANY entity */
    getPosition(id: string): THREE.Vector3 | null {
        // Check dynamic first (most likely to change)
        if (this.dynamicGetters.has(id)) {
            const getter = this.dynamicGetters.get(id);
            return getter ? getter() : null;
        }
        // Check static
        if (this.anchors.has(id)) {
            return this.anchors.get(id)!.position.clone();
        }
        return null;
    }

    /** Find nearest anchor to a position */
    getNearestAnchor(position: THREE.Vector3, filterTags?: string[]): SpatialAnchor | null {
        let nearest: SpatialAnchor | null = null;
        let minDist = Infinity;

        for (const anchor of this.anchors.values()) {
            if (filterTags && !anchor.tags.some(t => filterTags.includes(t))) continue;

            const dist = position.distanceToSquared(anchor.position);
            if (dist < minDist) {
                minDist = dist;
                nearest = anchor;
            }
        }
        return nearest;
    }

    /** Get all entities within a zone */
    getInZone(zoneName: string): string[] {
        const results: string[] = [];
        for (const anchor of this.anchors.values()) {
            if (anchor.zone === zoneName) results.push(anchor.id);
        }
        return results;
    }
}

// =============================================================================
// YUKA ORACLE (The Physics Calculator)
// =============================================================================

/**
 * Provides physical reasoning capabilities to the LLM.
 * "Can I get there?" "How long will it take?"
 */
export class YukaOracle {
    private registry: WorldRegistry;

    constructor() {
        this.registry = WorldRegistry.getInstance();
    }

    /**
     * Simulate a pathfinding request.
     * In a real Yuka impl, this would query the NavMesh.
     * For now, we use simple distance + connection logic.
     */
    checkPath(startId: string, targetId: string, moveSpeed: number = 1.5): PhysicsQuery {
        const startPos = this.registry.getPosition(startId);
        const targetPos = this.registry.getPosition(targetId);

        if (!startPos || !targetPos) {
            return { canReach: false, distance: -1, estimatedTime: -1, obstacles: ["Unknown location"] };
        }

        const dist = startPos.distanceTo(targetPos);

        // Simple heuristic: If > 30m, assume "Far/maybe blocked". 
        // Real implementation would integrate A* here.
        const canReach = dist < 50;

        return {
            canReach,
            distance: dist,
            estimatedTime: dist / moveSpeed,
            obstacles: canReach ? [] : ["Path too long/complex"]
        };
    }

    /**
     * Generate "Spatial Context" blob for the Context Mixer.
     * This puts the "Physics" into "Words".
     */
    generateSpatialContext(agentId: string): string {
        const agentPos = this.registry.getPosition(agentId);
        if (!agentPos) return "Location: Unknown";

        const currentAnchor = this.registry.getNearestAnchor(agentPos);
        const zone = currentAnchor ? currentAnchor.zone : "Unknown Zone";

        // Pre-calculate nearest "interesting" things
        const nearestExit = this.registry.getNearestAnchor(agentPos, ['Exit']);
        const nearestCover = this.registry.getNearestAnchor(agentPos, ['Cover']);

        let context = `## Physical State
- **Zone**: ${zone}
- **Nearest Landmark**: ${currentAnchor?.id || 'None'} (${currentAnchor ? agentPos.distanceTo(currentAnchor.position).toFixed(1) : '-'}m away)`;

        if (nearestExit) {
            context += `\n- **Escape Route**: ${nearestExit.id} is ${agentPos.distanceTo(nearestExit.position).toFixed(0)}m away.`;
        }
        if (nearestCover) {
            context += `\n- **Cover**: ${nearestCover.id} is nearby.`;
        }

        return context;
    }
}
