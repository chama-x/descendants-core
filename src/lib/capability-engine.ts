import * as YUKA from 'yuka';
import * as THREE from 'three';
import { WorldRegistry } from './yuka-oracle';
import AIManager from '../components/Systems/AIManager';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export type Posture = 'RUN' | 'WALK' | 'SNEAK' | 'ALERT';

export type CapabilityType =
    | 'IDLE'                // Stand still, play random idle anims
    | 'NAVIGATE_TO_ANCHOR'  // Go to named location from registry
    | 'NAVIGATE_TO_COORD'   // Go to raw XYZ
    | 'SOCIAL_INTERACT'     // Approach, Face, Dialog
    | 'GESTURE_WAVE'        // Play wave animation
    | 'FOLLOW_ENTITY'       // Follow target with offset
    | 'HOLD_POSITION'       // Stop and look at target
    | 'SQUAD_ORDER'         // Broadcast command
    | 'INTERNAL_THOUGHT';   // No action, just thinking

export interface CapabilityCommand {
    type: CapabilityType;
    params?: Record<string, any>; // e.g., { target: "Player", duration: 5 }
    posture?: Posture;
}

// -----------------------------------------------------------------------------
// CONSTANTS (Social Physics)
// -----------------------------------------------------------------------------

const POSTURE_SPEEDS = {
    'RUN': 10.0,
    'WALK': 3.5,
    'SNEAK': 2.0,
    'ALERT': 4.5
};

const SOCIAL_DISTANCES = {
    'INTERACT': 2.0,
    'FOLLOW': 3.0,
    'RESPECT': 1.5 // Personal space
};

// -----------------------------------------------------------------------------
// CAPABILITY ENGINE (The Tactician)
// -----------------------------------------------------------------------------

export class CapabilityEngine {
    private vehicle: YUKA.Vehicle;
    private currentPosture: Posture = 'WALK';
    private registry: WorldRegistry;

    // Behaviors
    private seekBehavior: YUKA.SeekBehavior;
    private arriveBehavior: YUKA.SeekBehavior; // Fallback to Seek because of import error
    private wanderBehavior: YUKA.WanderBehavior;
    private separationBehavior: YUKA.SeparationBehavior;
    private obstacleBehavior: YUKA.ObstacleAvoidanceBehavior;

    // State
    public currentAction: string = "IDLE";
    private activeTarget: YUKA.Vector3 | null = null;

    constructor(vehicle: YUKA.Vehicle) {
        this.vehicle = vehicle;
        this.registry = WorldRegistry.getInstance();

        // 1. Initialize Behaviors (Disabled by default)
        this.seekBehavior = new YUKA.SeekBehavior(new YUKA.Vector3());
        this.seekBehavior.active = false;

        // Using SeekBehavior instead of ArriveBehavior due to TS issues
        this.arriveBehavior = new YUKA.SeekBehavior(new YUKA.Vector3());
        this.arriveBehavior.active = false;

        this.wanderBehavior = new YUKA.WanderBehavior();
        this.wanderBehavior.active = false;

        // Always maintain separation
        this.separationBehavior = new YUKA.SeparationBehavior(AIManager.getInstance().vehicles);
        this.separationBehavior.weight = 3.0; // High respect for personal space

        // Always avoid obstacles
        this.obstacleBehavior = new YUKA.ObstacleAvoidanceBehavior([]);
        this.obstacleBehavior.weight = 5.0;

        // Add to Steering
        this.vehicle.steering.add(this.seekBehavior);
        this.vehicle.steering.add(this.arriveBehavior);
        this.vehicle.steering.add(this.wanderBehavior);
        this.vehicle.steering.add(this.separationBehavior);
        this.vehicle.steering.add(this.obstacleBehavior);
    }

    /**
     * The Main Interface. LLM sends a command, Engine executes.
     */
    public execute(cmd: CapabilityCommand): void {
        console.log(`[CapabilityEngine] Executing: ${cmd.type} (${cmd.posture || 'KEEP'})`);

        this.currentAction = cmd.type;

        // 1. Apply Posture (Global Modifier)
        if (cmd.posture) {
            this.setPosture(cmd.posture);
        }

        // 2. Reset Active Behaviors
        this.resetTacticalBehaviors();

        // 3. Execute Capability Logic
        switch (cmd.type) {
            case 'IDLE':
                this.executeIdle();
                break;
            case 'NAVIGATE_TO_ANCHOR':
                this.executeNavigateToAnchor(cmd.params?.target);
                break;
            case 'NAVIGATE_TO_COORD':
                this.executeNavigateToCoord(cmd.params?.x, cmd.params?.y, cmd.params?.z);
                break;
            case 'FOLLOW_ENTITY':
                this.executeFollow(cmd.params?.target);
                break;
            case 'SOCIAL_INTERACT':
                this.executeSocialInteract(cmd.params?.target);
                break;
            case 'HOLD_POSITION':
                // Stop moving, keep looking
                this.vehicle.velocity.set(0, 0, 0);
                break;
            case 'INTERNAL_THOUGHT':
                // No physical action
                break;
            default:
                console.warn(`[CapabilityEngine] Unknown capability: ${cmd.type}`);
        }
    }

    // --- PRIMITIVE ACTIONS ---

    private setPosture(posture: Posture) {
        this.currentPosture = posture;
        this.vehicle.maxSpeed = POSTURE_SPEEDS[posture];
    }

    private resetTacticalBehaviors() {
        this.seekBehavior.active = false;
        this.arriveBehavior.active = false;
        this.wanderBehavior.active = false;
    }

    // --- IMPLEMENTATIONS ---

    private executeIdle() {
        this.vehicle.velocity.set(0, 0, 0);
    }

    private executeNavigateToAnchor(targetName: string) {
        if (!targetName) return;
        const pos = this.registry.getPosition(targetName);
        if (pos) {
            this.arriveBehavior.target.copy(pos as unknown as YUKA.Vector3);
            this.arriveBehavior.active = true;
        } else {
            console.warn(`[CapabilityEngine] Unknown anchor: ${targetName}`);
        }
    }

    private executeNavigateToCoord(x: number, y: number, z: number) {
        if (x === undefined || z === undefined) return;
        this.arriveBehavior.target.set(x, y || 0, z);
        this.arriveBehavior.active = true;
    }

    private executeFollow(targetName: string) {
        const pos = this.registry.getPosition(targetName);
        if (pos) {
            this.arriveBehavior.target.copy(pos as unknown as YUKA.Vector3);
            this.arriveBehavior.active = true;
        }
    }

    private executeSocialInteract(targetName: string) {
        const pos = this.registry.getPosition(targetName);
        if (pos) {
            this.arriveBehavior.target.copy(pos as unknown as YUKA.Vector3);
            this.arriveBehavior.active = true;
        }
    }
}
