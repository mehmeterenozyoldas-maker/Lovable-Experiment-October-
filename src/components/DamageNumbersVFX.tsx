import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DamageNumberEvent } from '../physics/physicsEngine';

interface DamageNumbersVFXProps {
  events: DamageNumberEvent[];
}

const DamageNumberItem: React.FC<{ event: DamageNumberEvent }> = ({ event }) => {
  const spriteRef = useRef<THREE.Sprite>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null);
  const initialPos = useRef(new THREE.Vector3(event.pos[0], event.pos[1] + 15, event.pos[2] + 5));

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isCrit = !!event.isCrit;
    const isLethal = !!event.isLethal;

    // Font selection
    const fontSize = isLethal ? 46 : (isCrit ? 40 : 34);
    ctx.font = `italic 900 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Glowing shadow
    ctx.shadowColor = isLethal 
      ? 'rgba(255, 42, 109, 0.9)' 
      : (isCrit ? 'rgba(254, 213, 51, 0.9)' : 'rgba(0, 0, 0, 0.8)');
    ctx.shadowBlur = isCrit || isLethal ? 18 : 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    // Thick dark outer stroke for pristine readability
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#05060A';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeText(event.text, cx, cy);

    // Additional inner stroke
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#12131C';
    ctx.strokeText(event.text, cx, cy);

    // Vibrant fill
    if (isCrit) {
      const grad = ctx.createLinearGradient(0, cy - 20, 0, cy + 20);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.4, '#FED533');
      grad.addColorStop(1, '#FF7E27');
      ctx.fillStyle = grad;
    } else if (isLethal) {
      const grad = ctx.createLinearGradient(0, cy - 20, 0, cy + 20);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.5, '#FF2A6D');
      grad.addColorStop(1, '#8F00FF');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = event.color || '#05D5AF';
    }

    ctx.fillText(event.text, cx, cy);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [event.text, event.color, event.isCrit, event.isLethal]);

  useEffect(() => {
    return () => {
      if (texture) texture.dispose();
    };
  }, [texture]);

  useFrame(() => {
    if (!spriteRef.current || !materialRef.current) return;
    const age = (Date.now() - event.timestamp) / 1000;
    if (age > 1.0) {
      spriteRef.current.visible = false;
      return;
    }

    // Upward floating arc
    const pop = Math.min(1, age * 8);
    const floatY = (Math.sin(pop * Math.PI * 0.5) * 20) + (age * 30);
    const floatX = event.isCrit ? Math.sin(age * 12) * 6 : 0;

    spriteRef.current.position.set(
      initialPos.current.x + floatX,
      initialPos.current.y + floatY,
      initialPos.current.z
    );

    // Punchy pop scale
    const baseW = event.isLethal ? 64 : (event.isCrit ? 54 : 44);
    const baseH = baseW * (96 / 256);
    const scaleFactor = (1 + 0.3 * Math.sin(pop * Math.PI)) * (1 - Math.max(0, (age - 0.6) / 0.4));

    spriteRef.current.scale.set(baseW * scaleFactor, baseH * scaleFactor, 1);

    // Fade out
    materialRef.current.opacity = Math.max(0, 1 - Math.max(0, (age - 0.45) / 0.45));
  });

  if (!texture) return null;

  return (
    <sprite ref={spriteRef} position={[initialPos.current.x, initialPos.current.y, initialPos.current.z]}>
      <spriteMaterial 
        ref={materialRef} 
        map={texture} 
        transparent 
        depthTest={false} 
        depthWrite={false} 
      />
    </sprite>
  );
};

export const DamageNumbersVFX: React.FC<DamageNumbersVFXProps> = ({ events }) => {
  return (
    <group>
      {events.map(ev => (
        <DamageNumberItem key={ev.id} event={ev} />
      ))}
    </group>
  );
};
