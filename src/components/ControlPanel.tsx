import React, { useState, useEffect } from 'react';
import { 
  X, 
  Volume2, 
  Sliders, 
  Music, 
  Activity, 
  Radio, 
  Layers, 
  Sparkles, 
  Trash2, 
  Play,
  RotateCcw,
  Zap
} from 'lucide-react';
import { AudioConfig, PhysicsConfig, PentatonicScaleName } from '../types';
import { SCALE_PRESETS, audioSynth } from '../audio/synthEngine';
import { PRESET_PLATFORMS, PresetLayout } from '../data/presetPlatforms';
import { physicsEngine } from '../physics/physicsEngine';

interface ControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  audioConfig: AudioConfig;
  setAudioConfig: React.Dispatch<React.SetStateAction<AudioConfig>>;
  physicsConfig: PhysicsConfig;
  setPhysicsConfig: React.Dispatch<React.SetStateAction<PhysicsConfig>>;
  onLoadPreset: (preset: PresetLayout) => void;
  onClearPlatforms: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isOpen,
  onClose,
  audioConfig,
  setAudioConfig,
  physicsConfig,
  setPhysicsConfig,
  onLoadPreset,
  onClearPlatforms
}) => {
  const [shakeMultiplier, setShakeMultiplier] = useState(physicsEngine.shakeMultiplier);
  const [damageNumbers, setDamageNumbers] = useState(physicsEngine.damageNumbersEnabled);

  useEffect(() => {
    const unsub = physicsEngine.subscribe(() => {
      setShakeMultiplier(physicsEngine.shakeMultiplier);
      setDamageNumbers(physicsEngine.damageNumbersEnabled);
    });
    return () => {
      unsub();
    };
  }, []);
  if (!isOpen) return null;

  const handleScaleChange = (scaleId: PentatonicScaleName) => {
    setAudioConfig(prev => {
      const updated = { ...prev, selectedScale: scaleId };
      audioSynth.updateConfig(updated);
      return updated;
    });
  };

  const handleAudioChange = (key: keyof AudioConfig, value: number | boolean) => {
    setAudioConfig(prev => {
      const updated = { ...prev, [key]: value };
      audioSynth.updateConfig(updated);
      return updated;
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 sm:w-96 bg-[#181A24]/95 backdrop-blur-xl border-l border-white/10 z-40 shadow-2xl flex flex-col text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#12131C]">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-[#01BEFE]" />
          <h2 className="text-base font-bold">Installation Controls</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
        {/* Platform Layout Presets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              <Layers className="w-4 h-4 text-[#05D5AF]" />
              Platform Layout Presets
            </span>
            <button
              onClick={onClearPlatforms}
              className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear Platforms
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {PRESET_PLATFORMS.map(preset => (
              <button
                key={preset.id}
                onClick={() => onLoadPreset(preset)}
                className="p-3 rounded-xl bg-[#0D0E15] hover:bg-white/10 border border-white/10 text-left transition-all group"
              >
                <div className="font-semibold text-white group-hover:text-[#05D5AF] transition-colors">
                  {preset.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Pentatonic Scale Selector */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
            <Music className="w-4 h-4 text-[#8F00FF]" />
            Pentatonic Audio Scale
          </span>

          <div className="space-y-2">
            {(Object.keys(SCALE_PRESETS) as PentatonicScaleName[]).map(scaleKey => {
              const scale = SCALE_PRESETS[scaleKey];
              const isSelected = audioConfig.selectedScale === scaleKey;
              return (
                <button
                  key={scaleKey}
                  onClick={() => handleScaleChange(scaleKey)}
                  className={`w-full p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-[#8F00FF]/20 border-[#8F00FF] text-white shadow-md shadow-[#8F00FF]/20'
                      : 'bg-[#0D0E15] border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>{scale.name}</span>
                    {isSelected && <Sparkles className="w-3.5 h-3.5 text-[#8F00FF]" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{scale.description}</p>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => audioSynth.playBounceSound(1.0)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-medium transition-colors border border-white/10"
          >
            <Play className="w-3.5 h-3.5 text-[#FED533]" />
            Test Pentatonic Note
          </button>
        </div>

        {/* Audio Synthesis Parameters */}
        <div className="space-y-4 border-t border-white/10 pt-4">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
            <Volume2 className="w-4 h-4 text-[#FED533]" />
            Synthesizer & Ambience
          </span>

          {/* Master Volume */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">Master Synth Volume</span>
              <span className="font-mono text-[#FED533]">{Math.round(audioConfig.masterVolume * 100)}%</span>
            </div>
            <div className="text-[10px] text-slate-400">Controls overall volume for sound effects and music. Lower this if the combat is too loud.</div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioConfig.masterVolume}
              onChange={(e) => handleAudioChange('masterVolume', Number(e.target.value))}
              className="w-full accent-[#FED533]"
            />
          </div>

          {/* Ambient Rumble Toggle */}
          <div className="flex items-center justify-between bg-[#0D0E15] p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <Radio className={`w-4 h-4 ${audioConfig.ambienceEnabled ? 'text-[#05D5AF] animate-pulse' : 'text-slate-500'}`} />
              <div>
                <div className="font-semibold text-white">Ambient Space Rumble</div>
                <div className="text-[10px] text-slate-400">Enables a low background hum/rumble to simulate an empty space.</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={audioConfig.ambienceEnabled}
              onChange={(e) => handleAudioChange('ambienceEnabled', e.target.checked)}
              className="w-4 h-4 accent-[#05D5AF] rounded"
            />
          </div>

          {/* Reverb Size */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">Cavernous Reverb</span>
              <span className="font-mono text-[#8F00FF]">{Math.round(audioConfig.reverbSize * 100)}%</span>
            </div>
            <div className="text-[10px] text-slate-400">Increases the echo/cavern effect of all sounds.</div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioConfig.reverbSize}
              onChange={(e) => handleAudioChange('reverbSize', Number(e.target.value))}
              className="w-full accent-[#8F00FF]"
            />
          </div>
        </div>

        {/* Physics Tuning */}
        <div className="space-y-4 border-t border-white/10 pt-4">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
            <Activity className="w-4 h-4 text-[#FF2A6D]" />
            Physics & Spawner
          </span>

          {/* Auto Spawn Toggle */}
          <div className="flex items-center justify-between bg-[#0D0E15] p-3 rounded-xl border border-white/10">
            <div>
              <div className="font-semibold text-white">Continuous NPC Drop</div>
              <div className="text-[10px] text-slate-400">When enabled, characters will drop into the arena automatically.</div>
            </div>
            <input
              type="checkbox"
              checked={physicsConfig.autoSpawn}
              onChange={(e) => setPhysicsConfig(p => ({ ...p, autoSpawn: e.target.checked }))}
              className="w-4 h-4 accent-[#FF2A6D] rounded"
            />
          </div>

          {/* Spawn Interval */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">Spawn Rate</span>
              <span className="font-mono text-[#FF2A6D]">Every {physicsConfig.spawnIntervalMs}ms</span>
            </div>
            <div className="text-[10px] text-slate-400">Determines how fast new characters appear when Auto Spawn is on.</div>
            <input
              type="range"
              min="200"
              max="3000"
              step="100"
              value={physicsConfig.spawnIntervalMs}
              onChange={(e) => setPhysicsConfig(p => ({ ...p, spawnIntervalMs: Number(e.target.value) }))}
              className="w-full accent-[#FF2A6D]"
            />
          </div>

          {/* NPC Movement Speed */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">NPC Speed Multiplier</span>
              <span className="font-mono text-[#05D5AF]">{Math.round(physicsConfig.npcSpeedMultiplier * 100)}%</span>
            </div>
            <div className="text-[10px] text-slate-400">Scales the movement speed of NPCs when they chase each other.</div>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={physicsConfig.npcSpeedMultiplier}
              onChange={(e) => setPhysicsConfig(p => ({ ...p, npcSpeedMultiplier: Number(e.target.value) }))}
              className="w-full accent-[#05D5AF]"
            />
          </div>

          {/* NPC Jump Frequency */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">NPC Jump Power</span>
              <span className="font-mono text-[#01BEFE]">{Math.round(physicsConfig.npcJumpMultiplier * 100)}%</span>
            </div>
            <div className="text-[10px] text-slate-400">Scales how high NPCs can jump. Lower values make combat less erratic.</div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.1"
              value={physicsConfig.npcJumpMultiplier}
              onChange={(e) => setPhysicsConfig(p => ({ ...p, npcJumpMultiplier: Number(e.target.value) }))}
              className="w-full accent-[#01BEFE]"
            />
          </div>

          {/* Gravity */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">Gravity Force</span>
              <span className="font-mono text-[#01BEFE]">{physicsConfig.gravityY.toFixed(1)}g</span>
            </div>
            <div className="text-[10px] text-slate-400">General downward pull. Higher gravity means characters fall faster.</div>
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={physicsConfig.gravityY}
              onChange={(e) => setPhysicsConfig(p => ({ ...p, gravityY: Number(e.target.value) }))}
              className="w-full accent-[#01BEFE]"
            />
          </div>

          {/* Elasticity */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">Ball Bounciness (Restitution)</span>
              <span className="font-mono text-[#05D5AF]">{Math.round(physicsConfig.ballRestitution * 100)}%</span>
            </div>
            <div className="text-[10px] text-slate-400">Controls how bouncy the NPCs are when they hit the floor or walls.</div>
            <input
              type="range"
              min="0.2"
              max="0.98"
              step="0.02"
              value={physicsConfig.ballRestitution}
              onChange={(e) => setPhysicsConfig(p => ({ ...p, ballRestitution: Number(e.target.value) }))}
              className="w-full accent-[#05D5AF]"
            />
          </div>

          {/* Neon Glow Intensity */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">Glow Aura Radius</span>
              <span className="font-mono text-[#FED533]">{physicsConfig.glowIntensity} Layer</span>
            </div>
            <div className="text-[10px] text-slate-400">Controls the intensity and bloom of glowing materials.</div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={physicsConfig.glowIntensity}
              onChange={(e) => setPhysicsConfig(p => ({ ...p, glowIntensity: Number(e.target.value) }))}
              className="w-full accent-[#FED533]"
            />
          </div>
        </div>

        {/* Combat Juice & Game Feel Controls */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
            <Zap className="w-4 h-4 text-[#FF2A6D]" />
            Combat Juice & Game Feel
          </span>

          {/* Screen Shake Intensity */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span className="font-semibold text-white">Screen Shake Trauma</span>
              <span className="font-mono text-[#FF2A6D]">{Math.round(shakeMultiplier * 100)}%</span>
            </div>
            <div className="text-[10px] text-slate-400">Controls the intensity of camera shake when heavy hits occur.</div>
            <input
              type="range"
              min="0"
              max="2.0"
              step="0.1"
              value={shakeMultiplier}
              onChange={(e) => {
                const val = Number(e.target.value);
                setShakeMultiplier(val);
                physicsEngine.shakeMultiplier = val;
              }}
              className="w-full accent-[#FF2A6D]"
            />
          </div>

          {/* Floating Damage Numbers Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#0D0E15] border border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FED533]" />
              <div>
                <span className="font-medium text-white block">Floating Damage Numbers</span>
                <span className="text-[10px] text-slate-400">Arcade popups & critical hits</span>
              </div>
            </div>
            <button
              onClick={() => {
                const next = !damageNumbers;
                setDamageNumbers(next);
                physicsEngine.damageNumbersEnabled = next;
              }}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                damageNumbers ? 'bg-[#FED533]' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-slate-900 transition-transform absolute top-1 ${
                  damageNumbers ? 'left-5' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
