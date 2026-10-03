export interface Point {
  x: number;
  y: number;
}

export interface ColorHSV {
  hMin: number; // 0 - 360
  hMax: number;
  sMin: number; // 0 - 100
  sMax: number;
  vMin: number; // 0 - 100
  vMax: number;
}

export interface CalibrationPoints {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export type PentatonicScaleName = 
  | 'c_major_pentatonic' 
  | 'a_minor_pentatonic' 
  | 'hirajoshi' 
  | 'lydian_ambient' 
  | 'akebono'
  | 'cosmic_drift';

export interface ScalePreset {
  id: PentatonicScaleName;
  name: string;
  notes: number[]; // MIDI note numbers
  description: string;
}

export interface AudioConfig {
  masterVolume: number;
  ambienceVolume: number;
  ambienceEnabled: boolean;
  reverbSize: number;
  selectedScale: PentatonicScaleName;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface PhysicsConfig {
  gravityY: number;
  ballRestitution: number; // Elasticity (0.0 to 1.0)
  platformRestitution: number;
  ballFriction: number;
  spawnIntervalMs: number;
  autoSpawn: boolean;
  glowIntensity: number;
  maxBalls: number;
  npcSpeedMultiplier: number;
  npcJumpMultiplier: number;
}

export interface PlatformPolygon {
  id: string;
  points: Point[];
  color?: string;
  isCustom?: boolean;
}

export type InputMode = 'interactive_draw' | 'webcam_cv' | 'demo_simulation';
