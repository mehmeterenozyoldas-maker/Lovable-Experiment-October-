import React from 'react';
import { Pencil, Trash2, CircleDot, Eraser } from 'lucide-react';
import { physicsEngine } from '../physics/physicsEngine';

interface DesignToolbarProps {
  inputMode: string;
  activeColor: string;
  setActiveColor: (color: string) => void;
  onClearPlatforms: () => void;
  activeTool: 'draw' | 'erase';
  setActiveTool: (tool: 'draw' | 'erase') => void;
}

const COLORS = [
  '#05D5AF', // Mint
  '#01BEFE', // Cyan
  '#FF2A6D', // Pink
  '#FF7E27', // Orange
  '#FED533', // Yellow
  '#8F00FF'  // Purple
];

export const DesignToolbar: React.FC<DesignToolbarProps> = ({
  inputMode,
  activeColor,
  setActiveColor,
  onClearPlatforms,
  activeTool,
  setActiveTool
}) => {
  if (inputMode !== 'interactive_draw') return null;

  const handleClearBalls = () => {
    physicsEngine.clearBalls();
  };

  return (
    <div className="absolute top-24 left-6 z-20 flex flex-col gap-4 bg-[#181A24]/90 backdrop-blur-md border border-white/15 p-3 rounded-2xl shadow-2xl animate-fade-in w-48">
      
      {/* Tool Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-white/10">
        <Pencil className="w-4 h-4 text-[#05D5AF]" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">Design Mode</span>
      </div>

      {/* Tools */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTool('draw')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
            activeTool === 'draw' ? 'bg-[#05D5AF]/20 text-[#05D5AF] border border-[#05D5AF]/50' : 'text-slate-400 hover:bg-white/5 border border-transparent'
          }`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveTool('erase')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
            activeTool === 'erase' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50' : 'text-slate-400 hover:bg-white/5 border border-transparent'
          }`}
          title="Click a tape to remove it"
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>

      {/* Tape Colors (Only show if drawing) */}
      {activeTool === 'draw' && (
        <div className="space-y-2 animate-fade-in">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Tape Color</span>
          <div className="grid grid-cols-3 gap-2">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                className={`w-10 h-10 rounded-full transition-all border-2 mx-auto ${
                  activeColor === color 
                    ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)]' 
                    : 'border-transparent hover:scale-105 hover:border-white/50'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="w-full h-px bg-white/10" />

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleClearBalls}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <CircleDot className="w-4 h-4" />
          Clear NPCs
        </button>
        <button
          onClick={onClearPlatforms}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear Canvas
        </button>
      </div>

    </div>
  );
};
