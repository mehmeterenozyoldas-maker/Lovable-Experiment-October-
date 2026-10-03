import { PhysicsConfig, PlatformPolygon } from '../types';
import { audioSynth } from '../audio/synthEngine';

export const NEON_BALL_COLORS = [
  '#FF2A6D', '#FF7E27', '#FED533', '#05D5AF', '#01BEFE', '#8F00FF'
];

export interface NPCClass {
  type: number;
  name: string;
  maxHp: number;
  cd: number;
  kb: number;
  bounciness: number;
  density: number;
  speed: number;
  trackingRange: number;
  jumpForce: number;
}

export const CHARACTER_CLASSES: Record<number, NPCClass> = {
  1: { type: 1, name: "Tank Boxy", maxHp: 20, cd: 1500, kb: 0.3, bounciness: 0.1, density: 4.0, speed: 200, trackingRange: 400, jumpForce: 0 },
  2: { type: 2, name: "Agile Slime", maxHp: 6, cd: 500, kb: 2.5, bounciness: 1.2, density: 0.5, speed: 500, trackingRange: 500, jumpForce: 2000 },
  0: { type: 0, name: "Balanced Mushroom", maxHp: 12, cd: 1000, kb: 1.0, bounciness: 0.6, density: 1.0, speed: 300, trackingRange: 450, jumpForce: 500 }
};

export interface NpcData {
  id: string;
  x: number;
  y: number;
  color: string;
  radius: number;
  characterType: number;
  hp: number;
  lastDamage: number;
  lastAttack: number;
  hitStopUntil: number;
  stats: NPCClass;
}

export interface ClashEvent {
  id: string;
  pos: [number, number, number];
  color: string;
  timestamp: number;
}

export interface DamageNumberEvent {
  id: string;
  pos: [number, number, number];
  amount: number;
  text: string;
  color: string;
  isCrit?: boolean;
  isLethal?: boolean;
  timestamp: number;
}

export class PhysicsEngine {
  private config: PhysicsConfig = {
    gravityY: 1.5, // Scaled for 3D units
    ballRestitution: 0.75,
    platformRestitution: 0.95,
    ballFriction: 0.2,
    spawnIntervalMs: 800,
    autoSpawn: true,
    glowIntensity: 4, // Re-used for emissive intensity in 3D
    maxBalls: 25,
    npcSpeedMultiplier: 0.6,
    npcJumpMultiplier: 0.4
  };

  public balls: NpcData[] = [];
  public customPlatformsData: PlatformPolygon[] = [];
  public clashes: ClashEvent[] = [];
  public damageNumbers: DamageNumberEvent[] = [];
  public npcPositions: Map<string, [number, number, number]> = new Map();

  // Combat Juice States
  public screenShakeTrauma = 0;
  public shakeMultiplier = 1.0;
  public damageNumbersEnabled = true;
  
  private listeners: Set<() => void> = new Set();

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public triggerScreenShake(amount = 0.5): void {
    this.screenShakeTrauma = Math.min(1.0, this.screenShakeTrauma + amount * this.shakeMultiplier);
  }

  public decayScreenShake(delta: number): void {
    if (this.screenShakeTrauma > 0) {
      this.screenShakeTrauma = Math.max(0, this.screenShakeTrauma - delta * 2.2);
    }
  }

  public getScreenShakeTrauma(): number {
    return this.screenShakeTrauma;
  }

  public spawnDamageNumber(
    pos: [number, number, number],
    amount: number,
    text: string,
    color: string,
    isCrit = false,
    isLethal = false
  ): void {
    const now = Date.now();
    const id = `dmg_${now}_${Math.random()}`;
    this.damageNumbers.push({
      id,
      pos: [pos[0], pos[1], pos[2]],
      amount,
      text,
      color,
      isCrit,
      isLethal,
      timestamp: now
    });

    // Cleanup events older than 1200ms
    if (this.damageNumbers.length > 25) {
      this.damageNumbers = this.damageNumbers.filter(d => now - d.timestamp < 1200);
    }
  }

  public updateNpcPosition(id: string, pos: [number, number, number]) {
    this.npcPositions.set(id, pos);
  }

  public calculateTacticalImpulse(id: string): [number, number, number] | null {
    const npc = this.balls.find(b => b.id === id);
    if (!npc || npc.hp <= 0) return null;
    if (Date.now() < npc.hitStopUntil) return null;
    
    const pos = this.npcPositions.get(id);
    if (!pos) return null;

    let closestDist = npc.stats.trackingRange;
    let targetPos: [number, number, number] | null = null;

    // Find nearest valid opponent
    for (const other of this.balls) {
      if (other.id === id || other.hp <= 0) continue;
      const otherPos = this.npcPositions.get(other.id);
      if (!otherPos) continue;

      const dist = Math.hypot(otherPos[0] - pos[0], otherPos[1] - pos[1], otherPos[2] - pos[2]);
      if (dist < closestDist) {
        closestDist = dist;
        targetPos = otherPos;
      }
    }

    if (targetPos) {
      const dx = targetPos[0] - pos[0];
      // Note: We ignore Y in the distance vector to avoid flying up toward jumping targets
      const dz = targetPos[2] - pos[2];
      const length = Math.hypot(dx, dz);
      
      if (length > 0.001) {
        // Random chance to actually jump so they aren't bouncing constantly
        const doJump = Math.random() < 0.3;
        return [
          (dx / length) * npc.stats.speed * this.config.npcSpeedMultiplier, 
          doJump ? (npc.stats.jumpForce * this.config.npcJumpMultiplier) : 0, 
          (dz / length) * npc.stats.speed * this.config.npcSpeedMultiplier
        ];
      }
    }

    return null;
  }

  public spawnBall(x?: number, y?: number): void {
    const id = `npc_${Date.now()}_${Math.random()}`;
    const radius = Math.floor(Math.random() * 8) + 16;
    const color = NEON_BALL_COLORS[Math.floor(Math.random() * NEON_BALL_COLORS.length)];
    const characterType = Math.floor(Math.random() * 3); // 0, 1, or 2
    const stats = CHARACTER_CLASSES[characterType];
    
    // -1 indicates it should randomize X in the 3D canvas
    this.balls.push({ 
      id, 
      x: x ?? -1, 
      y: y ?? -30, 
      color, 
      radius, 
      characterType,
      hp: stats.maxHp,
      lastDamage: 0,
      lastAttack: 0,
      hitStopUntil: 0,
      stats
    });
    
    if (this.balls.length > this.config.maxBalls) {
      this.balls.shift(); // Remove oldest
    }
    this.notify();
  }

  public handleNpcCollision(idA: string, idB: string, pos: [number, number, number]): void {
    const now = Date.now();
    const npc = this.balls.find(b => b.id === idA);
    const otherNpc = this.balls.find(b => b.id === idB);
    
    if (!npc || !otherNpc) return;

    let updated = false;

    // Check attack cooldown
    if (now - npc.lastAttack > npc.stats.cd) {
      npc.lastAttack = now;
      updated = true;
      
      const isCrit = Math.random() < 0.28;
      const dmg = isCrit ? (npc.stats.type === 1 ? 3 : 2) : 1;
      
      // Hit-stop effect for both attacker and target
      const hitStopDuration = isCrit ? 260 : 190;
      npc.hitStopUntil = now + hitStopDuration;
      otherNpc.hitStopUntil = now + hitStopDuration;

      // Spawn clash effect at impact point
      const clashId = `clash_${now}_${Math.random()}`;
      this.clashes.push({ id: clashId, pos, color: isCrit ? '#FED533' : npc.color, timestamp: now });
      this.clashes = this.clashes.filter(c => now - c.timestamp < 1000);

      // Damage with i-frames check on otherNpc
      if (now - otherNpc.lastDamage > 380 && otherNpc.hp > 0) {
        otherNpc.hp = Math.max(0, otherNpc.hp - dmg);
        otherNpc.lastDamage = now;
        const isLethal = otherNpc.hp <= 0;

        const text = isLethal ? 'K.O.!' : (isCrit ? `CRIT! -${dmg}` : `-${dmg}`);
        const numColor = isLethal ? '#FF2A6D' : (isCrit ? '#FED533' : npc.color);

        if (this.damageNumbersEnabled) {
          this.spawnDamageNumber(pos, dmg, text, numColor, isCrit, isLethal);
        }

        // Trigger combat screen shake
        this.triggerScreenShake(isLethal ? 1.0 : (isCrit ? 0.65 : 0.35));

        // Play punchy combat audio
        audioSynth.playCombatHit(isCrit, isLethal);
      }
    }

    if (updated) {
      this.notify();
    }
  }

  public removeBall(id: string): void {
    this.balls = this.balls.filter(b => b.id !== id);
    this.npcPositions.delete(id);
    this.notify();
  }

  public updatePlatforms(polygons: PlatformPolygon[]): void {
    this.customPlatformsData = polygons;
    this.notify();
  }

  public clearBalls(): void {
    this.balls = [];
    this.npcPositions.clear();
    this.damageNumbers = [];
    this.clashes = [];
    this.screenShakeTrauma = 0;
    this.notify();
  }

  public updateConfig(newConfig: Partial<PhysicsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.notify();
  }

  public getConfig(): PhysicsConfig {
    return { ...this.config };
  }

  public getBallsCount(): number {
    return this.balls.length;
  }
  
  // Stubs for legacy Canvas2D compatibility from App.tsx
  public initCanvas(canvas: HTMLCanvasElement): void {}
  public updateBounds(): void {}
  public startLoop(): void {}
  public stopLoop(): void {}
}

export const physicsEngine = new PhysicsEngine();
