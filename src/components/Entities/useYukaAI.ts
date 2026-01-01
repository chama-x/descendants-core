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

        const WATER_SURFACE_Y = 0.0;
        // AI enters swim mode when waist deep
        const inWater = vehicle.position.y < (WATER_SURFACE_Y - 0.8);

        if (inWater) {
            // --- AI SWIMMING PHYSICS ---
            const targetSurfaceY = WATER_SURFACE_Y - 0.75;
            const bob = Math.sin(state.clock.getElapsedTime() * 2) * 0.05;

            // Float to surface
            vehicle.position.y = THREE.MathUtils.lerp(vehicle.position.y, targetSurfaceY + bob, 0.1);

            // Apply Drag (Slow down AI in water)
            vehicle.velocity.multiplyScalar(0.95);

        } else {
            // --- GROUND CLAMPING (Land Physics) ---
            if (collidableMeshes.length > 0 && frameRef.current % 2 === 0) {
                const raycaster = raycasterRef.current;
                raycaster.set(
                    new THREE.Vector3(vehicle.position.x, vehicle.position.y + 5, vehicle.position.z),
                    rayDirRef.current
                );
                const hits = raycaster.intersectObjects(collidableMeshes, true);
                if (hits.length > 0) {
                    const groundY = hits[0].point.y;
                    // Only clamp if above ground or falling slightly
                    if (vehicle.position.y > groundY - 0.5) {
                        vehicle.position.y = THREE.MathUtils.lerp(vehicle.position.y, groundY, 0.2);
                    }
                }
            }
        }

        // 2. Animation Blending (Procedural)
        animateProcedural(vehicle, joints, walkTime, dt, inWater, state.clock.getElapsedTime());
    });

    return { vehicle: vehicleRef.current, brain: brainRef.current };
}

// --- PROCEDURAL ANIMATION ---
function animateProcedural(
    vehicle: YUKA.Vehicle,
    joints: React.MutableRefObject<any>,
    walkTime: React.MutableRefObject<number>,
    dt: number,
    inWater: boolean,
    totalTime: number
) {
    const speed = vehicle.velocity.length();
    const j = joints.current;
    const lerpFactor = 0.1; // For smoothing transitions

    if (!j.hips) return;

    if (inWater) {
        // --- SWIMMING ANIMATION (Ported from Player) ---
        walkTime.current += dt * 6.0;

        // 1. Posture (Prone)
        j.hips.rotation.x = THREE.MathUtils.lerp(j.hips.rotation.x, 1.6, lerpFactor);
        j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, 4.2, lerpFactor);
        j.neck.rotation.x = THREE.MathUtils.lerp(j.neck.rotation.x, -1.2, lerpFactor);

        // 2. Body Roll
        const bodyRoll = Math.sin(walkTime.current) * 0.4;
        j.hips.rotation.z = bodyRoll;
        j.torso.rotation.z = bodyRoll * 0.5;

        // 3. Arms (Alternating Crawl)
        j.leftArm.shoulder.rotation.x = -Math.PI / 2 + Math.sin(walkTime.current) * 1.5;
        j.leftArm.shoulder.rotation.z = Math.max(0, -Math.cos(walkTime.current)) + 0.2;
        j.leftArm.elbow.rotation.z = Math.max(0, -Math.cos(walkTime.current) * 1.5);

        j.rightArm.shoulder.rotation.x = -Math.PI / 2 + Math.sin(walkTime.current + Math.PI) * 1.5;
        j.rightArm.shoulder.rotation.z = -(Math.max(0, -Math.cos(walkTime.current + Math.PI)) + 0.2);
        j.rightArm.elbow.rotation.z = -(Math.max(0, -Math.cos(walkTime.current + Math.PI) * 1.5));

        // 4. Legs (Flutter)
        const kickFreq = 12.0;
        j.leftHip.rotation.x = Math.sin(totalTime * kickFreq) * 0.3;
        j.rightHip.rotation.x = Math.sin(totalTime * kickFreq + Math.PI) * 0.3;
        j.leftKnee.rotation.x = 0.3 + Math.sin(totalTime * kickFreq) * 0.3;
        j.rightKnee.rotation.x = 0.3 + Math.sin(totalTime * kickFreq + Math.PI) * 0.3;

        // Reset Standing Rotations
        j.hips.rotation.y = THREE.MathUtils.lerp(j.hips.rotation.y, 0, lerpFactor);
        j.torso.rotation.y = THREE.MathUtils.lerp(j.torso.rotation.y, 0, lerpFactor);

    } else if (speed > 0.1) {
        // --- MOVING (WALK/RUN) ---
        const isRunning = speed > 6.0;
        walkTime.current += dt * (isRunning ? 13.0 : 9.0);

        const legAmp = isRunning ? 1.0 : 0.6;
        const kneeAmp = isRunning ? 0.6 : 0.3;

        // Hips Bob
        const bobScale = isRunning ? 0.35 : 0.15;
        j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, 3.5 + Math.sin(walkTime.current * 2) * bobScale, lerpFactor);

        // Reset Swim Rotations
        j.hips.rotation.x = THREE.MathUtils.lerp(j.hips.rotation.x, 0, lerpFactor);

        // Biomechanical Rotations
        const hipYawAmp = isRunning ? 0.1 : 0.05;
        j.hips.rotation.y = Math.sin(walkTime.current) * -hipYawAmp;

        const hipRollAmp = isRunning ? 0.02 : 0.03;
        j.hips.rotation.z = Math.cos(walkTime.current) * hipRollAmp;

        const torsoYawAmp = isRunning ? 0.15 : 0.08;
        j.torso.rotation.y = Math.sin(walkTime.current) * torsoYawAmp;

        // Legs
        j.leftHip.rotation.x = Math.sin(walkTime.current) * legAmp;
        j.leftKnee.rotation.x = Math.abs(Math.cos(walkTime.current)) * kneeAmp + 0.2;

        j.rightHip.rotation.x = Math.sin(walkTime.current + Math.PI) * legAmp;
        j.rightKnee.rotation.x = Math.abs(Math.cos(walkTime.current + Math.PI)) * kneeAmp + 0.2;

        // Arms (Runner Arms)
        const armAmp = isRunning ? 1.2 : 0.6;
        const armTuck = isRunning ? 0.05 : 0.2;

        j.leftArm.shoulder.rotation.x = Math.sin(walkTime.current + Math.PI) * armAmp;
        j.rightArm.shoulder.rotation.x = Math.sin(walkTime.current) * armAmp;
        j.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.z, armTuck, lerpFactor);
        j.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.z, -armTuck, lerpFactor);

        // Dynamic Yaw
        const yawAmp = isRunning ? 0.8 : 0.1;
        const yawBias = isRunning ? -0.5 : 0;

        const leftSwing = Math.sin(walkTime.current + Math.PI);
        const leftDynamicYaw = (leftSwing * 0.5 + 0.5) * -yawAmp + yawBias;
        const rightSwing = Math.sin(walkTime.current);
        const rightDynamicYaw = (rightSwing * 0.5 + 0.5) * yawAmp - yawBias;

        j.leftArm.shoulder.rotation.y = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.y, leftDynamicYaw, lerpFactor);
        j.rightArm.shoulder.rotation.y = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.y, rightDynamicYaw, lerpFactor);

        j.leftArm.elbow.rotation.z = THREE.MathUtils.lerp(j.leftArm.elbow.rotation.z, isRunning ? 1.5 : 0, lerpFactor);
        j.rightArm.elbow.rotation.z = THREE.MathUtils.lerp(j.rightArm.elbow.rotation.z, isRunning ? -1.5 : 0, lerpFactor);

        j.torso.rotation.x = THREE.MathUtils.lerp(j.torso.rotation.x, isRunning ? 0.4 : 0.1, lerpFactor);
        j.neck.rotation.y = THREE.MathUtils.lerp(j.neck.rotation.y, 0, lerpFactor);
        j.neck.rotation.x = THREE.MathUtils.lerp(j.neck.rotation.x, 0, lerpFactor);


    } else {
        // --- IDLE ---
        walkTime.current += dt;
        j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, 3.5 + Math.sin(walkTime.current) * 0.05, lerpFactor);

        // Reset ALL rotations
        j.hips.rotation.x = THREE.MathUtils.lerp(j.hips.rotation.x, 0, lerpFactor);
        j.hips.rotation.z = THREE.MathUtils.lerp(j.hips.rotation.z, 0, lerpFactor);
        j.leftHip.rotation.x = THREE.MathUtils.lerp(j.leftHip.rotation.x, 0, lerpFactor);
        j.rightHip.rotation.x = THREE.MathUtils.lerp(j.rightHip.rotation.x, 0, lerpFactor);
        j.leftKnee.rotation.x = THREE.MathUtils.lerp(j.leftKnee.rotation.x, 0, lerpFactor);
        j.rightKnee.rotation.x = THREE.MathUtils.lerp(j.rightKnee.rotation.x, 0, lerpFactor);
        j.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.x, 0, lerpFactor);
        j.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.x, 0, lerpFactor);
        j.torso.rotation.x = THREE.MathUtils.lerp(j.torso.rotation.x, 0, lerpFactor);
        j.neck.rotation.y = THREE.MathUtils.lerp(j.neck.rotation.y, 0, lerpFactor);
        j.neck.rotation.x = THREE.MathUtils.lerp(j.neck.rotation.x, 0, lerpFactor);
    }
}

