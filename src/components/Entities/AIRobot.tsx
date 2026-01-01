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
    const { vehicle, brain } = useYukaAI(groupRef, playerRef, joints, agentId);

    // HUD State (for reactive updates)
    const [hudState, setHudState] = useState({
        thought: 'Initializing...',
        isThinking: false,
        model: 'Loading...'
    });

    const [distanceToPlayer, setDistanceToPlayer] = useState(100);

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

    // Check Distance (Throttled via simple frame skip or just ref updating)
    // Actually, setting state in useFrame is bad.
    // Better: Update a ref, and use CSS opacity based on that?
    // No, React re-render needed for conditionals.
    // Let's use a throttled interval for distance check to save perf.
    useEffect(() => {
        const distInterval = setInterval(() => {
            if (groupRef.current && playerRef.current) {
                const d = groupRef.current.position.distanceTo(playerRef.current.position);
                setDistanceToPlayer(d);
            }
        }, 200);
        return () => clearInterval(distInterval);
    }, [playerRef]);

    const showDetails = distanceToPlayer < 15; // Show thoughts when < 15m

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
                distanceFactor={12} // Scaled up (was 15)
                occlude
                style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                {/* Main HUD Container - Scaled Up */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                }}>
                    {/* 1. Name Badge (Always Visible, larger) */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(4px)',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontFamily: 'sans-serif',
                        fontSize: '16px', // Larger
                        fontWeight: 'bold',
                        border: '1px solid rgba(255,255,255,0.2)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>{agentId}</span>
                        <span style={{
                            background: '#0070f3',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            textTransform: 'uppercase'
                        }}>AI</span>
                    </div>

                    {/* 2. Thought Bubble (Proximity Only) */}
                    <div style={{
                        opacity: showDetails ? 1 : 0,
                        transform: showDetails ? 'translateY(0)' : 'translateY(10px)',
                        transition: 'all 0.3s ease',
                        pointerEvents: showDetails ? 'auto' : 'none',

                        background: 'rgba(10, 10, 10, 0.9)',
                        color: '#eee',
                        padding: '12px',
                        borderRadius: '12px',
                        border: hudState.isThinking ? '2px solid #00ff88' : '1px solid #444',
                        boxShadow: hudState.isThinking ? '0 0 15px rgba(0, 255, 136, 0.3)' : '0 4px 12px rgba(0,0,0,0.5)',
                        width: '280px',
                        marginTop: '8px',
                        position: 'relative'
                    }}>
                        {/* Triangle Pointer */}
                        <div style={{
                            position: 'absolute',
                            top: '-6px',
                            left: '50%',
                            transform: 'translateX(-50%) rotate(45deg)',
                            width: '12px',
                            height: '12px',
                            background: hudState.isThinking ? '#00ff88' : '#444',
                            borderLeft: '1px solid transparent',
                            borderTop: '1px solid transparent',
                            zIndex: -1
                        }} />

                        {/* Status Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                            fontSize: '11px',
                            color: '#888',
                            borderBottom: '1px solid #333',
                            paddingBottom: '4px'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: hudState.isThinking ? '#00ff88' : '#555',
                                    boxShadow: hudState.isThinking ? '0 0 5px #00ff88' : 'none',
                                    transition: 'background 0.3s'
                                }} />
                                {hudState.isThinking ? 'PROCESSING...' : 'IDLE'}
                            </span>
                            <span style={{ color: '#00d4ff' }}>{hudState.model}</span>
                        </div>

                        {/* Thought Text */}
                        <div style={{
                            fontSize: '13px',
                            lineHeight: '1.5',
                            color: '#fff',
                            fontWeight: 400
                        }}>
                            "{hudState.thought}"
                        </div>
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
