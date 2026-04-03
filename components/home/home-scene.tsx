"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, Torus } from "@react-three/drei";
import { Group } from "three";

function SignalCluster({ progress }: { progress: number }) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!groupRef.current) return;
    groupRef.current.rotation.y = t * 0.14 + progress * 2.2;
    groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.08 + progress * 0.12;
    groupRef.current.position.y = Math.sin(t * 0.45) * 0.18;
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.5}>
        <mesh>
          <icosahedronGeometry args={[1.2, 1]} />
          <meshStandardMaterial color="#58C7B8" metalness={0.2} roughness={0.2} />
        </mesh>
      </Float>
      <Torus args={[2.4, 0.04, 32, 160]} rotation-x={Math.PI / 2}>
        <meshStandardMaterial color="#F6F1E8" transparent opacity={0.6} />
      </Torus>
      <Torus args={[3.1, 0.06, 32, 160]} rotation-z={Math.PI / 6}>
        <meshStandardMaterial color="#C98A57" transparent opacity={0.55} />
      </Torus>
      <Torus args={[3.8, 0.03, 32, 160]} rotation-x={Math.PI / 3}>
        <meshStandardMaterial color="#58C7B8" transparent opacity={0.35} />
      </Torus>
    </group>
  );
}

function DataNodes({ progress }: { progress: number }) {
  const groupRef = useRef<Group>(null);
  const nodes = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => ({
        key: index,
        position: [
          Math.sin(index * 1.7) * (3.6 + (index % 4)),
          ((index % 5) - 2) * 1.3,
          Math.cos(index * 1.4) * 2.8,
        ] as const,
        scale: 0.12 + (index % 3) * 0.06,
      })),
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = -t * 0.08 - progress * 1.5;
    groupRef.current.rotation.z = Math.sin(t * 0.22) * 0.08;
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node, index) => (
        <Sphere
          key={node.key}
          args={[node.scale, 24, 24]}
          position={node.position}
        >
          <meshStandardMaterial
            color={index % 5 === 0 ? "#C98A57" : "#F6F1E8"}
            emissive={index % 5 === 0 ? "#C98A57" : "#58C7B8"}
            emissiveIntensity={index % 5 === 0 ? 0.35 : 0.18}
            transparent
            opacity={0.92}
          />
        </Sphere>
      ))}
    </group>
  );
}

export function HomeScene({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0, 11], fov: 42 }}>
        <color attach="background" args={["#06172A"]} />
        <fog attach="fog" args={["#06172A", 8, 22]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[6, 6, 5]} intensity={1.8} color="#FFFFFF" />
        <pointLight position={[-4, -2, 3]} intensity={16} color="#58C7B8" />
        <pointLight position={[4, 2, -1]} intensity={10} color="#C98A57" />
        <SignalCluster progress={progress} />
        <DataNodes progress={progress} />
      </Canvas>
    </div>
  );
}
