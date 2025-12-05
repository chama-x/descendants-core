import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/store/gameStore';
import { createMaterials } from '../Systems/Materials';

import { Text } from '@react-three/drei';

export default function SocialWorkHub() {
    const addCollidableMesh = useGameStore((state) => state.addCollidableMesh);
    const removeCollidableMesh = useGameStore((state) => state.removeCollidableMesh);
    const addObstacles = useGameStore((state) => state.addObstacles);
    const removeObstacles = useGameStore((state) => state.removeObstacles);
    const addInteractables = useGameStore((state) => state.addInteractables);
    const removeInteractables = useGameStore((state) => state.removeInteractables);

    const groundRef = useRef<THREE.Mesh>(null);
    const pergolaRef = useRef<THREE.InstancedMesh>(null);
    const sofaRef = useRef<THREE.InstancedMesh>(null);
    const sofaBackRef = useRef<THREE.InstancedMesh>(null);
    const sofaArmRef = useRef<THREE.InstancedMesh>(null);
    const tableRef = useRef<THREE.InstancedMesh>(null);

    const hubCenter = useMemo(() => new THREE.Vector3(0, 2, -375), []);
    const hubSize = 250;

    const { materials } = useMemo(() => {
        const mats = createMaterials();
        return { materials: mats };
    }, []);

    // Generate Layout
    const { pergolaMatrices, sofaMatrices, sofaBackMatrices, sofaArmMatrices, tableMatrices, obstacles, interactables } = useMemo(() => {
        const pergolas: THREE.Matrix4[] = [];
        const sofas: THREE.Matrix4[] = [];
        const sofaBacks: THREE.Matrix4[] = [];
        const sofaArms: THREE.Matrix4[] = [];
        const tables: THREE.Matrix4[] = [];
        const obs: { position: THREE.Vector3; radius: number }[] = [];
        const ints: { id: string; type: string; position: THREE.Vector3; rotation: THREE.Quaternion }[] = [];

        // ... (Keep existing layout logic, but use hubCenter from outside)
        // Note: hubCenter is now stable.

        // 1. Wooden Pergola Structure (Slats)
        const pergolaHeight = 30; // Much higher roof
        const pergolaWidth = 100;
        const pergolaDepth = 60;

        // ... (Same loop logic)
        const postCountX = 4;
        const postCountZ = 3;
        for (let i = 0; i < postCountX; i++) {
            for (let j = 0; j < postCountZ; j++) {
                const x = hubCenter.x - pergolaWidth / 2 + (i / (postCountX - 1)) * pergolaWidth;
                const z = hubCenter.z - pergolaDepth / 2 + (j / (postCountZ - 1)) * pergolaDepth;

                const matrix = new THREE.Matrix4();
                matrix.compose(new THREE.Vector3(x, pergolaHeight / 2, z), new THREE.Quaternion(), new THREE.Vector3(0.8, pergolaHeight, 0.8));
                pergolas.push(matrix);
                obs.push({ position: new THREE.Vector3(x, hubCenter.y, z), radius: 0.6 });
            }
        }

        const slatCount = 40;
        for (let i = 0; i < slatCount; i++) {
            const z = hubCenter.z - pergolaDepth / 2 + (i / (slatCount - 1)) * pergolaDepth;
            const matrix = new THREE.Matrix4();
            matrix.compose(new THREE.Vector3(hubCenter.x, pergolaHeight, z), new THREE.Quaternion(), new THREE.Vector3(pergolaWidth + 4, 0.3, 0.3));
            pergolas.push(matrix);
        }

        // 2. Lounge Area (Open Meeting Seatings)
        // Removed unused parameters radius, openAngle from signature
        const createSeatingGroup = (centerX: number, centerZ: number) => {
            // Square layout: 4 sofas facing center
            const sofaCount = 4;

            for (let i = 0; i < sofaCount; i++) {
                const angle = (i / sofaCount) * Math.PI * 2; // 0, 90, 180, 270

                // Position: Push them out further for "friendly ground talk" space
                const groupRadius = 20;
                const x = centerX + Math.cos(angle) * groupRadius;
                const z = centerZ + Math.sin(angle) * groupRadius;

                // Sofa Orientation: Face the center
                const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
                const pos = new THREE.Vector3(x, hubCenter.y, z);

                // --- Build the MASSIVE 3-Seater Sofa ---
                const sofaWidth = 18.0; // Huge
                const sofaDepth = 4.5;  // Shallower
                const seatHeight = 2.2; // Thicker/Higher
                const backHeight = 4.5;
                const armWidth = 1.5;

                // 2. Three Distinct Seat Cushions
                const cushionWidth = (sofaWidth - armWidth * 2) / 3;
                const cushionDepth = sofaDepth - 1.0;

                for (let s = 0; s < 3; s++) {
                    const offsetIndex = s - 1;
                    const localX = offsetIndex * cushionWidth;

                    const cushionPos = pos.clone().add(new THREE.Vector3(localX, seatHeight / 2, 0).applyQuaternion(rot));

                    const mat = new THREE.Matrix4();
                    mat.compose(cushionPos, rot, new THREE.Vector3(cushionWidth * 0.95, seatHeight, cushionDepth));
                    sofas.push(mat);

                    // Interaction Point
                    const sitOffset = new THREE.Vector3(localX, 0, 1.4).applyQuaternion(rot);
                    const sitPos = pos.clone().add(sitOffset).setY(hubCenter.y);

                    ints.push({
                        id: `sofa-${i}-seat-${s}-${centerX}-${centerZ}`,
                        type: 'sofa',
                        position: sitPos,
                        rotation: rot
                    });
                }

                // 3. Backrest
                for (let s = 0; s < 3; s++) {
                    const offsetIndex = s - 1;
                    const localX = offsetIndex * cushionWidth;
                    const backPos = pos.clone().add(new THREE.Vector3(localX, backHeight / 2, -sofaDepth / 2 + 0.75).applyQuaternion(rot));

                    const mat = new THREE.Matrix4();
                    mat.compose(backPos, rot, new THREE.Vector3(cushionWidth * 0.95, backHeight, 1.5));
                    sofaBacks.push(mat);
                    obs.push({ position: backPos.clone().setY(hubCenter.y), radius: 0.8 });
                }

                // 4. Armrests
                const armHeight = 3.5;
                const leftArmPos = pos.clone().add(new THREE.Vector3(-sofaWidth / 2 + armWidth / 2, armHeight / 2, 0).applyQuaternion(rot));
                const rightArmPos = pos.clone().add(new THREE.Vector3(sofaWidth / 2 - armWidth / 2, armHeight / 2, 0).applyQuaternion(rot));

                const armL = new THREE.Matrix4();
                armL.compose(leftArmPos, rot, new THREE.Vector3(armWidth, armHeight, sofaDepth));
                sofaArms.push(armL);

                const armR = new THREE.Matrix4();
                armR.compose(rightArmPos, rot, new THREE.Vector3(armWidth, armHeight, sofaDepth));
                sofaArms.push(armR);

                obs.push({ position: leftArmPos.clone().setY(hubCenter.y), radius: 0.8 });
                obs.push({ position: rightArmPos.clone().setY(hubCenter.y), radius: 0.8 });
            }

            const tableMatrix = new THREE.Matrix4();
            tableMatrix.compose(new THREE.Vector3(centerX, hubCenter.y + 0.4, centerZ), new THREE.Quaternion(), new THREE.Vector3(12, 0.4, 12));
            tables.push(tableMatrix);
            obs.push({ position: new THREE.Vector3(centerX, hubCenter.y, centerZ), radius: 6.0 });
        };

        createSeatingGroup(hubCenter.x, hubCenter.z);
        createSeatingGroup(hubCenter.x - 45, hubCenter.z - 10);
        createSeatingGroup(hubCenter.x + 45, hubCenter.z - 10);
        createSeatingGroup(hubCenter.x, hubCenter.z + 30);

        // 3. Work Tables
        const tablePositions = [
            new THREE.Vector3(hubCenter.x, 1.2, hubCenter.z + 25),
            new THREE.Vector3(hubCenter.x + 25, 1.2, hubCenter.z + 25),
        ];

        tablePositions.forEach(pos => {
            const matrix = new THREE.Matrix4();
            matrix.compose(pos, new THREE.Quaternion(), new THREE.Vector3(12, 0.2, 5));
            tables.push(matrix);
            obs.push({ position: pos, radius: 6 });
        });

        return { pergolaMatrices: pergolas, sofaMatrices: sofas, sofaBackMatrices: sofaBacks, sofaArmMatrices: sofaArms, tableMatrices: tables, obstacles: obs, interactables: ints };
    }, [hubCenter]);

    // ... (Keep Instances LayoutEffects)

    // Register Ground & Obstacles & Interactables
    useEffect(() => {
        const ground = groundRef.current; // Capture ref
        if (ground) {
            addCollidableMesh(ground);
        }
        addObstacles(obstacles);
        addInteractables(interactables);

        return () => {
            // Use captured variable
            if (ground) removeCollidableMesh(ground.uuid);
            removeObstacles(obstacles);
            removeInteractables(interactables.map(i => i.id));
        };
    }, [addCollidableMesh, removeCollidableMesh, addObstacles, removeObstacles, addInteractables, removeInteractables, obstacles, interactables]);

    return (
        <group>
            {/* Floor - Wood Decking instead of Concrete */}
            <mesh ref={groundRef} position={[hubCenter.x, hubCenter.y - 1, hubCenter.z]} receiveShadow>
                <boxGeometry args={[hubSize, 2, hubSize]} />
                <primitive object={materials.wood} attach="material" />
            </mesh>

            {/* Pergola Structure */}
            <instancedMesh ref={pergolaRef} args={[undefined, undefined, pergolaMatrices.length]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <primitive object={materials.wood} attach="material" />
            </instancedMesh>

            {/* Sofas (Seats) - Warm Leather */}
            <instancedMesh ref={sofaRef} args={[undefined, undefined, sofaMatrices.length]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#8B4513" roughness={0.6} />
            </instancedMesh>

            {/* Sofas (Backrests) */}
            <instancedMesh ref={sofaBackRef} args={[undefined, undefined, sofaBackMatrices.length]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#8B4513" roughness={0.6} />
            </instancedMesh>

            {/* Sofas (Arms) */}
            <instancedMesh ref={sofaArmRef} args={[undefined, undefined, sofaArmMatrices.length]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="#8B4513" roughness={0.6} />
            </instancedMesh>

            {/* Tables */}
            <instancedMesh ref={tableRef} args={[undefined, undefined, tableMatrices.length]} castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <primitive object={materials.wood} attach="material" />
            </instancedMesh>

            {/* Concrete Wall Backing */}
            <mesh position={[hubCenter.x, hubCenter.y + 20, hubCenter.z - 40.5]} receiveShadow castShadow>
                <boxGeometry args={[80, 40, 1]} />
                <meshStandardMaterial color="#222" roughness={0.2} metalness={0.8} />
            </mesh>

            {/* Text Wall - Premium 3D Effect */}
            <group position={[hubCenter.x, hubCenter.y + 20, hubCenter.z - 39.5]}>
                {/* Main Glow Layer */}
                <Text
                    font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                    fontSize={3.5}
                    maxWidth={40} // 50% of wall width (80)
                    lineHeight={1}
                    letterSpacing={0.05}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                >
                    Cortana | Project Descendants
                    <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} toneMapped={false} />
                </Text>

                {/* Depth Layer 1 (Darker Cyan) */}
                <Text
                    font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                    position={[0.05, -0.05, -0.1]}
                    fontSize={3.5}
                    maxWidth={40}
                    lineHeight={1}
                    letterSpacing={0.05}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                >
                    Cortana | Project Descendants
                    <meshStandardMaterial color="#008888" />
                </Text>

                {/* Shadow Layer (Black) */}
                <Text
                    font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
                    position={[0.1, -0.1, -0.2]}
                    fontSize={3.5}
                    maxWidth={40}
                    lineHeight={1}
                    letterSpacing={0.05}
                    textAlign="center"
                    anchorX="center"
                    anchorY="middle"
                    color="black"
                >
                    Cortana | Project Descendants
                </Text>
            </group>

            {/* Warm Hanging Lights - Higher up */}
            <pointLight position={[hubCenter.x, hubCenter.y + 18, hubCenter.z]} intensity={1.5} distance={40} color="#ffaa55" />
            <pointLight position={[hubCenter.x - 15, hubCenter.y + 18, hubCenter.z]} intensity={1.0} distance={30} color="#ffaa55" />
            <pointLight position={[hubCenter.x + 15, hubCenter.y + 18, hubCenter.z]} intensity={1.0} distance={30} color="#ffaa55" />
        </group>
    );
}
