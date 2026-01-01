/* eslint-disable react-hooks/immutability */
import React, { useRef, useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useYukaAI } from './useYukaAI';
import { createMaterials } from '../Systems/Materials';
import { Joints } from './useRobotController';
import { getActiveModel } from '@/lib/groq';

export default function AIRobot({
    playerRef,
    initialPosition = [10, 5, -330],
    agentId = 'agent-01'
}: {
    playerRef: React.RefObject<THREE.Group | null>,
    initialPosition?: [number, number, number],
    agentId?: string
}) {
    const groupRef = useRef<THREE.Group>(null);
    const joints = useRef<any>({});
    const { vehicle, brain } = useYukaAI(groupRef, playerRef, joints);

    // HUD State (for reactive updates)
    const [hudState, setHudState] = useState({
        thought: 'Initializing...',
        isThinking: false,
        model: 'Loading...'
    });

    // Sync brain state to HUD every 500ms
    useEffect(() => {
        const interval = setInterval(() => {
            if (brain) {
                setHudState({
                    thought: brain.state.thought,
                    isThinking: brain.state.isThinking,
                    model: getActiveModel().split('/').pop() || 'Unknown'
                });
            }
        }, 500);
        return () => clearInterval(interval);
    }, [brain]);

    const { bodyMat, jointMat, glowMat } = useMemo(() => {
        const mats = createMaterials();
        const redGlow = new THREE.MeshBasicMaterial({ color: 0xff0000, toneMapped: false });
        return { bodyMat: mats.robotBody, jointMat: mats.robotJoint, glowMat: redGlow };
    }, []);

    return (
        <group ref={groupRef} position={initialPosition}>
            {/* Floating HUD above head */}
            <Html
                position={[0, 8, 0]}
                center
                distanceFactor={15}
                occlude
                style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                <div style={{
                    background: 'rgba(0, 0, 0, 0.85)',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    minWidth: '180px',
                    maxWidth: '250px',
                    border: hudState.isThinking ? '2px solid #00ff88' : '1px solid #444',
                    boxShadow: hudState.isThinking ? '0 0 10px #00ff88' : 'none',
                    transition: 'all 0.3s ease'
                }}>
                    {/* Model Badge */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                        paddingBottom: '4px',
                        borderBottom: '1px solid #333'
                    }}>
                        <span style={{ color: '#888', fontSize: '9px' }}>{agentId}</span>
                        <span style={{
                            background: '#1a1a2e',
                            color: '#00d4ff',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: 'bold'
                        }}>
                            {hudState.model}
                        </span>
                    </div>

                    {/* Status */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '4px'
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: hudState.isThinking ? '#00ff88' : '#666',
                            animation: hudState.isThinking ? 'pulse 1s infinite' : 'none'
                        }} />
                        <span style={{ color: hudState.isThinking ? '#00ff88' : '#888', fontSize: '10px' }}>
                            {hudState.isThinking ? 'Thinking...' : 'Idle'}
                        </span>
                    </div>

                    {/* Thought */}
                    <div style={{
                        color: '#ddd',
                        fontSize: '10px',
                        lineHeight: '1.3',
                        wordBreak: 'break-word'
                    }}>
                        "{hudState.thought.length > 80 ? hudState.thought.substring(0, 77) + '...' : hudState.thought}"
                    </div>
                </div>
            </Html>

            <group ref={(el) => { if (el && joints.current) joints.current.hips = el; }} position={[0, 3.5, 0]}>
                <mesh material={bodyMat} castShadow receiveShadow>
                    <boxGeometry args={[1.5, 0.5, 1]} />
                </mesh>

                <group ref={(el) => { if (el && joints.current) joints.current.torso = el; }} position={[0, 0.25, 0]}>
                    <mesh position={[0, 0.75, 0]} material={jointMat} castShadow receiveShadow>
                        <cylinderGeometry args={[0.4, 0.5, 1.5, 8]} />
                    </mesh>
                    <mesh position={[0, 1.8, 0]} material={bodyMat} castShadow receiveShadow>
                        <boxGeometry args={[2, 1.5, 1.2]} />
                    </mesh>
                    <mesh position={[0, 1.8, 0.61]} rotation={[Math.PI / 2, 0, 0]} material={glowMat}>
                        <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
                    </mesh>

                    <group ref={(el) => { if (el && joints.current) joints.current.neck = el; }} position={[0, 2.6, 0]}>
                        <mesh position={[0, 0.45, 0]} material={bodyMat} castShadow receiveShadow>
                            <boxGeometry args={[0.8, 0.9, 0.9]} />
                        </mesh>
                        <mesh position={[0, 0.5, 0.46]} material={glowMat}>
                            <boxGeometry args={[0.7, 0.15, 0.1]} />
                        </mesh>
                    </group>

                    {/* Arms */}
                    <Arm side="left" joints={joints} bodyMat={bodyMat} jointMat={jointMat} />
                    <Arm side="right" joints={joints} bodyMat={bodyMat} jointMat={jointMat} />
                </group>

                {/* Legs */}
                <Leg side="left" joints={joints} bodyMat={bodyMat} jointMat={jointMat} />
                <Leg side="right" joints={joints} bodyMat={bodyMat} jointMat={jointMat} />
            </group>
        </group>
    );
}

function Arm({ side, joints, bodyMat, jointMat }: { side: 'left' | 'right', joints: React.MutableRefObject<Joints>, bodyMat: THREE.Material, jointMat: THREE.Material }) {
    const dir = side === 'left' ? 1 : -1;
    return (
        <group
            ref={(el) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (!joints.current[`${side}Arm`]) joints.current[`${side}Arm`] = {} as any;
                joints.current[`${side}Arm`]!.shoulder = el!;
            }}
            position={[dir * 1.2, 2.2, 0]}
        >
            <mesh material={jointMat} castShadow receiveShadow>
                <sphereGeometry args={[0.5]} />
            </mesh>
            <mesh position={[0, -0.8, 0]} material={bodyMat} castShadow receiveShadow>
                <boxGeometry args={[0.4, 1.2, 0.4]} />
            </mesh>
            <group
                ref={(el) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (!joints.current[`${side}Arm`]) joints.current[`${side}Arm`] = {} as any;
                    joints.current[`${side}Arm`]!.elbow = el!;
                }}
                position={[0, -1.5, 0]}
            >
                <mesh rotation={[0, 0, Math.PI / 2]} material={bodyMat} castShadow receiveShadow>
                    <cylinderGeometry args={[0.3, 0.3, 0.5, 8]} />
                </mesh>
                <mesh position={[0, -0.7, 0]} material={bodyMat} castShadow receiveShadow>
                    <boxGeometry args={[0.35, 1.2, 0.35]} />
                </mesh>
            </group>
        </group>
    );
}

function Leg({ side, joints, bodyMat, jointMat }: { side: 'left' | 'right', joints: React.MutableRefObject<Joints>, bodyMat: THREE.Material, jointMat: THREE.Material }) {
    const dir = side === 'left' ? 1 : -1;
    return (
        <group
            ref={(el) => { if (el && joints.current) joints.current[`${side}Hip`] = el; }}
            position={[dir * 0.5, 0, 0]}
        >
            <mesh position={[0, -0.8, 0]} material={bodyMat} castShadow receiveShadow>
                <boxGeometry args={[0.5, 1.5, 0.6]} />
            </mesh>
            <group
                ref={(el) => { if (el && joints.current) joints.current[`${side}Knee`] = el; }}
                position={[0, -1.6, 0]}
            >
                <mesh material={jointMat} castShadow receiveShadow>
                    <sphereGeometry args={[0.4]} />
                </mesh>
                <mesh position={[0, -0.8, 0]} material={bodyMat} castShadow receiveShadow>
                    <boxGeometry args={[0.4, 1.5, 0.5]} />
                </mesh>
                <mesh position={[0, -1.7, 0.2]} material={bodyMat} castShadow receiveShadow>
                    <boxGeometry args={[0.6, 0.3, 1.0]} />
                </mesh>
            </group>
        </group>
    );
}
