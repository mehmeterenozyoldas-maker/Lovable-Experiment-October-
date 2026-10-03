import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Point, PlatformPolygon, InputMode } from '../types';
import { physicsEngine } from '../physics/physicsEngine';
import { audioSynth } from '../audio/synthEngine';
import { ExplosionVFX } from './ExplosionVFX';
import { ClashVFX } from './ClashVFX';
import { DamageNumbersVFX } from './DamageNumbersVFX';

interface CanvasStageProps {
  inputMode: InputMode;
  drawnPlatforms: PlatformPolygon[];
  setDrawnPlatforms: React.Dispatch<React.SetStateAction<PlatformPolygon[]>>;
  activeColor: string;
  activeTool?: 'draw' | 'erase';
  onBallSpawned?: () => void;
}

// Sets up a strict 1:1 Orthographic mapping
// Top-Left is (0,0), Bottom-Right is (width, -height)
const OrthoCamera = () => {
  const { camera, size } = useThree();
  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.left = 0;
      camera.right = size.width;
      camera.top = 0;
      camera.bottom = -size.height;
      camera.position.set(0, 0, 500);
      camera.lookAt(0, 0, 0);
      camera.zoom = 1.0;
      camera.rotation.z = 0;
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);

  useFrame((state, delta) => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    physicsEngine.decayScreenShake(delta);
    const trauma = physicsEngine.getScreenShakeTrauma();

    if (trauma > 0.005) {
      const intensity = trauma * trauma;
      const shakeMag = intensity * 12;
      const t = state.clock.getElapsedTime();
      const shakeX = (Math.sin(t * 60) + Math.sin(t * 28) * 0.5) * shakeMag;
      const shakeY = (Math.cos(t * 50) + Math.cos(t * 24) * 0.5) * shakeMag;
      camera.position.set(shakeX, shakeY, 500);
    } else if (camera.position.x !== 0 || camera.position.y !== 0) {
      camera.position.set(0, 0, 500);
    }
  });

  return null;
};

// 3D Extruded Tape Platform
const Platform3D = ({ poly, restitution, activeTool, onRemove }: { poly: PlatformPolygon; restitution: number; activeTool?: 'draw' | 'erase'; onRemove?: (id: string) => void }) => {
  // To ensure the physics collider updates if the CV shape significantly changes,
  // we generate a hash from the geometry points to use as the RigidBody key.
  const geoHash = useMemo(() => {
    if (poly.points.length === 0) return 'empty';
    const p0 = poly.points[0];
    const pMid = poly.points[Math.floor(poly.points.length / 2)];
    // Bucket by ~15 pixels to prevent camera noise from constantly remounting the physics collider
    const b = 15;
    const lenBucket = Math.round(poly.points.length / 5) * 5;
    return `${poly.id}_${lenBucket}_${Math.round(p0.x / b)}_${Math.round(pMid.y / b)}`;
  }, [poly]);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    if (poly.points.length < 3) return s;
    s.moveTo(poly.points[0].x, -poly.points[0].y);
    for (let i = 1; i < poly.points.length; i++) {
      s.lineTo(poly.points[i].x, -poly.points[i].y);
    }
    s.closePath();
    return s;
  }, [poly]);

  const extrudeSettings = { depth: 240, bevelEnabled: false };

  return (
    <RigidBody key={geoHash} colliders="hull" type="fixed" restitution={restitution} friction={0.3}>
      <mesh 
        position={[0, 0, -120]}
        onPointerDown={(e) => {
          if (activeTool === 'erase' && onRemove) {
            e.stopPropagation();
            onRemove(poly.id);
          }
        }}
        onClick={(e) => {
           if (activeTool === 'erase' && onRemove) {
            e.stopPropagation();
          }
        }}
      >
        <extrudeGeometry args={[shape, extrudeSettings]} />
        <meshStandardMaterial 
          color={poly.color || '#05D5AF'} 
          emissive={poly.color || '#05D5AF'} 
          emissiveIntensity={0.8} 
          transparent 
          opacity={0.85} 
          roughness={0.1} 
          metalness={0.8} 
        />
      </mesh>
    </RigidBody>
  );
};

// 3D Cute Video Game NPCs
const Npc3D = ({ npc, restitution, friction }: { npc: any; restitution: number; friction: number }) => {
  const { size } = useThree();
  const rigidBodyRef = useRef<any>(null);

  const type = npc.characterType;
  const stats = npc.stats;

  const [isHit, setIsHit] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [deathPos, setDeathPos] = useState<[number, number, number] | null>(null);
  const swordGroupRef = useRef<THREE.Group>(null);
  
  const lastBounce = useRef(0);
  const lastKnownHp = useRef(npc.hp);

  useEffect(() => {
    if (npc.hp < lastKnownHp.current) {
      // Took damage!
      setIsHit(true);
      setTimeout(() => setIsHit(false), 200);

      // Handle death explosion tracking
      if (npc.hp <= 0 && lastKnownHp.current > 0) {
        if (rigidBodyRef.current) {
          const pos = rigidBodyRef.current.translation();
          setDeathPos([pos.x, pos.y, pos.z]);
        } else {
          setDeathPos([0, 0, 0]);
        }
        setTimeout(() => {
          physicsEngine.removeBall(npc.id);
        }, 1000);
      }
    }
    lastKnownHp.current = npc.hp;
  }, [npc.hp, npc.id]);

  const handleCollision = (payload: any) => {
    if (Date.now() - lastBounce.current > 100) {
      audioSynth.playBounceSound(Math.random() * 0.5 + 0.5);
      lastBounce.current = Date.now();
    }
    
    // Fight logic: if we collide with another NPC, knock each other back!
    if (payload.other.rigidBodyObject?.userData?.id?.startsWith('npc_')) {
      const otherId = payload.other.rigidBodyObject.userData.id;
      
      // We process the hit via physicsEngine state
      if (rigidBodyRef.current) {
        const pos = rigidBodyRef.current.translation();
        physicsEngine.handleNpcCollision(npc.id, otherId, [pos.x, pos.y + npc.radius * 0.5, pos.z]);
        
        // Local attack animation check (just visual, engine handles cd)
        if (Date.now() - npc.lastAttack < 100 && !isAttacking) {
           setIsAttacking(true);
           setTimeout(() => setIsAttacking(false), 250);
        }
      }
    }
  };

  const [initialPosition] = useState(() => {
    const startX = npc.x === -1 ? (Math.random() * (size.width - 200) + 100) : npc.x;
    const startY = npc.y === -30 ? 30 : npc.y;
    return [startX, -startY, 0] as [number, number, number];
  });

  const visualRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const bubbleGroupRef = useRef<THREE.Group>(null);
  
  const charColor = isHit ? '#ffffff' : npc.color;
  const emColor = isHit ? '#ff0000' : '#000000';
  const emInt = isHit ? 1.5 : 0;

  useFrame(({ clock }) => {
    if (rigidBodyRef.current && npc.hp > 0) {
      const pos = rigidBodyRef.current.translation();
      const vel = rigidBodyRef.current.linvel();
      physicsEngine.updateNpcPosition(npc.id, [pos.x, pos.y, pos.z]);
      
      const inHitStop = Date.now() < npc.hitStopUntil;
      if (inHitStop) {
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }

      // Tracking logic to move towards nearest enemy (skip if in hit-stop)
      if (!inHitStop && Math.random() < 0.05) { // Run occasionally to save perf
        const impulse = physicsEngine.calculateTacticalImpulse(npc.id);
        if (impulse) {
          const mass = rigidBodyRef.current.mass() || 1;
          rigidBodyRef.current.applyImpulse({ 
            x: impulse[0] * mass, 
            y: impulse[1] * mass, 
            z: impulse[2] * mass 
          }, true);
        }
      }

      // Move legs based on velocity
      if (leftLegRef.current && rightLegRef.current) {
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed > 10) {
          const runPhase = clock.getElapsedTime() * 15;
          leftLegRef.current.rotation.x = Math.sin(runPhase) * 0.6;
          rightLegRef.current.rotation.x = Math.sin(runPhase + Math.PI) * 0.6;
        } else {
          leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, 0.1);
          rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, 0.1);
        }
      }
    }

    if (visualRef.current) {
      if (npc.hp <= 0) {
        visualRef.current.scale.lerp(new THREE.Vector3(0, 0, 0), 0.15);
      } else {
        const t = clock.getElapsedTime() * 5 + (npc.radius * 100);
        if (type === 2) {
          // Slime squish
          visualRef.current.scale.y = 1 + Math.sin(t) * 0.15;
          visualRef.current.scale.x = 1 - Math.sin(t) * 0.05;
          visualRef.current.scale.z = 1 - Math.sin(t) * 0.05;
          if (bubbleGroupRef.current) {
            bubbleGroupRef.current.rotation.y = t * 0.1;
            bubbleGroupRef.current.position.y = Math.sin(t * 0.5) * 2;
          }
        } else if (type === 0) {
          // Mushroom wobble
          visualRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
        } else if (type === 1) {
          // Boxy hover float
          visualRef.current.position.y = Math.sin(t * 1.5) * 2;
        }
      }
    }
    if (swordGroupRef.current) {
      if (isAttacking) {
        swordGroupRef.current.rotation.z = THREE.MathUtils.lerp(swordGroupRef.current.rotation.z, -Math.PI / 1.2, 0.3);
      } else {
        swordGroupRef.current.rotation.z = THREE.MathUtils.lerp(swordGroupRef.current.rotation.z, -Math.PI / 4, 0.2);
      }
    }
  });

  return (
    <RigidBody 
      ref={rigidBodyRef}
      colliders={type === 1 ? "cuboid" : "hull"}
      position={initialPosition} 
      restitution={stats.bounciness * restitution} 
      friction={friction}
      density={stats.density}
      onCollisionEnter={handleCollision}
      userData={{ id: npc.id }}
    >
      {npc.hp <= 0 && deathPos && (
        <ExplosionVFX color={npc.color} position={[0,0,0]} />
      )}
      <group ref={visualRef}>
        {type === 0 && (
          // Cute Mushroom (Toad-like)
          <group position={[0, -npc.radius/2, 0]}>
            {/* Stem */}
            <mesh position={[0, npc.radius/2, 0]} castShadow>
              <cylinderGeometry args={[npc.radius * 0.6, npc.radius * 0.7, npc.radius, 16]} />
              <meshStandardMaterial color={isHit ? '#ffffff' : "#ffebcd"} roughness={0.8} emissive={emColor} emissiveIntensity={emInt} />
            </mesh>
            {/* Cap */}
            <mesh position={[0, npc.radius * 1.1, 0]} castShadow>
              <sphereGeometry args={[npc.radius * 1.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
              <meshStandardMaterial color={charColor} roughness={0.4} emissive={emColor} emissiveIntensity={emInt} />
            </mesh>
            {/* Cap Spots */}
            <mesh position={[0, npc.radius * 1.4, npc.radius * 0.6]}>
              <sphereGeometry args={[npc.radius * 0.35, 8, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.5} emissive={emColor} emissiveIntensity={emInt} />
            </mesh>
            <mesh position={[-npc.radius * 0.9, npc.radius * 1.1, 0]}>
              <sphereGeometry args={[npc.radius * 0.3, 8, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.5} emissive={emColor} emissiveIntensity={emInt} />
            </mesh>
            <mesh position={[npc.radius * 0.9, npc.radius * 1.1, 0]}>
              <sphereGeometry args={[npc.radius * 0.3, 8, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.5} emissive={emColor} emissiveIntensity={emInt} />
            </mesh>
            <mesh position={[0, npc.radius * 1.1, -npc.radius * 0.9]}>
              <sphereGeometry args={[npc.radius * 0.3, 8, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.5} emissive={emColor} emissiveIntensity={emInt} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-npc.radius*0.25, npc.radius*0.6, npc.radius*0.55]} rotation={[0, 0, isHit ? Math.PI/4 : 0]}>
              <sphereGeometry args={[3, 8, 8]} />
              <meshStandardMaterial color={isHit ? "#ff0000" : "#111111"} roughness={0.2} />
            </mesh>
            <mesh position={[npc.radius*0.25, npc.radius*0.6, npc.radius*0.55]} rotation={[0, 0, isHit ? Math.PI/4 : 0]}>
              <sphereGeometry args={[3, 8, 8]} />
              <meshStandardMaterial color={isHit ? "#ff0000" : "#111111"} roughness={0.2} />
            </mesh>
            {/* Blush */}
            <mesh position={[-npc.radius*0.5, npc.radius*0.45, npc.radius*0.55]}>
              <sphereGeometry args={[2, 8, 8]} />
              <meshStandardMaterial color="#ff7777" roughness={1} />
            </mesh>
            <mesh position={[npc.radius*0.5, npc.radius*0.45, npc.radius*0.55]}>
              <sphereGeometry args={[2, 8, 8]} />
              <meshStandardMaterial color="#ff7777" roughness={1} />
            </mesh>
            {/* Legs */}
            <group ref={leftLegRef} position={[-npc.radius * 0.3, 0, 0]}>
              <mesh position={[0, -npc.radius*0.3, 0]}>
                <capsuleGeometry args={[npc.radius*0.15, npc.radius*0.3, 4, 8]} />
                <meshStandardMaterial color="#ffebcd" roughness={0.8} />
              </mesh>
            </group>
            <group ref={rightLegRef} position={[npc.radius * 0.3, 0, 0]}>
              <mesh position={[0, -npc.radius*0.3, 0]}>
                <capsuleGeometry args={[npc.radius*0.15, npc.radius*0.3, 4, 8]} />
                <meshStandardMaterial color="#ffebcd" roughness={0.8} />
              </mesh>
            </group>
            {/* Tiny Scarf */}
            <mesh position={[0, npc.radius * 0.85, 0]} rotation={[0.1, 0, 0]}>
              <torusGeometry args={[npc.radius * 0.65, npc.radius * 0.15, 8, 16]} />
              <meshStandardMaterial color="#01BEFE" roughness={0.6} />
            </mesh>
          </group>
        )}

        {type === 1 && (
          // Cute Boxy (Retro Robot)
          <group>
            {/* Main Body */}
            <mesh castShadow>
              <boxGeometry args={[npc.radius * 2.2, npc.radius * 2, npc.radius * 2]} />
              <meshStandardMaterial color={charColor} roughness={0.4} metalness={0.8} emissive={emColor} emissiveIntensity={emInt} />
            </mesh>
            {/* Screen Bezel */}
            <mesh position={[0, 0, npc.radius + 0.1]}>
              <boxGeometry args={[npc.radius * 1.8, npc.radius * 1.4, 0.4]} />
              <meshStandardMaterial color="#222222" roughness={0.8} metalness={0.2} />
            </mesh>
            {/* Screen Glass */}
            <mesh position={[0, 0, npc.radius + 0.3]}>
              <boxGeometry args={[npc.radius * 1.6, npc.radius * 1.2, 0.1]} />
              <meshStandardMaterial color="#05D5AF" transparent opacity={0.6} roughness={0.1} metalness={0.1} emissive="#05D5AF" emissiveIntensity={0.2} />
            </mesh>
            {/* Digital Eyes */}
            <mesh position={[-npc.radius*0.35, npc.radius*0.1, npc.radius + 0.4]}>
              <boxGeometry args={[3, 4, 0.2]} />
              <meshStandardMaterial color={isHit ? "#ff0000" : "#ffffff"} emissive={isHit ? "#ff0000" : "#ffffff"} emissiveIntensity={2} />
            </mesh>
            <mesh position={[npc.radius*0.35, npc.radius*0.1, npc.radius + 0.4]}>
              <boxGeometry args={[3, 4, 0.2]} />
              <meshStandardMaterial color={isHit ? "#ff0000" : "#ffffff"} emissive={isHit ? "#ff0000" : "#ffffff"} emissiveIntensity={2} />
            </mesh>
            {/* Antenna Base */}
            <mesh position={[0, npc.radius + 1.5, 0]}>
              <cylinderGeometry args={[1.5, 2, 3, 8]} />
              <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Antenna Stem */}
            <mesh position={[0, npc.radius + 3.5, 0]}>
              <cylinderGeometry args={[0.5, 0.5, 4, 8]} />
              <meshStandardMaterial color="#888888" metalness={1} roughness={0.1} />
            </mesh>
            {/* Antenna Bulb */}
            <mesh position={[0, npc.radius + 6, 0]}>
              <sphereGeometry args={[2.5, 8, 8]} />
              <meshStandardMaterial color="#FF2A6D" emissive="#FF2A6D" emissiveIntensity={isHit ? 4 : 2} />
            </mesh>
            {/* Robot Tracks / Feet */}
            <group ref={leftLegRef} position={[-npc.radius * 0.7, -npc.radius - 1, 0]}>
              <mesh rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[npc.radius * 0.4, npc.radius * 0.4, npc.radius * 1.5, 8]} />
                <meshStandardMaterial color="#111" roughness={0.9} metalness={0.5} />
              </mesh>
            </group>
            <group ref={rightLegRef} position={[npc.radius * 0.7, -npc.radius - 1, 0]}>
              <mesh rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[npc.radius * 0.4, npc.radius * 0.4, npc.radius * 1.5, 8]} />
                <meshStandardMaterial color="#111" roughness={0.9} metalness={0.5} />
              </mesh>
            </group>
          </group>
        )}

        {type === 2 && (
          // Cute Slime / Ball
          <group>
            {/* Outer Jelly - standard material with transparency */}
            <mesh scale={[1, 0.85, 1]} castShadow>
              <sphereGeometry args={[npc.radius, 16, 16]} />
              <meshStandardMaterial 
                color={charColor} 
                roughness={0.1}
                transparent
                opacity={0.65}
                emissive={emColor} 
                emissiveIntensity={emInt} 
              />
            </mesh>
            {/* Inner Core */}
            <mesh scale={[0.4, 0.4, 0.4]}>
              <sphereGeometry args={[npc.radius, 16, 16]} />
              <meshStandardMaterial color="#ffffff" emissive={isHit ? '#ff0000' : npc.color} emissiveIntensity={isHit ? 3 : 1.5} roughness={0.2} />
            </mesh>
            {/* Bubbles */}
            <group ref={bubbleGroupRef}>
              <mesh position={[npc.radius*0.3, npc.radius*0.4, 0]}>
                <sphereGeometry args={[npc.radius*0.15, 8, 8]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.5} roughness={0} />
              </mesh>
              <mesh position={[-npc.radius*0.4, npc.radius*0.2, npc.radius*0.2]}>
                <sphereGeometry args={[npc.radius*0.1, 8, 8]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.5} roughness={0} />
              </mesh>
              <mesh position={[0, -npc.radius*0.3, -npc.radius*0.3]}>
                <sphereGeometry args={[npc.radius*0.2, 8, 8]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.5} roughness={0} />
              </mesh>
            </group>
            {/* Little Crown */}
            <mesh position={[0, npc.radius * 0.8, 0]} rotation={[0.1, 0, 0]}>
              <cylinderGeometry args={[npc.radius * 0.4, npc.radius * 0.3, npc.radius * 0.4, 6]} />
              <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-npc.radius*0.3, 0, npc.radius*0.8]}>
              <sphereGeometry args={[3, 8, 8]} />
              <meshStandardMaterial color={isHit ? "#ff0000" : "#1a1a2e"} roughness={0.2} />
            </mesh>
            <mesh position={[npc.radius*0.3, 0, npc.radius*0.8]}>
              <sphereGeometry args={[3, 8, 8]} />
              <meshStandardMaterial color={isHit ? "#ff0000" : "#1a1a2e"} roughness={0.2} />
            </mesh>
            {/* Smile */}
            <mesh position={[0, -npc.radius*0.2, npc.radius*0.84]} rotation={[Math.PI/2, 0, 0]}>
              <torusGeometry args={[2.5, 0.6, 8, 16, isHit ? Math.PI * 2 : Math.PI]} />
              <meshStandardMaterial color={isHit ? "#ff0000" : "#1a1a2e"} roughness={0.5} />
            </mesh>
          </group>
        )}
        
        {/* Soft Point light to maintain the neon feel without blinding the character models */}
        <pointLight color={npc.color} intensity={2} distance={150} decay={2} />

        {/* Health Bar */}
        <group position={[0, npc.radius + 12, 0]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[npc.radius * 2, 2.5, 0.5]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
          {npc.hp > 0 && (
            <mesh position={[-npc.radius + (npc.radius * (npc.hp / stats.maxHp)), 0, 0.5]}>
              <boxGeometry args={[Math.max(0.1, npc.radius * 2 * (npc.hp / stats.maxHp)), 2.5, 0.6]} />
              <meshStandardMaterial 
                color={npc.hp / stats.maxHp > 0.5 ? '#05D5AF' : npc.hp / stats.maxHp > 0.25 ? '#FED533' : '#FF2A6D'} 
                emissive={npc.hp / stats.maxHp > 0.5 ? '#05D5AF' : npc.hp / stats.maxHp > 0.25 ? '#FED533' : '#FF2A6D'}
                emissiveIntensity={1}
              />
            </mesh>
          )}
        </group>

        {/* Combat Gear: Swords and Shields! */}
        <group>
          {/* Sword in right hand */}
          <group ref={swordGroupRef} position={[npc.radius * 1.3, 0, npc.radius * 0.5]} rotation={[0, 0, -Math.PI / 4]}>
            {/* Handle */}
            <mesh position={[0, -npc.radius * 0.5, 0]} castShadow>
              <cylinderGeometry args={[1.5, 1.5, npc.radius, 8]} />
              <meshStandardMaterial color="#2d1706" roughness={0.9} />
            </mesh>
            {/* Pommel */}
            <mesh position={[0, -npc.radius, 0]} castShadow>
              <sphereGeometry args={[2.5, 8, 8]} />
              <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Guard */}
            <mesh position={[0, 0, 0]} castShadow>
              <boxGeometry args={[npc.radius * 1.2, 2.5, 5]} />
              <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Blade */}
            <mesh position={[0, npc.radius * 1.2, 0]} castShadow>
              <boxGeometry args={[1.5, npc.radius * 3.5, 6]} />
              <meshStandardMaterial color="#e0e0e0" metalness={1} roughness={0.1} />
            </mesh>
            {/* Blood / Glow on blade if attacking */}
            <mesh position={[0, npc.radius * 1.2, 0]}>
              <boxGeometry args={[1.7, npc.radius * 3.6, 6.2]} />
              <meshStandardMaterial color="#01BEFE" transparent opacity={isAttacking ? 0.4 : 0} emissive="#01BEFE" emissiveIntensity={isAttacking ? 2 : 0} />
            </mesh>
          </group>

          {/* Shield in left hand */}
          <group position={[-npc.radius * 1.3, 0, npc.radius * 0.5]} rotation={[0, 0, Math.PI / 6]}>
            {/* Shield Base */}
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[npc.radius, npc.radius, 2, 16]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.8} />
            </mesh>
            {/* Shield Rim */}
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <torusGeometry args={[npc.radius, 1.5, 8, 16]} />
              <meshStandardMaterial color="#ffd700" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Shield Center Boss */}
            <mesh position={[0, 0, 1.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <sphereGeometry args={[npc.radius * 0.4, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#01BEFE" metalness={0.8} roughness={0.1} emissive="#01BEFE" emissiveIntensity={0.5} />
            </mesh>
          </group>
        </group>
      </group>
    </RigidBody>
  );
};

// Manages the overall 3D scene physics and states
const SceneManager = ({ activeTool, onRemovePlatform }: { activeTool?: 'draw' | 'erase'; onRemovePlatform?: (id: string) => void }) => {
  const [balls, setBalls] = useState(physicsEngine.balls);
  const [platforms, setPlatforms] = useState(physicsEngine.customPlatformsData);
  const [config, setConfig] = useState(physicsEngine.getConfig());
  const [clashes, setClashes] = useState(physicsEngine.clashes);
  const [damageNumbers, setDamageNumbers] = useState(physicsEngine.damageNumbers);
  const { size } = useThree();

  useEffect(() => {
    const unsubscribe = physicsEngine.subscribe(() => {
      setBalls([...physicsEngine.balls]);
      setPlatforms([...physicsEngine.customPlatformsData]);
      setConfig(physicsEngine.getConfig());
      setClashes([...physicsEngine.clashes]);
      setDamageNumbers([...physicsEngine.damageNumbers]);
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!config.autoSpawn) return;
    const interval = setInterval(() => {
      physicsEngine.spawnBall();
    }, config.spawnIntervalMs);
    return () => clearInterval(interval);
  }, [config.autoSpawn, config.spawnIntervalMs]);

  return (
    <Physics gravity={[0, -config.gravityY * 1500, 0]}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[size.width / 2, -size.height / 2, 500]} intensity={1.5} />
      
      {/* 2.5D Confinement Bounds */}
      <RigidBody type="fixed" restitution={0.8} friction={0.1}>
        <CuboidCollider position={[-25, -size.height / 2, 0]} args={[25, size.height * 2, 200]} />
        <CuboidCollider position={[size.width + 25, -size.height / 2, 0]} args={[25, size.height * 2, 200]} />
        {/* Glass Front and Back Planes (Widened to prevent snagging swords/shields) */}
        <CuboidCollider position={[size.width / 2, -size.height / 2, 120]} args={[size.width, size.height * 2, 10]} />
        <CuboidCollider position={[size.width / 2, -size.height / 2, -120]} args={[size.width, size.height * 2, 10]} />
      </RigidBody>

      {/* Kill Floor (Cleans up fallen balls) */}
      <RigidBody 
        type="fixed" 
        position={[size.width / 2, -size.height - 200, 0]} 
        onIntersectionEnter={(payload) => {
          const id = payload.other.rigidBodyObject?.userData?.id;
          if (id) physicsEngine.removeBall(id);
        }}
      >
        <CuboidCollider args={[size.width * 2, 50, 200]} sensor />
      </RigidBody>

      {/* Entities */}
      {platforms.map(p => (
        <Platform3D key={p.id} poly={p} restitution={config.platformRestitution} activeTool={activeTool} onRemove={onRemovePlatform} />
      ))}

      {balls.map(b => (
        <Npc3D key={b.id} npc={b} restitution={config.ballRestitution} friction={config.ballFriction} />
      ))}
      
      {clashes.map(c => (
        <ClashVFX key={c.id} position={c.pos} color={c.color} />
      ))}

      {/* Floating Damage Numbers */}
      <DamageNumbersVFX events={damageNumbers} />
    </Physics>
  );
};

export const CanvasStage: React.FC<CanvasStageProps> = ({
  inputMode,
  drawnPlatforms,
  setDrawnPlatforms,
  activeColor,
  activeTool,
  onBallSpawned
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (inputMode === 'interactive_draw') {
      physicsEngine.updatePlatforms(drawnPlatforms);
    }
  }, [drawnPlatforms, inputMode]);

  const handleRemovePlatform = (id: string) => {
    setDrawnPlatforms(prev => prev.filter(p => p.id !== id));
  };

  const getPointerCoords = (e: React.PointerEvent<HTMLDivElement>): Point | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = getPointerCoords(e);
    if (!pt) return;

    if (activeTool === 'erase') {
      const isPointNearPolygon = (p: Point, poly: Point[], threshold: number = 20): boolean => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x, yi = poly[i].y;
          const xj = poly[j].x, yj = poly[j].y;
          const intersect = ((yi > p.y) !== (yj > p.y))
              && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        if (inside) return true;

        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x, yi = poly[i].y;
          const xj = poly[j].x, yj = poly[j].y;
          const l2 = Math.pow(xj - xi, 2) + Math.pow(yj - yi, 2);
          let d = 0;
          if (l2 === 0) {
            d = Math.hypot(p.x - xi, p.y - yi);
          } else {
            let t = ((p.x - xi) * (xj - xi) + (p.y - yi) * (yj - yi)) / l2;
            t = Math.max(0, Math.min(1, t));
            d = Math.hypot(p.x - (xi + t * (xj - xi)), p.y - (yi + t * (yj - yi)));
          }
          if (d <= threshold) return true;
        }
        return false;
      };

      const hit = drawnPlatforms.find(plat => isPointNearPolygon(pt, plat.points, 15));
      if (hit) {
        setDrawnPlatforms(prev => prev.filter(p => p.id !== hit.id));
      }
      return;
    }

    if (inputMode === 'interactive_draw') {
      setIsDrawing(true);
      setCurrentStroke([pt]);
    } else {
      physicsEngine.spawnBall(pt.x, pt.y);
      if (onBallSpawned) onBallSpawned();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || inputMode !== 'interactive_draw') return;
    const pt = getPointerCoords(e);
    if (!pt) return;

    setCurrentStroke(prev => {
      const last = prev[prev.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 8) return prev;
      return [...prev, pt];
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStroke.length >= 2) {
      const points = createPolygonFromStroke(currentStroke, 14);
      if (points.length >= 3) {
        const newPlatform: PlatformPolygon = {
          id: `custom_${Date.now()}`,
          points,
          color: activeColor,
          isCustom: true
        };
        setDrawnPlatforms(prev => [...prev, newPlatform]);
      }
    } else if (currentStroke.length === 1) {
      physicsEngine.spawnBall(currentStroke[0].x, currentStroke[0].y);
      if (onBallSpawned) onBallSpawned();
    }
    setCurrentStroke([]);
  };

  const createPolygonFromStroke = (stroke: Point[], thickness: number): Point[] => {
    if (stroke.length < 2) return [];
    const leftSide: Point[] = [];
    const rightSide: Point[] = [];

    for (let i = 0; i < stroke.length - 1; i++) {
      const p1 = stroke[i];
      const p2 = stroke[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * (thickness / 2);
      const ny = (dx / len) * (thickness / 2);

      leftSide.push({ x: p1.x + nx, y: p1.y + ny });
      rightSide.push({ x: p1.x - nx, y: p1.y - ny });

      if (i === stroke.length - 2) {
        leftSide.push({ x: p2.x + nx, y: p2.y + ny });
        rightSide.push({ x: p2.x - nx, y: p2.y - ny });
      }
    }
    return [...leftSide, ...rightSide.reverse()];
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#12131C] overflow-hidden select-none">
      
      {/* 3D WebGL Canvas Layer */}
      <Canvas orthographic gl={{ antialias: false, toneMapping: THREE.NoToneMapping }}>
        <OrthoCamera />
        <SceneManager activeTool={activeTool} onRemovePlatform={handleRemovePlatform} />
        <EffectComposer enableNormalPass={false}>
          <Bloom luminanceThreshold={0.2} mipmapBlur intensity={1.5} />
        </EffectComposer>
      </Canvas>

      {/* Interactive Overlay Layer (Catches drawing & spawn clicks) */}
      <div 
        className={`absolute inset-0 z-20 touch-none ${
          inputMode === 'interactive_draw' 
            ? (activeTool === 'erase' ? 'pointer-events-none' : 'cursor-crosshair') 
            : 'cursor-pointer'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {isDrawing && currentStroke.length > 1 && (
          <svg className="w-full h-full pointer-events-none">
            <polyline
              points={currentStroke.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={activeColor}
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 12px ${activeColor})` }}
            />
          </svg>
        )}
      </div>

      {/* Hints */}
      {inputMode === 'interactive_draw' && drawnPlatforms.length === 0 && !isDrawing && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-slate-300 text-xs font-medium flex items-center gap-2 shadow-xl animate-fade-in z-30">
          <span className="w-2 h-2 rounded-full bg-[#05D5AF] animate-ping" />
          <span>Click & drag to draw custom physical ramps or click anywhere to drop balls!</span>
        </div>
      )}
    </div>
  );
};
