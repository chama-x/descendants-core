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

// -----------------------------------------------------------------------------
// CONSTANTS (Social Physics)
// -----------------------------------------------------------------------------

// (Moved inside class)

// -----------------------------------------------------------------------------
// CAPABILITY ENGINE (The Tactician)
// -----------------------------------------------------------------------------

export class CapabilityEngine {
    private vehicle: YUKA.Vehicle;
    private currentPosture: Posture = 'WALK';
    private registry: WorldRegistry;

    // Behaviors
    private seekBehavior: YUKA.SeekBehavior;
    private arriveBehavior: any; // Workaround: Types missing for ArriveBehavior
    private wanderBehavior: YUKA.WanderBehavior;
    private separationBehavior: YUKA.SeparationBehavior;
    private obstacleBehavior: YUKA.ObstacleAvoidanceBehavior;

    // State
    public currentAction: string = "IDLE";
    public currentCommand: CapabilityCommand | null = null;
    private activeTargetId: string | null = null;

    // Hysteresis State (The "Calm" Factor)
    private isResting: boolean = false;
    private readonly STOP_THRESHOLD = 2.0;    // Distance to stop
    private readonly RESUME_THRESHOLD = 3.5;  // Distance to resume (Dead zone)

    // Unified Speeds with Player
    private POSTURE_SPEEDS = {
        'IDLE': 0,
        'WALK': 6.0,    // Matched to Player Jog
        'RUN': 14.0,    // Matched to Player Sprint (Was 12.0)
        'SNEAK': 2.5,
        'ALERT': 4.5
    };

    constructor(vehicle: YUKA.Vehicle) {
        this.vehicle = vehicle;
        this.registry = WorldRegistry.getInstance();

        // 1. Initialize Behaviors
        this.seekBehavior = new YUKA.SeekBehavior(new YUKA.Vector3());
        this.seekBehavior.active = false;

        // Use Proper ArriveBehavior for smooth deceleration
        // decelaration: 3 (Slow) to 1 (Fast). 2.5 is a good organic balance.
        // tolerance: 0.5 (How close to get before "success")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ArriveBehavior = (YUKA as any).ArriveBehavior;
        this.arriveBehavior = new ArriveBehavior(new YUKA.Vector3(), 2.5, 0.5);
        this.arriveBehavior.active = false;

        this.wanderBehavior = new YUKA.WanderBehavior();
        this.wanderBehavior.active = false;

        // Dynamic Separation
        this.separationBehavior = new YUKA.SeparationBehavior(AIManager.getInstance().vehicles);
        this.separationBehavior.weight = 3.0;

        // Obstacle Avoidance (Walls/Furniture)
        const obstacles = AIManager.getInstance().getObstacles();
        this.obstacleBehavior = new YUKA.ObstacleAvoidanceBehavior(obstacles);
        this.obstacleBehavior.weight = 5.0;

        // Add to Steering
        this.vehicle.steering.add(this.seekBehavior);
        this.vehicle.steering.add(this.arriveBehavior);
        this.vehicle.steering.add(this.wanderBehavior);
        this.vehicle.steering.add(this.separationBehavior);
        this.vehicle.steering.add(this.obstacleBehavior);

        // Set initial max speed
        this.vehicle.maxSpeed = this.POSTURE_SPEEDS['WALK'];
    }

    /**
     * Update Loop - Called every frame by useYukaAI
     * Handles target tracking and Hysteresis logic
     */
    public update(delta: number, playerPos?: THREE.Vector3) {
        // If we are following/interacting, update the target position
        if (this.currentCommand && this.currentCommand.type === 'FOLLOW_ENTITY' && playerPos) {
            // 1. Auto-Run Logic (Match Player Speed)
            // We need to know player speed. Since we only have position, we can infer or pass it.
            // For now, let's assume if player is > 10m away, we should RUN.
            // OR checks WorldRegistry if available.
            // Better heuristic: Distance based.
            const dist = this.vehicle.position.distanceTo(playerPos);

            if (dist > 15.0) {
                this.currentPosture = 'RUN';
            } else if (dist < 10.0) {
                this.currentPosture = 'WALK';
            }

            // Update Max Speed
            this.vehicle.maxSpeed = this.POSTURE_SPEEDS[this.currentPosture];

            // 2. Stop/Go Hysteresis
            const targetVec = playerPos.clone();
            // Don't stand INSIDE the player. Stop a bit short.
            // We actually rely on ArriveBehavior's tolerance, but let's effectively
            // managing "Active" state to stop the internal engine calculation when close.

            if (this.isResting) {
                if (dist > this.RESUME_THRESHOLD) {
                    this.isResting = false; // WAKE UP
                    this.arriveBehavior.target.copy(targetVec);
                    this.arriveBehavior.active = true;
                } else {
                    // Stay resting, keep braking
                    this.arriveBehavior.active = false;
                    this.vehicle.velocity.set(0, 0, 0);
                }
            } else {
                // We are moving. Check if we should stop.
                this.arriveBehavior.target.copy(targetVec);

                if (dist < this.STOP_THRESHOLD) {
                    this.isResting = true; // STOP
                    this.arriveBehavior.active = false;
                    this.vehicle.velocity.set(0, 0, 0);
                }
            }
        } else if (this.activeTargetId && (this.currentAction === 'SOCIAL_INTERACT')) {
            const currentPos = this.registry.getPosition(this.activeTargetId);

            if (currentPos) {
                const targetVec = currentPos as unknown as YUKA.Vector3;
                const dist = this.vehicle.position.distanceTo(targetVec);

                // --- AAA HYSTERESIS LOOP ---

                if (this.isResting) {
                    // We are resting. Do NOT move until target is far enough.
                    if (dist > this.RESUME_THRESHOLD) {
                        this.isResting = false; // WAKE UP
                        this.arriveBehavior.target.copy(targetVec);
                        this.arriveBehavior.active = true;
                        this.vehicle.maxSpeed = this.POSTURE_SPEEDS[this.currentPosture];
                    } else {
                        // Stay resting, keep braking
                        this.arriveBehavior.active = false;
                        this.vehicle.velocity.set(0, 0, 0);
                    }
                } else {
                    // We are moving. Check if we should stop.
                    this.arriveBehavior.target.copy(targetVec);

                    if (dist < this.STOP_THRESHOLD) {
                        this.isResting = true; // STOP
                        this.arriveBehavior.active = false;
                        this.vehicle.velocity.set(0, 0, 0);
                    }
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
        this.currentCommand = cmd; // Store command for update loop
        this.activeTargetId = null; // Reset target default
        this.isResting = false; // Always wake up on new command

        // 1. Apply Posture (Global Modifier)
        if (cmd.posture) {
            this.setPosture(cmd.posture);
        }

        // 2. Reset Active Behaviors
        this.resetTacticalBehaviors();

        // Reset Speed on new command
        this.vehicle.maxSpeed = this.POSTURE_SPEEDS[this.currentPosture];

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
                this.vehicle.velocity.set(0, 0, 0);
                break;
            case 'INTERNAL_THOUGHT':
                break;
            default:
                console.warn(`[CapabilityEngine] Unknown capability: ${cmd.type}`);
        }
    }

    // --- PRIMITIVE ACTIONS ---

    private setPosture(posture: Posture) {
        this.currentPosture = posture;
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
            // Social interaction needs to be closer, maybe change thresholds?
            // For now, use same follow logic but maybe we update thresholds dynamicly
            this.arriveBehavior.target.copy(pos as unknown as YUKA.Vector3);
            this.arriveBehavior.active = true;
        }
    }
}
