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
        if (frameRef.current % brainIntervalRef.current === 0) {
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
                engine.currentAction // Pass current capability as 'Behavior'
            ).then(command => {
                if (command) {
                    // Send Order to Tactician
                    engine.execute(command);
                }
            });
        }

        // --- PHYSICS & ANIMATION ---

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
    const isRunning = speed > 6.0;
    const j = joints.current;

    if (!j.hips) return;

    if (speed > 0.1) {
        walkTime.current += dt * (isRunning ? 15 : 10);
        const w = walkTime.current;
        const legAmp = isRunning ? 0.8 : 0.6;

        j.leftHip.rotation.x = Math.sin(w) * legAmp;
        j.rightHip.rotation.x = Math.sin(w + Math.PI) * legAmp;
        j.leftArm.shoulder.rotation.x = Math.sin(w + Math.PI) * legAmp;
        j.rightArm.shoulder.rotation.x = Math.sin(w) * legAmp;

        // Bobbing
        j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, 3.5 + Math.sin(w * 2) * 0.1, 0.1);
    } else {
        // Idle
        walkTime.current += dt;
        j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, 3.5 + Math.sin(walkTime.current) * 0.05, 0.1);

        // Reset limbs
        j.leftHip.rotation.x = THREE.MathUtils.lerp(j.leftHip.rotation.x, 0, 0.1);
        j.rightHip.rotation.x = THREE.MathUtils.lerp(j.rightHip.rotation.x, 0, 0.1);
        j.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.x, 0, 0.1);
        j.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.x, 0, 0.1);
    }
}
