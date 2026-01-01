import { useEffect, useRef } from 'react';
import * as YUKA from 'yuka';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import AIManager from '../Systems/AIManager';
import { useGameStore } from '@/store/gameStore';
import { ClientBrain } from '../Systems/ClientBrain';
import { NearbyEntity } from '@/app/actions';
import { CapabilityEngine } from '@/lib/capability-engine';

export function useYukaAI(
    groupRef: React.RefObject<THREE.Group | null>,
    playerRef: React.RefObject<THREE.Group | null>,
    joints: React.MutableRefObject<any>,
    agentId: string = 'agent-01'
) {
    const vehicleRef = useRef<YUKA.Vehicle | null>(null);
    const aiManager = AIManager.getInstance();
    const obstacles = useGameStore((state) => state.obstacles);
    const collidableMeshes = useGameStore((state) => state.collidableMeshes);
    const aiSettings = useGameStore((state) => state.aiSettings);

    // Engine & Brain
    const capabilityEngineRef = useRef<CapabilityEngine | null>(null);
    const brainRef = useRef(new ClientBrain());
    const brainIntervalRef = useRef(300 + Math.floor(Math.random() * 100)); // Stagger updates

    const frameRef = useRef(0);
    const walkTime = useRef(0);

    // Refs for optimization
    const raycasterRef = useRef(new THREE.Raycaster());
    const rayOriginRef = useRef(new THREE.Vector3());
    const rayDirRef = useRef(new THREE.Vector3(0, -1, 0));

    useEffect(() => {
        if (!groupRef.current) return;

        // 1. Create Vehicle
        const vehicle = new YUKA.Vehicle();
        vehicle.maxSpeed = 3.5; // Default walk speed
        vehicle.maxForce = 20.0;
        vehicle.mass = 1.0;
        vehicle.boundingRadius = 2.0;

        // Sync initial position
        vehicle.position.copy(groupRef.current.position as unknown as YUKA.Vector3);
        vehicle.rotation.copy(groupRef.current.quaternion as unknown as YUKA.Quaternion);

        // Sync Render Component
        vehicle.setRenderComponent(groupRef.current, (entity, renderComponent) => {
            const mesh = renderComponent as THREE.Group;
            mesh.position.copy(entity.position as unknown as THREE.Vector3);
            mesh.quaternion.copy(entity.rotation as unknown as THREE.Quaternion);
        });

        // 2. Initialize Capability Engine (The Tactician)
        // This handles all behaviors internally (Seek, Arrive, etc.)
        const engine = new CapabilityEngine(vehicle);
        capabilityEngineRef.current = engine;

        // Register capability engine for direct command injection
        aiManager.registerCapabilityEngine(agentId, engine);

        // 3. Register with Manager
        vehicleRef.current = vehicle;
        aiManager.addEntity(vehicle);

        return () => {
            aiManager.removeEntity(vehicle);
        };
    }, []); // Run once on mount

    useFrame((state, delta) => {
        const vehicle = vehicleRef.current;
        const engine = capabilityEngineRef.current;
        if (!vehicle || !engine) return;

        const dt = Math.min(delta, 0.1);
        frameRef.current++;

        // --- BRAIN UPDATE (The Strategist) ---
        if (aiSettings.enabled && frameRef.current % brainIntervalRef.current === 0) {
            // Construct Perception
            const nearbyEntities: NearbyEntity[] = [];
            if (playerRef.current) {
                const dist = vehicle.position.distanceTo(playerRef.current.position as unknown as YUKA.Vector3);
                if (dist < 30) {
                    nearbyEntities.push({
                        type: 'PLAYER', id: 'player-01', distance: dist, status: 'Active'
                    });
                }
            }

            // Consult LLM
            brainRef.current.update(
                vehicle.position as unknown as THREE.Vector3,
                nearbyEntities,
                engine.currentAction, // Pass current capability as 'Behavior'
                aiSettings.allowedCommands,
                aiSettings.llmEnabled
            ).then(command => {
                if (command) {
                    // Send Order to Tactician
                    engine.execute(command);
                }
            });
        } else if (!aiSettings.enabled) {
            // Force Idle if disabled
            if (engine.currentAction !== 'IDLE') {
                engine.execute({ type: 'IDLE', posture: 'WALK' });
            }
        }

        // --- PHYSICS & ANIMATION ---

        // Update Tactical Engine (e.g. tracking moving targets)
        const playerPos = playerRef.current ? playerRef.current.position : undefined;
        engine.update(dt, playerPos);

        // 1. Ground Clamping (Simplified)
        if (collidableMeshes.length > 0 && frameRef.current % 2 === 0) {
            const raycaster = raycasterRef.current;
            raycaster.set(
                new THREE.Vector3(vehicle.position.x, vehicle.position.y + 5, vehicle.position.z),
                rayDirRef.current
            );
            const hits = raycaster.intersectObjects(collidableMeshes, true);
            if (hits.length > 0) {
                const groundY = hits[0].point.y;
                if (vehicle.position.y > groundY) {
                    vehicle.position.y = THREE.MathUtils.lerp(vehicle.position.y, groundY, 0.2);
                }
            }
        }

        // 2. Animation Blending (Procedural)
        animateProcedural(vehicle, joints, walkTime, dt);
    });

    return { vehicle: vehicleRef.current, brain: brainRef.current };
}

// --- PROCEDURAL ANIMATION (Moved out for clarity) ---
function animateProcedural(vehicle: YUKA.Vehicle, joints: React.MutableRefObject<any>, walkTime: React.MutableRefObject<number>, dt: number) {
    const speed = vehicle.velocity.length();
    const j = joints.current;
    const lerpFactor = 0.1; // For smoothing transitions

    if (!j.hips) return;

    if (speed > 0.1) {
        // --- MOVING ---
        const isRunning = speed > 8.0; // Lowered threshold for responsiveness
        // Slower cadence to match physics speed (Legs were "too fast")
        walkTime.current += dt * (isRunning ? 13.0 : 9.0);

        const legAmp = isRunning ? 1.0 : 0.6; // Bigger strides
        const kneeAmp = isRunning ? 0.6 : 0.3; // High knees

        // Hips Bob (Flight Phase)
        const bobScale = isRunning ? 0.35 : 0.15;
        j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, 3.5 + Math.sin(walkTime.current * 2) * bobScale, lerpFactor);

        // --- Biomechanical Rotations ---
        // 1. Hip Yaw
        const hipYawAmp = isRunning ? 0.1 : 0.05;
        j.hips.rotation.y = Math.sin(walkTime.current) * -hipYawAmp;

        // 2. Hip Roll
        const hipRollAmp = isRunning ? 0.02 : 0.03;
        j.hips.rotation.z = Math.cos(walkTime.current) * hipRollAmp;

        // 3. Torso Counter-Rotation
        const torsoYawAmp = isRunning ? 0.15 : 0.08;
        j.torso.rotation.y = Math.sin(walkTime.current) * torsoYawAmp;

        // Legs
        j.leftHip.rotation.x = Math.sin(walkTime.current) * legAmp;
        j.leftKnee.rotation.x = Math.abs(Math.cos(walkTime.current)) * kneeAmp + 0.2;

        j.rightHip.rotation.x = Math.sin(walkTime.current + Math.PI) * legAmp;
        j.rightKnee.rotation.x = Math.abs(Math.cos(walkTime.current + Math.PI)) * kneeAmp + 0.2;

        // Arms (Runner Arms)
        const armAmp = isRunning ? 1.2 : 0.6; // Vigorous swing
        j.leftArm.shoulder.rotation.x = Math.sin(walkTime.current + Math.PI) * armAmp;
        j.rightArm.shoulder.rotation.x = Math.sin(walkTime.current) * armAmp;

        // TUCK ARMS IN: Relaxed tuck
        const armTuck = isRunning ? 0.05 : 0.2;
        j.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.z, armTuck, lerpFactor);
        j.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.z, -armTuck, lerpFactor);

        // DYNAMIC YAW (Hand-to-Cheek Mechanism)
        const yawAmp = isRunning ? 0.8 : 0.1; // Increased to 0.8
        const yawBias = isRunning ? -0.5 : 0;

        // Left Arm
        const leftSwing = Math.sin(walkTime.current + Math.PI);
        const leftDynamicYaw = (leftSwing * 0.5 + 0.5) * -yawAmp + yawBias;

        // Right Arm (Mirrored)
        const rightSwing = Math.sin(walkTime.current);
        const rightDynamicYaw = (rightSwing * 0.5 + 0.5) * yawAmp - yawBias;

        j.leftArm.shoulder.rotation.y = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.y, leftDynamicYaw, lerpFactor);
        j.rightArm.shoulder.rotation.y = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.y, rightDynamicYaw, lerpFactor);

        // Elbows (Bend when running)
        // Resetting X-bend which might be default T-pose artifact from broken code before
        // j.leftArm.elbow.rotation.x ... ignore

        j.leftArm.elbow.rotation.z = THREE.MathUtils.lerp(j.leftArm.elbow.rotation.z, isRunning ? 1.5 : 0, lerpFactor);
        j.rightArm.elbow.rotation.z = THREE.MathUtils.lerp(j.rightArm.elbow.rotation.z, isRunning ? -1.5 : 0, lerpFactor);


        // Lean into run
        j.torso.rotation.x = THREE.MathUtils.lerp(j.torso.rotation.x, isRunning ? 0.4 : 0.1, lerpFactor);
        j.neck.rotation.y = THREE.MathUtils.lerp(j.neck.rotation.y, 0, lerpFactor);

    } else {
        // Idle
        walkTime.current += dt;
        j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, 3.5 + Math.sin(walkTime.current) * 0.05, lerpFactor);

        // Reset limbs
        j.leftHip.rotation.x = THREE.MathUtils.lerp(j.leftHip.rotation.x, 0, lerpFactor);
        j.rightHip.rotation.x = THREE.MathUtils.lerp(j.rightHip.rotation.x, 0, lerpFactor);
        j.leftKnee.rotation.x = THREE.MathUtils.lerp(j.leftKnee.rotation.x, 0, lerpFactor);
        j.rightKnee.rotation.x = THREE.MathUtils.lerp(j.rightKnee.rotation.x, 0, lerpFactor);
        j.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.x, 0, lerpFactor);
        j.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.x, 0, lerpFactor);
        j.torso.rotation.x = THREE.MathUtils.lerp(j.torso.rotation.x, 0, lerpFactor);
        j.neck.rotation.y = THREE.MathUtils.lerp(j.neck.rotation.y, 0, lerpFactor);
    }
}

