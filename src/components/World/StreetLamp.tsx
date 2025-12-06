import React from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { SpotLight } from '@react-three/drei';

export default function StreetLamp({ position }: { position: [number, number, number] }) {
    const isNight = useGameStore((state) => state.isNight);

    return (
        <group position={position}>
            {/* Pole */}
            <mesh position={[0, 20, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.8, 1.2, 40, 8]} />
                <meshStandardMaterial color="#222" roughness={0.8} />
            </mesh>
            {/* Arm */}
            <mesh position={[4.0, 38, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow receiveShadow>
                <cylinderGeometry args={[0.6, 0.6, 12, 8]} />
                <meshStandardMaterial color="#222" roughness={0.8} />
            </mesh>
            {/* Bulb Housing */}
            <mesh position={[8.0, 35, 0]}>
                <coneGeometry args={[2.4, 3.2, 8]} />
                <meshStandardMaterial color="#111" />
            </mesh>
            {/* Emissive Bulb Object */}
            <mesh position={[8.0, 34, 0]}>
                <sphereGeometry args={[1.2, 8, 8]} />
                {/* Standard emissive, no multiplier */}
                <meshStandardMaterial
                    color={isNight ? "#ffaa00" : "#333"}
                    emissive={isNight ? "#ffaa00" : "#000"}
                    emissiveIntensity={isNight ? 2 : 0}
                    toneMapped={false}
                />
            </mesh>

            {/* VOLUMETRIC LIGHT BEAM (Optimization: No Shadows, but Real Beam) */}
            {isNight && (
                <SpotLight
                    position={[8.0, 30, 0]}
                    angle={0.6}
                    attenuation={15}
                    anglePower={5} // Diffuse beam
                    radiusTop={0.5}
                    radiusBottom={15}
                    opacity={0.5}
                    color="#ffaa00"
                    volumetric
                    debug={false}
                />
            )}

            {/* Base */}
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[2.0, 2.4, 3.0, 8]} />
                <meshStandardMaterial color="#333" />
            </mesh>
        </group>
    );
}
