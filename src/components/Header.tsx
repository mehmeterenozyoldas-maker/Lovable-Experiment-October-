import React from 'react';
import { 
  Camera, 
  PenTool, 
  Volume2, 
  VolumeX, 
  Sliders, 
  RefreshCw, 
  Play, 
  Sparkles,
  Music,
  Video
} from 'lucide-react';
import { InputMode } from '../types';

interface HeaderProps {
  inputMode: InputMode;
  setInputMode: (mode: InputMode) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onOpenCalibration: () => void;
  onOpenControls: () => void;
  ballCount: number;
  onClearBalls: () => void;
  onSpawnBall: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  inputMode,
  setInputMode,
  audioEnabled,
  onToggleAudio,
  onOpenCalibration,
  onOpenControls,
  ballCount,
  onClearBalls,
  onSpawnBall
}) => {
  return (
    <header className="h-16 bg-[#181A24]/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 flex items-center justify-between z-20 text-white shrink-0">
      {/* Title & Branding */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF2A6D] via-[#05D5AF] to-[#01BEFE] p-[2px] shadow-lg shadow-[#FF2A6D]/20">
          <div className="w-full h-full bg-[#12131C] rounded-[10px] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#05D5AF] animate-pulse" />
          </div>
        </div>
        <div>
          <h1 className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Interactive Bouncing Ball
          </h1>
          <p className="text-[11px] text-slate-400 font-mono -mt-1 hidden sm:block">
            CV Physics & Pentatonic Sound Installation
          </p>
        </div>
      </div>

      {/* Mode Selector Switcher */}
      <div className="flex items-center bg-[#0D0E15] p-1 rounded-xl border border-white/10 shadow-inner">
        <button
          onClick={() => setInputMode('interactive_draw')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            inputMode === 'interactive_draw'
              ? 'bg-[#FF2A6D] text-white shadow-md shadow-[#FF2A6D]/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Interactive Canvas</span>
        </button>

        <button
          onClick={() => setInputMode('webcam_cv')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            inputMode === 'webcam_cv'
              ? 'bg-[#05D5AF] text-slate-950 font-semibold shadow-md shadow-[#05D5AF]/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Webcam CV</span>
        </button>

        <button
          onClick={() => setInputMode('demo_simulation')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            inputMode === 'demo_simulation'
              ? 'bg-[#01BEFE] text-slate-950 font-semibold shadow-md shadow-[#01BEFE]/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Demo Video</span>
        </button>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Ball Spawn & Counter */}
        <div className="hidden lg:flex items-center gap-2 bg-[#0D0E15] px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono">
          <span className="text-slate-400">NPCs:</span>
          <span className="text-[#05D5AF] font-bold">{ballCount}</span>
        </div>

        <button
          onClick={onSpawnBall}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium border border-white/10 transition-colors"
          title="Drop NPC"
        >
          <Play className="w-3.5 h-3.5 text-[#FED533]" />
          <span className="hidden sm:inline">Drop NPC</span>
        </button>

        <button
          onClick={onClearBalls}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          title="Clear All NPCs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Audio Toggle */}
        <button
          onClick={onToggleAudio}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            audioEnabled
              ? 'bg-[#8F00FF]/20 border-[#8F00FF]/50 text-purple-300 shadow-sm shadow-[#8F00FF]/20'
              : 'bg-white/5 border-white/10 text-slate-400'
          }`}
          title={audioEnabled ? 'Audio Active' : 'Enable Pentatonic Synth'}
        >
          {audioEnabled ? (
            <>
              <Volume2 className="w-4 h-4 text-[#8F00FF] animate-bounce" />
              <span className="hidden sm:inline">Audio On</span>
            </>
          ) : (
            <>
              <VolumeX className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Enable Audio</span>
            </>
          )}
        </button>

        {/* Calibration Modal Trigger */}
        {(inputMode === 'webcam_cv' || inputMode === 'demo_simulation') && (
          <button
            onClick={onOpenCalibration}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#05D5AF]/10 border border-[#05D5AF]/30 text-[#05D5AF] hover:bg-[#05D5AF]/20 text-xs font-medium transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CV Calibration</span>
          </button>
        )}

        {/* Settings Drawer */}
        <button
          onClick={onOpenControls}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
          title="Audio & Physics Settings"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
