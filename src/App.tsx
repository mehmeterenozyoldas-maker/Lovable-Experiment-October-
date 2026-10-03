import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { CanvasStage } from './components/CanvasStage';
import { WebcamOverlay } from './components/WebcamOverlay';
import { CalibrationModal } from './components/CalibrationModal';
import { ControlPanel } from './components/ControlPanel';
import { DesignToolbar } from './components/DesignToolbar';
import { 
  InputMode, 
  ColorHSV, 
  CalibrationPoints, 
  AudioConfig, 
  PhysicsConfig, 
  PlatformPolygon 
} from './types';
import { PRESET_PLATFORMS, PresetLayout } from './data/presetPlatforms';
import { audioSynth } from './audio/synthEngine';
import { physicsEngine } from './physics/physicsEngine';

export default function App() {
  const [inputMode, setInputMode] = useState<InputMode>('interactive_draw');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [ballCount, setBallCount] = useState(0);

  // Active Drawing Color & Tool
  const [activeColor, setActiveColor] = useState('#05D5AF');
  const [activeTool, setActiveTool] = useState<'draw' | 'erase'>('draw');

  // Modals & Drawers
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  // Video Ref shared across components
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Platform Polygons
  const [drawnPlatforms, setDrawnPlatforms] = useState<PlatformPolygon[]>([]);

  // HSV Bounds for Computer Vision Tape Detection
  const [hsvBounds, setHsvBounds] = useState<ColorHSV>({
    hMin: 35,
    hMax: 95,
    sMin: 35,
    sMax: 100,
    vMin: 35,
    vMax: 100
  });

  // Perspective Warp 4 Corners
  const [calibPoints, setCalibPoints] = useState<CalibrationPoints>({
    topLeft: { x: 0, y: 0 },
    topRight: { x: 320, y: 0 },
    bottomRight: { x: 320, y: 240 },
    bottomLeft: { x: 0, y: 240 }
  });

  const [platformUpdateFreq, setPlatformUpdateFreq] = useState<number>(3);

  // Audio Config
  const [audioConfig, setAudioConfig] = useState<AudioConfig>({
    masterVolume: 0.3,
    ambienceVolume: 0.35,
    ambienceEnabled: true,
    reverbSize: 0.85,
    selectedScale: 'c_major_pentatonic',
    attack: 0.08,
    decay: 0.4,
    sustain: 0.1,
    release: 3.0
  });

  // Physics Config
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfig>({
    gravityY: 1.0,
    ballRestitution: 0.75,
    platformRestitution: 0.95,
    ballFriction: 0.2,
    spawnIntervalMs: 800,
    autoSpawn: true,
    glowIntensity: 4,
    maxBalls: 25,
    npcSpeedMultiplier: 0.6,
    npcJumpMultiplier: 0.4
  });

  // Initialize with blank canvas
  useEffect(() => {
    setDrawnPlatforms([]);
  }, []);

  // Sync physics config changes
  useEffect(() => {
    physicsEngine.updateConfig(physicsConfig);
  }, [physicsConfig]);

  // Ball count ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setBallCount(physicsEngine.getBallsCount());
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // User click gesture audio activation
  const handleToggleAudio = async () => {
    if (!audioEnabled) {
      await audioSynth.init();
      audioSynth.startAmbience();
      setAudioEnabled(true);
    } else {
      audioSynth.updateConfig({ masterVolume: 0, ambienceEnabled: false });
      setAudioEnabled(false);
    }
  };

  const handleLoadPreset = (preset: PresetLayout) => {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 800;
    setDrawnPlatforms(preset.getPlatforms(w, h));
  };

  const handleClearPlatforms = () => {
    setDrawnPlatforms([]);
    physicsEngine.updatePlatforms([]);
  };

  const handleSpawnBall = () => {
    physicsEngine.spawnBall();
  };

  const handleClearBalls = () => {
    physicsEngine.clearBalls();
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#12131C] overflow-hidden select-none font-sans text-white">
      {/* Top Navigation & Status Bar */}
      <Header
        inputMode={inputMode}
        setInputMode={setInputMode}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        onOpenControls={() => setIsControlsOpen(true)}
        ballCount={ballCount}
        onClearBalls={handleClearBalls}
        onSpawnBall={handleSpawnBall}
      />

      {/* Main Interactive Stage */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <DesignToolbar
          inputMode={inputMode}
          activeColor={activeColor}
          setActiveColor={setActiveColor}
          onClearPlatforms={handleClearPlatforms}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
        />

        <CanvasStage
          inputMode={inputMode}
          drawnPlatforms={drawnPlatforms}
          setDrawnPlatforms={setDrawnPlatforms}
          activeColor={activeColor}
          activeTool={activeTool}
          onBallSpawned={() => {
            if (!audioEnabled) handleToggleAudio();
          }}
        />

        {/* Webcam / Demo Overlay Stream */}
        <WebcamOverlay
          inputMode={inputMode}
          hsvBounds={hsvBounds}
          calibPoints={calibPoints}
          platformUpdateFreq={platformUpdateFreq}
          videoRef={videoRef}
        />
      </main>

      {/* Calibration Modal */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        hsvBounds={hsvBounds}
        setHsvBounds={setHsvBounds}
        calibPoints={calibPoints}
        setCalibPoints={setCalibPoints}
        videoRef={videoRef}
        platformUpdateFreq={platformUpdateFreq}
        setPlatformUpdateFreq={setPlatformUpdateFreq}
      />

      {/* Audio & Physics Controls Drawer */}
      <ControlPanel
        isOpen={isControlsOpen}
        onClose={() => setIsControlsOpen(false)}
        audioConfig={audioConfig}
        setAudioConfig={setAudioConfig}
        physicsConfig={physicsConfig}
        setPhysicsConfig={setPhysicsConfig}
        onLoadPreset={handleLoadPreset}
        onClearPlatforms={handleClearPlatforms}
      />
    </div>
  );
}
