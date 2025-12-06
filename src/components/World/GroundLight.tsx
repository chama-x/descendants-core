import React from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';

export default function GroundLight({ position }: { position: [number, number, number] }) {
    const isNight = useGameStore((state) => state.isNight);

    return (
        <group position={position}>
            {/* Fixture Ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <ringGeometry args={[1.2, 1.6, 32]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            {/* Glass Cover */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[1.2, 32]} />
                <meshStandardMaterial
                    color={isNight ? "#ccddff" : "#445566"}
                    emissive={isNight ? "#ccddff" : "#000"}
                    emissiveIntensity={isNight ? 1 : 0}
                    toneMapped={false}
                />
            </mesh>

            {/* Real Light Source REPLACED by Glow Disc for FPS */}
            {isNight && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                    <circleGeometry args={[4.0, 32]} />
                    <meshBasicMaterial
                        color="#ccddff"
                        transparent
                        opacity={0.3}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            )}
        </group>
    );
}
