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

// -----------------------------------------------------------------------------
// CAPABILITY ENGINE (The Tactician)
// -----------------------------------------------------------------------------

export class CapabilityEngine {
    private vehicle: YUKA.Vehicle;
    private currentPosture: Posture = 'WALK';
    private registry: WorldRegistry;

    // Behaviors
    private seekBehavior: YUKA.SeekBehavior;
    private arriveBehavior: YUKA.SeekBehavior; // Reverted to Seek for Manual Logic
    private wanderBehavior: YUKA.WanderBehavior;
    private separationBehavior: YUKA.SeparationBehavior;
    private obstacleBehavior: YUKA.ObstacleAvoidanceBehavior;

    // State
    public currentAction: string = "IDLE";
    private activeTargetId: string | null = null; // Track who we are following

    constructor(vehicle: YUKA.Vehicle) {
        this.vehicle = vehicle;
        this.registry = WorldRegistry.getInstance();

        // 1. Initialize Behaviors
        this.seekBehavior = new YUKA.SeekBehavior(new YUKA.Vector3());
        this.seekBehavior.active = false;

        // "ArriveBehavior" implemented via Seek with dynamic braking
        this.arriveBehavior = new YUKA.SeekBehavior(new YUKA.Vector3());
        this.arriveBehavior.active = false;

        this.wanderBehavior = new YUKA.WanderBehavior();
        this.wanderBehavior.active = false;

        // Always maintain separation
        this.separationBehavior = new YUKA.SeparationBehavior(AIManager.getInstance().vehicles);
        this.separationBehavior.weight = 3.0; // High respect for personal space

        // Always avoid obstacles (Walls, Furniture)
        const obstacles = AIManager.getInstance().getObstacles();
        this.obstacleBehavior = new YUKA.ObstacleAvoidanceBehavior(obstacles);
        this.obstacleBehavior.weight = 5.0;

        // Add to Steering
        this.vehicle.steering.add(this.seekBehavior);
        this.vehicle.steering.add(this.arriveBehavior);
        this.vehicle.steering.add(this.wanderBehavior);
        this.vehicle.steering.add(this.separationBehavior);
        this.vehicle.steering.add(this.obstacleBehavior);
    }

    /**
     * Update Loop - Called every frame by useYukaAI
     * Crucial for tracking moving targets (Player) & Manual Arrival Logic
     */
    public update(delta: number) {
        // If we are following/interacting, update the target position
        if (this.activeTargetId && (this.currentAction === 'FOLLOW_ENTITY' || this.currentAction === 'SOCIAL_INTERACT')) {
            const currentPos = this.registry.getPosition(this.activeTargetId);
            if (currentPos) {
                // Update target
                const targetVec = currentPos as unknown as YUKA.Vector3;
                this.arriveBehavior.target.copy(targetVec);

                // Manual Arrival Logic (Smooth Stop)
                // SeekBehavior doesn't stop. We must throttle speed.
                // Distance check is against current vehicle position.
                const dist = this.vehicle.position.distanceTo(targetVec);
                const stopRad = this.currentAction === 'SOCIAL_INTERACT' ? 2.0 : 2.5; // Stop distance
                const slowRad = stopRad + 5.0; // Where to start slowing down

                if (dist < stopRad) {
                    // STOP
                    this.vehicle.maxSpeed = 0;
                    this.vehicle.velocity.set(0, 0, 0); // Hard stop to prevent jitter
                } else if (dist < slowRad) {
                    // SLOW DOWN
                    const factor = (dist - stopRad) / (slowRad - stopRad); // 0.0 to 1.0
                    this.vehicle.maxSpeed = Math.max(0.5, POSTURE_SPEEDS[this.currentPosture] * factor);
                } else {
                    // FULL SPEED
                    this.vehicle.maxSpeed = POSTURE_SPEEDS[this.currentPosture];
                }
            }
        }
    }

    /**
     * The Main Interface. LLM sends a command, Engine executes.
     */
    public execute(cmd: CapabilityCommand): void {
        console.log(`[CapabilityEngine] Executing: ${cmd.type}`);

        this.currentAction = cmd.type;
        this.activeTargetId = null; // Reset target default

        // 1. Apply Posture (Global Modifier)
        if (cmd.posture) {
            this.setPosture(cmd.posture);
        }

        // 2. Reset Active Behaviors
        this.resetTacticalBehaviors();

        // Reset Speed on new command (unless update loop overrides it)
        this.vehicle.maxSpeed = POSTURE_SPEEDS[this.currentPosture];

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
                this.activeTargetId = cmd.params?.target;
                this.executeFollow(cmd.params?.target);
                break;
            case 'SOCIAL_INTERACT':
                this.activeTargetId = cmd.params?.target;
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
        // Initial setup
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
