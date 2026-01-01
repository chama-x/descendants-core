import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import { useInteractionStore } from '@/store/interactionStore';
import AIManager from '../Systems/AIManager';
import { WorldRegistry } from '@/lib/yuka-oracle';

export interface Joints {
    hips?: THREE.Group;
    torso?: THREE.Group;
    neck?: THREE.Group;
    leftArm?: { shoulder: THREE.Group; elbow: THREE.Group };
    rightArm?: { shoulder: THREE.Group; elbow: THREE.Group };
    leftHip?: THREE.Group;
    rightHip?: THREE.Group;
    leftKnee?: THREE.Group;
    rightKnee?: THREE.Group;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any; // Allow dynamic access
}

export function useRobotController(groupRef: React.RefObject<THREE.Group | null>) {
    const collidableMeshes = useGameStore((state) => state.collidableMeshes);
    const obstacles = useGameStore((state) => state.obstacles);

    // Register Player in WorldRegistry for Agents to track
    useEffect(() => {
        if (groupRef.current) {
            WorldRegistry.getInstance().registerDynamic('player-01', () => {
                return groupRef.current ? groupRef.current.position : new THREE.Vector3();
            });
            console.log("Player registered in WorldRegistry as 'player-01'");
        }
    }, [groupRef]);

    const inputRef = useRef({ f: false, b: false, l: false, r: false, jump: false, sprint: false, crouch: false, wave: false });
    const state = useRef({
        isWaving: false,
        waveTimer: 0,
        velocity: new THREE.Vector3(),
        isGrounded: false,
        walkTime: 0,
        posture: 'WALK', // 'WALK' | 'RUN' | 'CROUCH'
        idleTime: 0
    });

    const keyBindings = useGameStore((state) => state.keyBindings);

    // Input Handling
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case keyBindings.forward: inputRef.current.f = true; break;
                case keyBindings.backward: inputRef.current.b = true; break;
                case keyBindings.left: inputRef.current.l = true; break;
                case keyBindings.right: inputRef.current.r = true; break;
                case keyBindings.jump: inputRef.current.jump = true; break;
                case keyBindings.sprint: inputRef.current.sprint = true; break;
                case keyBindings.crouch: inputRef.current.crouch = true; break;
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case keyBindings.forward: inputRef.current.f = false; break;
                case keyBindings.backward: inputRef.current.b = false; break;
                case keyBindings.left: inputRef.current.l = false; break;
                case keyBindings.right: inputRef.current.r = false; break;
                case keyBindings.jump: inputRef.current.jump = false; break;
                case keyBindings.sprint: inputRef.current.sprint = false; break;
                case keyBindings.crouch: inputRef.current.crouch = false; break;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [keyBindings]);

    // Unified Physics Constants (Matching Agent Logic)
    const WALK_SPEED = 6.0;
    const RUN_SPEED = 14.0; // Increased for "faster run"
    const CROUCH_SPEED = 2.5;

    const jumpForce = 20.0;
    const gravity = -50.0;
    const radius = 0.8;

    const joints = useRef<Joints>({});

    // Interaction
    const { openInteraction, isOpen, closeInteraction } = useInteractionStore();
    const aiManager = AIManager.getInstance(); // To access agents
    const raycasterRef = useRef(new THREE.Raycaster());

    const interactables = useGameStore((state) => state.interactables);
    const isSitting = useGameStore((state) => state.isSitting);
    const setSitting = useGameStore((state) => state.setSitting);
    const setDebugText = useGameStore((state) => state.setDebugText);

    // Sitting State
    const sitTargetPos = useRef<THREE.Vector3 | null>(null);
    const sitTargetRot = useRef<THREE.Quaternion | null>(null);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === keyBindings.interact) {
                if (isOpen) {
                    closeInteraction();
                    return;
                }

                console.log("Interact key pressed. isSitting:", isSitting);

                if (isSitting) {
                    setSitting(false);
                    sitTargetPos.current = null;
                    sitTargetRot.current = null;
                    state.current.velocity.set(0, 5, 0);
                    state.current.isGrounded = false;
                    if (groupRef.current) {
                        groupRef.current.rotation.x = 0;
                        groupRef.current.rotation.z = 0;
                    }
                    return;
                }

                if (!groupRef.current) return;

                // 1. Raycast for Agents (High Priority)
                raycasterRef.current.set(
                    groupRef.current.position,
                    groupRef.current.getWorldDirection(new THREE.Vector3())
                );

                let bestAgent: { id: string; dist: number } | null = null;
                const agents = aiManager.vehicles;
                const myPos = groupRef.current.position;
                const myDir = groupRef.current.getWorldDirection(new THREE.Vector3());

                for (const agent of agents) {
                    const agentPos = agent.position as unknown as THREE.Vector3;
                    const dist = myPos.distanceTo(agentPos);

                    if (dist < 5.0) { // 5m Range
                        const toAgent = agentPos.clone().sub(myPos).normalize();
                        const dot = myDir.dot(toAgent);

                        if (dot > 0.5) { // Within ~60 degree cone
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const mesh = (agent as any).renderComponent as THREE.Object3D;
                            const agentId = mesh?.userData?.id || 'agent-01';
                            bestAgent = { id: agentId, dist };
                        }
                    }
                }

                if (bestAgent) {
                    console.log("Interacting with Agent:", bestAgent.id);
                    openInteraction(bestAgent.id);
                    return;
                }

                // 2. Interactables (Sofa, etc.) - Fallback
                let nearest = null;
                let minDist = 3.0;

                for (const item of interactables) {
                    if (item.type === 'sofa') {
                        const dist = groupRef.current.position.distanceTo(item.position);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = item;
                        }
                    }
                }

                if (nearest) {
                    setSitting(true);
                    sitTargetPos.current = nearest.position.clone();
                    sitTargetRot.current = nearest.rotation.clone();
                } else {
                    console.log("Nothing to interact with.");
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => { };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [interactables, isSitting, setSitting, groupRef, keyBindings, isOpen, openInteraction, closeInteraction]);


    useFrame((stateRoot, delta) => {
        if (!groupRef.current) return;
        const mesh = groupRef.current;
        const input = inputRef.current;
        const s = state.current;

        // Interaction Prompt
        if (!isSitting) {
            let showPrompt = false;
            for (const item of interactables) {
                if (groupRef.current.position.distanceTo(item.position) < 3.0) {
                    showPrompt = true;
                    break;
                }
            }
            setDebugText(showPrompt ? `Press '${keyBindings.interact.replace('Key', '')}' to Sit` : "");
        } else {
            setDebugText(`Press '${keyBindings.interact.replace('Key', '')}' to Stand`);
        }

        // Clamp delta
        const dt = Math.min(delta, 0.1);

        // Input Processing
        if (isOpen) {
            input.f = false;
            input.b = false;
            input.l = false;
            input.r = false;
            input.jump = false;
            input.sprint = false;
            input.crouch = false;
        }

        // --- UNIFIED SPEED LOGIC ---
        let currentSpeed = WALK_SPEED;
        let posture = 'WALK';

        if (input.crouch) {
            currentSpeed = CROUCH_SPEED;
            posture = 'CROUCH';
        } else if (input.sprint) {
            currentSpeed = RUN_SPEED;
            posture = 'RUN';
        }

        s.posture = posture; // Store for animation
        const moveDist = currentSpeed * dt;

        let inputZ = 0;
        let inputX = 0;
        if (input.f) inputZ = 1;
        if (input.b) inputZ = -1;
        if (input.l) inputX = 1;
        if (input.r) inputX = -1;

        if (inputX !== 0 || inputZ !== 0) {
            const len = Math.sqrt(inputX * inputX + inputZ * inputZ);
            inputX /= len;
            inputZ /= len;
        }

        // Camera-relative movement
        const camera = stateRoot.camera;
        const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        camForward.y = 0;
        camForward.normalize();
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        camRight.y = 0;
        camRight.normalize();

        const moveDir = new THREE.Vector3();
        moveDir.addScaledVector(camForward, inputZ);
        moveDir.addScaledVector(camRight, -inputX);

        if (moveDir.lengthSq() > 0) moveDir.normalize();

        const worldDx = moveDir.x * moveDist;
        const worldDz = moveDir.z * moveDist;

        const isMoving = (inputX !== 0 || inputZ !== 0) && !isOpen;

        if (isSitting && sitTargetPos.current && sitTargetRot.current) {
            groupRef.current.position.lerp(sitTargetPos.current, 0.1);
            groupRef.current.quaternion.slerp(sitTargetRot.current, 0.1);
            s.velocity.set(0, 0, 0);
        } else {
            mesh.rotation.x = 0;
            mesh.rotation.z = 0;

            if (input.wave && !s.isWaving) {
                s.isWaving = true;
                s.waveTimer = 0;
            }

            if (isMoving) {
                const targetAngle = Math.atan2(moveDir.x, moveDir.z);
                let diff = targetAngle - mesh.rotation.y;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                mesh.rotation.y += diff * 10 * dt;
            }

            // Collision
            const proposedX = mesh.position.x + worldDx;
            const proposedZ = mesh.position.z + worldDz;
            let canMove = true;

            for (const ob of obstacles) {
                const distSq = (proposedX - ob.position.x) ** 2 + (proposedZ - ob.position.z) ** 2;
                const minDist = radius + ob.radius;
                if (distSq < minDist * minDist) {
                    canMove = false;
                    break;
                }
            }
            if (canMove) {
                mesh.position.x = proposedX;
                mesh.position.z = proposedZ;
            }

            // Gravity / Ground
            let groundHeight = -10;
            if (collidableMeshes.length > 0) {
                const raycaster = new THREE.Raycaster();
                const rayOrigin = mesh.position.clone();
                rayOrigin.y += 50;
                raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
                const hits = raycaster.intersectObjects(collidableMeshes, true);
                if (hits.length > 0) groundHeight = hits[0].point.y;
            }

            const groundMeshY = groundHeight;

            if (s.isGrounded) {
                if (input.jump) {
                    s.velocity.y = jumpForce;
                    s.isGrounded = false;
                } else {
                    s.velocity.y = 0;
                    mesh.position.y = groundMeshY;
                }
            } else {
                s.velocity.y += gravity * dt;
                mesh.position.y += s.velocity.y * dt;
                if (mesh.position.y <= groundMeshY) {
                    mesh.position.y = groundMeshY;
                    s.isGrounded = true;
                    s.velocity.y = 0;
                }
            }
        }

        // --- Animation Logic ---
        const j = joints.current;
        if (!j.hips || !j.torso || !j.leftArm || !j.rightArm || !j.leftHip || !j.rightHip || !j.leftKnee || !j.rightKnee || !j.neck) {
            return;
        }

        const isCrouching = s.posture === 'CROUCH';
        const isRunning = s.posture === 'RUN';

        // Posture Heights
        const crouchHipHeight = 2.8;
        const standHipHeight = 3.5;
        const targetHipY = isCrouching ? crouchHipHeight : standHipHeight;
        j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, targetHipY, 0.15);
        j.torso.rotation.x = THREE.MathUtils.lerp(j.torso.rotation.x, isCrouching ? 0.5 : 0, 0.1);

        const lerpFactor = 0.15;

        // ... (Sitting Animation logic remains unchanged, omitting for brevity in this replace block if possible, but safer to include if needed. 
        // Wait, replace_file_content replaces the BLOCK. I need to include the sitting logic if I'm replacing the whole function body or large chunk. 
        // The instructions said "Replace the player controller logic". I will include the sitting logic to be safe.)

        if (isSitting) {
            // Vibing Pose
            const t = stateRoot.clock.getElapsedTime();
            j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, 1.9, 0.1);
            j.hips.position.z = THREE.MathUtils.lerp(j.hips.position.z, 0.0, 0.1);
            j.torso.rotation.x = THREE.MathUtils.lerp(j.torso.rotation.x, -0.3, 0.1);
            j.neck.rotation.x = Math.sin(t * 8) * 0.05;
            j.neck.rotation.y = Math.sin(t * 2) * 0.1;
            j.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.z, 0.5, 0.1);
            j.leftArm.shoulder.rotation.y = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.y, -0.5, 0.1);
            j.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.z, -0.5, 0.1);
            j.rightArm.shoulder.rotation.y = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.y, 0.5, 0.1);
            j.leftHip.rotation.x = THREE.MathUtils.lerp(j.leftHip.rotation.x, -1.6, 0.1);
            j.rightHip.rotation.x = THREE.MathUtils.lerp(j.rightHip.rotation.x, -1.6, 0.1);
            j.leftKnee.rotation.x = THREE.MathUtils.lerp(j.leftKnee.rotation.x, 1.6, 0.1);
            j.rightKnee.rotation.x = THREE.MathUtils.lerp(j.rightKnee.rotation.x, 1.6, 0.1);
            j.leftHip.rotation.z = THREE.MathUtils.lerp(j.leftHip.rotation.z, -0.15, 0.1);
            j.rightHip.rotation.z = THREE.MathUtils.lerp(j.rightHip.rotation.z, 0.15, 0.1);
            return;
        }

        if (s.isWaving) {
            s.waveTimer += dt;
            const waveSpeed = 12;
            const liftDuration = 0.4;
            const liftProgress = Math.min(s.waveTimer / liftDuration, 1);
            const targetShoulderZ = -2.8;
            const targetElbowZ = -0.8;
            const easedLift = 1 - Math.pow(1 - liftProgress, 3);

            const currentShoulderZ = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.z, targetShoulderZ, easedLift);
            const currentElbowZ = THREE.MathUtils.lerp(j.rightArm.elbow.rotation.z, targetElbowZ, easedLift);

            if (liftProgress >= 1) {
                const wave = Math.sin((s.waveTimer - liftDuration) * waveSpeed) * 0.4;
                j.rightArm.shoulder.rotation.z = targetShoulderZ + wave;
                j.rightArm.elbow.rotation.z = targetElbowZ + wave * 0.2;
            } else {
                j.rightArm.shoulder.rotation.z = currentShoulderZ;
                j.rightArm.elbow.rotation.z = currentElbowZ;
            }

            j.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.x, 0, lerpFactor);
            j.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.z, 0.2, lerpFactor);
            j.leftHip.rotation.x = THREE.MathUtils.lerp(j.leftHip.rotation.x, 0, lerpFactor);
            j.rightHip.rotation.x = THREE.MathUtils.lerp(j.rightHip.rotation.x, 0, lerpFactor);
            j.leftHip.rotation.z = THREE.MathUtils.lerp(j.leftHip.rotation.z, 0, lerpFactor);
            j.rightHip.rotation.z = THREE.MathUtils.lerp(j.rightHip.rotation.z, 0, lerpFactor);

            if (s.waveTimer > 2.5) {
                s.isWaving = false;
            }
        } else if (isMoving && s.isGrounded) {

            // Speed of animation loop depends on speed of movement
            const animSpeed = isRunning ? 15 : (isCrouching ? 8 : 10);
            s.walkTime += dt * animSpeed;

            const legAmp = isCrouching ? 0.3 : (isRunning ? 1.0 : 0.6);
            const baseKneeBend = isCrouching ? 0.8 : (isRunning ? 0.6 : 0.2);
            const kneeAmp = isCrouching ? 0.2 : (isRunning ? 0.6 : 0.3);

            const crouchHipOffset = isCrouching ? -0.5 : 0;

            // Bobbing scale - Sprint has higher "flight phase"
            const bobScale = isRunning ? 0.4 : 0.15;
            const bobFreq = isRunning ? 2 : 2; // Both bounce twice per cycle
            j.hips.position.y = THREE.MathUtils.lerp(j.hips.position.y, (isCrouching ? 2.8 : 3.5) + Math.sin(s.walkTime * bobFreq) * bobScale, lerpFactor);

            // --- Biomechanical Rotations ---
            // 1. Hip Yaw: Hips rotate to extend stride (Left leg forward = Hips Turn Right)
            const hipYawAmp = isRunning ? 0.15 : 0.08;
            j.hips.rotation.y = Math.sin(s.walkTime) * -hipYawAmp;

            // 2. Hip Roll: Hips drop on the swing side (Trendelenburg sign-lite)
            const hipRollAmp = isRunning ? 0.05 : 0.08;
            j.hips.rotation.z = Math.cos(s.walkTime) * hipRollAmp;

            // 3. Torso Counter-Rotation: Shoulders rotate opposite to hips
            const torsoYawAmp = isRunning ? 0.3 : 0.15;
            j.torso.rotation.y = Math.sin(s.walkTime) * torsoYawAmp;

            // Legs
            j.leftHip.rotation.x = Math.sin(s.walkTime) * legAmp + crouchHipOffset;
            j.leftKnee.rotation.x = Math.abs(Math.cos(s.walkTime)) * kneeAmp + baseKneeBend;

            j.rightHip.rotation.x = Math.sin(s.walkTime + Math.PI) * legAmp + crouchHipOffset;
            j.rightKnee.rotation.x = Math.abs(Math.cos(s.walkTime + Math.PI)) * kneeAmp + baseKneeBend;

            // Reset spread (overridden by Hip Roll above, so we modify this)
            // Actually, we should ADD spread if needed, but let's keep it simple.
            // Hip Roll handles the sway now.
            // j.leftHip.rotation.z = ... 


            if (isCrouching) {
                j.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.x, -0.5, lerpFactor);
                j.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.x, -0.5, lerpFactor);
                j.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.z, 0.8, lerpFactor);
                j.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.z, -0.8, lerpFactor);
            } else {
                const armAmp = isRunning ? 1.2 : 0.6;
                j.leftArm.shoulder.rotation.x = Math.sin(s.walkTime + Math.PI) * armAmp;
                j.rightArm.shoulder.rotation.x = Math.sin(s.walkTime) * armAmp;

                // TUCK ARMS IN: Negative Z to pull slightly across/down
                const armTuck = isRunning ? -0.2 : 0.2;
                j.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.z, armTuck, lerpFactor);
                j.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.z, -armTuck, lerpFactor);

                // DYNAMIC YAW (Hand-to-Cheek Mechanism)
                // We want Internal Rotation (Hand In) when Arm is Swing Forward (Flexion).
                // Left Arm: Swing is sin(t + PI). Max Forward is +1.
                // We want Max Inward Rotation (-Y) at that peak.
                // So: -1 * (SwingPhase + 1) * magnitude

                const yawAmp = isRunning ? 0.6 : 0.1;
                const yawBias = isRunning ? -0.5 : 0; // Base internal rotation

                // Left: Forward = sin(t + PI). Inward = -Y.
                const leftSwing = Math.sin(s.walkTime + Math.PI);
                // Map [-1, 1] to [0, 1] (Back to Front) -> (leftSwing + 1) * 0.5
                // We want more inward rotation as it comes forward.
                const leftDynamicYaw = (leftSwing * 0.5 + 0.5) * -yawAmp + yawBias;

                // Right: Forward = sin(t). Inward = +Y (Right arm mirrors).
                const rightSwing = Math.sin(s.walkTime);
                const rightDynamicYaw = (rightSwing * 0.5 + 0.5) * yawAmp - yawBias;

                // Note: Right arm internal rotation is usually +Y? 
                // Left internal is -Y?
                // Left Arm X-axis points Left. +Y rotates thumb down/in? No, usually +Y is back. 
                // Let's assume Left -Y is In, Right +Y is In.

                j.leftArm.shoulder.rotation.y = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.y, leftDynamicYaw, lerpFactor);
                j.rightArm.shoulder.rotation.y = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.y, rightDynamicYaw, lerpFactor);
            }
            j.rightArm.elbow.rotation.z = THREE.MathUtils.lerp(j.rightArm.elbow.rotation.z, isRunning ? -1.5 : 0, lerpFactor); // Bend elbows on run
            j.leftArm.elbow.rotation.z = THREE.MathUtils.lerp(j.leftArm.elbow.rotation.z, isRunning ? 1.5 : 0, lerpFactor);

        } else if (!s.isGrounded) {
            // Jump Pose
            j.leftHip.rotation.x = THREE.MathUtils.lerp(j.leftHip.rotation.x, 0.5, lerpFactor);
            j.rightHip.rotation.x = THREE.MathUtils.lerp(j.rightHip.rotation.x, 0.2, lerpFactor);
            j.leftKnee.rotation.x = THREE.MathUtils.lerp(j.leftKnee.rotation.x, 0.8, lerpFactor);
            j.rightKnee.rotation.x = THREE.MathUtils.lerp(j.rightKnee.rotation.x, 0.1, lerpFactor);
            j.rightArm.elbow.rotation.z = THREE.MathUtils.lerp(j.rightArm.elbow.rotation.z, 0, lerpFactor);
            j.leftHip.rotation.z = THREE.MathUtils.lerp(j.leftHip.rotation.z, 0, lerpFactor);
            j.rightHip.rotation.z = THREE.MathUtils.lerp(j.rightHip.rotation.z, 0, lerpFactor);
        } else {
            // Idle
            s.idleTime += dt;
            const breath = Math.sin(s.idleTime * 1.5);
            const microMovement = Math.cos(s.idleTime * 0.8);

            const baseKneeBend = isCrouching ? 0.9 : 0.1 + breath * 0.02;
            const baseHipBend = isCrouching ? -0.6 : -0.1 - breath * 0.02;

            j.leftHip.rotation.x = THREE.MathUtils.lerp(j.leftHip.rotation.x, baseHipBend, lerpFactor);
            j.rightHip.rotation.x = THREE.MathUtils.lerp(j.rightHip.rotation.x, baseHipBend + microMovement * 0.02, lerpFactor);
            j.leftKnee.rotation.x = THREE.MathUtils.lerp(j.leftKnee.rotation.x, baseKneeBend, lerpFactor);
            j.rightKnee.rotation.x = THREE.MathUtils.lerp(j.rightKnee.rotation.x, baseKneeBend - microMovement * 0.02, lerpFactor);

            // Reset spread
            j.leftHip.rotation.z = THREE.MathUtils.lerp(j.leftHip.rotation.z, 0, lerpFactor);
            j.rightHip.rotation.z = THREE.MathUtils.lerp(j.rightHip.rotation.z, 0, lerpFactor);

            j.torso.rotation.x = THREE.MathUtils.lerp(j.torso.rotation.x, (isCrouching ? 0.5 : 0) + breath * 0.03, lerpFactor);
            j.neck.rotation.x = THREE.MathUtils.lerp(j.neck.rotation.x, -breath * 0.03 + microMovement * 0.02, lerpFactor);

            if (isCrouching) {
                j.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.x, -0.4 + breath * 0.05, lerpFactor);
                j.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.x, -0.4 + breath * 0.05, lerpFactor);
                j.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.z, 0.5, lerpFactor);
                j.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.z, -0.5, lerpFactor);
            } else {
                j.leftArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.x, breath * 0.05, lerpFactor);
                j.rightArm.shoulder.rotation.x = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.x, -breath * 0.05, lerpFactor);
                j.leftArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.leftArm.shoulder.rotation.z, 0.2 + microMovement * 0.03, lerpFactor);
                j.rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(j.rightArm.shoulder.rotation.z, -0.2 - microMovement * 0.03, lerpFactor);
            }
            j.rightArm.elbow.rotation.z = THREE.MathUtils.lerp(j.rightArm.elbow.rotation.z, 0, lerpFactor);
        }
    });

    return { joints };
}
