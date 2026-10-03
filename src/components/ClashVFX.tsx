import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const ClashVFX = ({ position, color = "#ffcc00" }: { position: [number, number, number], color?: string }) => {
  const particlesCount = 8;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [active, setActive] = useState(true);
  
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < particlesCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 5;
      temp.push({
        position: new THREE.Vector3(0, 0, 0),
        velocity: new THREE.Vector3(
          Math.cos(theta) * speed,
          (Math.random() * 5) + 2, // burst upwards
          Math.sin(theta) * speed
        ),
        scale: Math.random() * 0.4 + 0.2
      });
    }
    return temp;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const timer = setTimeout(() => setActive(false), 300); // short lived sparks
    return () => clearTimeout(timer);
  }, []);

  useFrame(() => {
    if (!meshRef.current || !active) return;
    particles.forEach((p, i) => {
      p.position.add(p.velocity);
      p.velocity.y -= 0.5; // gravity effect
      p.scale *= 0.85; // shrink rapidly
      dummy.position.copy(p.position);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, particlesCount]}>
        <boxGeometry args={[3, 3, 3]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
      </instancedMesh>
    </group>
  );
};
