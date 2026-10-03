import React, { useState, useRef, useEffect } from 'react';
import { X, Pipette, Eye, Target, RefreshCw, Check, Sparkles, Crosshair } from 'lucide-react';
import { ColorHSV, CalibrationPoints } from '../types';
import { CVProcessor } from '../vision/cvProcessor';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  hsvBounds: ColorHSV;
  setHsvBounds: React.Dispatch<React.SetStateAction<ColorHSV>>;
  calibPoints: CalibrationPoints;
  setCalibPoints: React.Dispatch<React.SetStateAction<CalibrationPoints>>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  platformUpdateFreq: number;
  setPlatformUpdateFreq: (freq: number) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  hsvBounds,
  setHsvBounds,
  calibPoints,
  setCalibPoints,
  videoRef,
  platformUpdateFreq,
  setPlatformUpdateFreq
}) => {
  const [activeTab, setActiveTab] = useState<'hsv' | 'perspective'>('hsv');
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [dragCorner, setDragCorner] = useState<keyof CalibrationPoints | null>(null);
  const [isAutoMapping, setIsAutoMapping] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Preset Masking Tape HSV colors
  const presetColors = [
    { name: 'Neon Green Tape', hsv: { hMin: 35, hMax: 95, sMin: 35, sMax: 100, vMin: 35, vMax: 100 }, hex: '#22c55e' },
    { name: 'Bright Blue Tape', hsv: { hMin: 180, hMax: 240, sMin: 40, sMax: 100, vMin: 40, vMax: 100 }, hex: '#3b82f6' },
    { name: 'Magenta Tape', hsv: { hMin: 280, hMax: 340, sMin: 40, sMax: 100, vMin: 40, vMax: 100 }, hex: '#ec4899' },
    { name: 'Yellow Tape', hsv: { hMin: 15, hMax: 50, sMin: 50, sMax: 100, vMin: 50, vMax: 100 }, hex: '#eab308' },
    { name: 'High Contrast (Any Tape)', hsv: { hMin: 0, hMax: 360, sMin: 30, sMax: 100, vMin: 60, vMax: 100 }, hex: '#a855f7' }
  ];

  // Process live camera threshold preview
  useEffect(() => {
    if (!isOpen) return;

    let animId: number;

    const updatePreview = () => {
      const video = videoRef.current;
      const previewCanvas = previewCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;

      if (video && previewCanvas && maskCanvas && video.readyState >= 2) {
        const w = 320;
        const h = 240;

        previewCanvas.width = w;
        previewCanvas.height = h;
        maskCanvas.width = w;
        maskCanvas.height = h;

        const pCtx = previewCanvas.getContext('2d');
        const mCtx = maskCanvas.getContext('2d');

        if (pCtx && mCtx) {
          pCtx.drawImage(video, 0, 0, w, h);

          // Draw 4 perspective corner handles on preview
          pCtx.strokeStyle = '#05D5AF';
          pCtx.lineWidth = 2;
          pCtx.beginPath();
          pCtx.moveTo(calibPoints.topLeft.x, calibPoints.topLeft.y);
          pCtx.lineTo(calibPoints.topRight.x, calibPoints.topRight.y);
          pCtx.lineTo(calibPoints.bottomRight.x, calibPoints.bottomRight.y);
          pCtx.lineTo(calibPoints.bottomLeft.x, calibPoints.bottomLeft.y);
          pCtx.closePath();
          pCtx.stroke();

          // Draw handles
          const handles: { key: keyof CalibrationPoints; pt: { x: number; y: number } }[] = [
            { key: 'topLeft', pt: calibPoints.topLeft },
            { key: 'topRight', pt: calibPoints.topRight },
            { key: 'bottomRight', pt: calibPoints.bottomRight },
            { key: 'bottomLeft', pt: calibPoints.bottomLeft }
          ];

          for (const hnd of handles) {
            pCtx.beginPath();
            pCtx.arc(hnd.pt.x, hnd.pt.y, 6, 0, Math.PI * 2);
            pCtx.fillStyle = dragCorner === hnd.key ? '#FF2A6D' : '#05D5AF';
            pCtx.fill();
            pCtx.strokeStyle = '#ffffff';
            pCtx.stroke();
          }

          // Process HSV mask
          const imgData = pCtx.getImageData(0, 0, w, h);
          const { maskData } = CVProcessor.processHSVThreshold(imgData, hsvBounds);
          mCtx.putImageData(maskData, 0, 0);
        }
      }

      animId = requestAnimationFrame(updatePreview);
    };

    animId = requestAnimationFrame(updatePreview);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, hsvBounds, calibPoints, dragCorner, videoRef]);

  // Handle color sampling click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEyedropperActive) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Auto-tune HSV statistically around the clicked region
    const tunedBounds = CVProcessor.autoTuneHSV(imgData, x, y, 12);
    setHsvBounds(tunedBounds);

    setIsEyedropperActive(false);
  };

  // Perform Auto-Mapping
  const performAutoMap = () => {
    setIsAutoMapping(true);
    
    // Allow React to render the magenta corners, then capture frame after short delay
    setTimeout(() => {
      const video = videoRef.current;
      if (!video) {
        setIsAutoMapping(false);
        return;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, 320, 240);
        const imgData = ctx.getImageData(0, 0, 320, 240);
        const pts = CVProcessor.findAutoCalibrationMarkers(imgData);
        if (pts && pts.length === 4) {
          setCalibPoints({
            topLeft: pts[0],
            topRight: pts[1],
            bottomRight: pts[2],
            bottomLeft: pts[3]
          });
        } else {
          alert('Could not detect the 4 magenta corners in the camera feed. Please ensure the webcam can see the entire screen and there is no extreme glare.');
        }
      }
      setIsAutoMapping(false);
    }, 1500); // 1.5s delay to allow markers to show up on screen and webcam to adjust
  };

  // Handle perspective corner drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'perspective') return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const my = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const corners: (keyof CalibrationPoints)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    for (const c of corners) {
      const pt = calibPoints[c];
      const dist = Math.hypot(mx - pt.x, my - pt.y);
      if (dist < 15) {
        setDragCorner(c);
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragCorner) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = Math.max(0, Math.min(canvas.width, ((e.clientX - rect.left) / rect.width) * canvas.width));
    const my = Math.max(0, Math.min(canvas.height, ((e.clientY - rect.top) / rect.height) * canvas.height));

    setCalibPoints(prev => ({
      ...prev,
      [dragCorner]: { x: Math.round(mx), y: Math.round(my) }
    }));
  };

  const handleMouseUp = () => {
    setDragCorner(null);
  };

  if (!isOpen && !isAutoMapping) return null;

  return (
    <>
      {/* Auto-Mapping Markers (Rendered globally on top) */}
      {isAutoMapping && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 bg-[#FF00FF] border-8 border-white" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF00FF] border-8 border-white" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#FF00FF] border-8 border-white" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#FF00FF] border-8 border-white" />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <Crosshair className="w-16 h-16 text-[#FF00FF] animate-spin mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">Auto-Mapping...</h2>
            <p className="text-lg text-white/80">Please hold your webcam still and ensure it sees the entire screen.</p>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#181A24] border border-white/15 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#12131C]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#05D5AF]/10 text-[#05D5AF] border border-[#05D5AF]/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">CV Platform Calibration</h2>
                  <p className="text-xs text-slate-400">Isolate physical masking tape & calibrate perspective warp</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Tabs */}
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <button
                  onClick={() => setActiveTab('hsv')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'hsv'
                      ? 'bg-[#05D5AF] text-slate-950 shadow-md shadow-[#05D5AF]/20'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <Pipette className="w-4 h-4" />
                  1. Color Hue Calibration (HSV)
                </button>

                <button
                  onClick={() => setActiveTab('perspective')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'perspective'
                      ? 'bg-[#01BEFE] text-slate-950 shadow-md shadow-[#01BEFE]/20'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  2. 4-Corner Perspective Warp
                </button>
              </div>

              {/* Dual Camera Preview Canvas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0D0E15] p-4 rounded-xl border border-white/10">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#05D5AF]" />
                      Live Camera Feed
                    </span>
                    {activeTab === 'hsv' && (
                      <button
                        onClick={() => setIsEyedropperActive(!isEyedropperActive)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                          isEyedropperActive
                            ? 'bg-[#FF2A6D] border-[#FF2A6D] text-white shadow-sm'
                            : 'bg-white/10 border-white/15 text-slate-300 hover:text-white'
                        }`}
                      >
                        <Pipette className="w-3 h-3" />
                        {isEyedropperActive ? 'Click Tape Color' : 'Auto-Tune from Click'}
                      </button>
                    )}
                  </div>
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-black">
                    <canvas
                      ref={previewCanvasRef}
                      onClick={handleCanvasClick}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      className={`w-full h-full object-cover ${
                        isEyedropperActive ? 'cursor-crosshair' : activeTab === 'perspective' ? 'cursor-move' : ''
                      }`}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {activeTab === 'perspective'
                      ? 'Drag the 4 corner handles to align camera feed with target screen area.'
                      : 'Click anywhere on camera feed to auto-tune HSV for that tape color.'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#FED533]" />
                      Binary Detection Mask
                    </span>
                  </div>
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-black">
                    <canvas ref={maskCanvasRef} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Green highlighted areas represent physical tape detected as platform obstacles.
                  </p>
                </div>
              </div>

              {/* Preset Color Pickers */}
              {activeTab === 'hsv' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-2">Preset Masking Tape Colors</label>
                    <div className="flex flex-wrap gap-2">
                      {presetColors.map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={() => setHsvBounds(preset.hsv)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 transition-colors"
                        >
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.hex }} />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* HSV Sliders */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0D0E15] p-4 rounded-xl border border-white/10">
                    {/* Hue */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">Hue (H)</span>
                        <span className="text-[#05D5AF] font-mono">{hsvBounds.hMin}° - {hsvBounds.hMax}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={hsvBounds.hMin}
                        onChange={(e) => setHsvBounds(p => ({ ...p, hMin: Number(e.target.value) }))}
                        className="w-full accent-[#05D5AF]"
                      />
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={hsvBounds.hMax}
                        onChange={(e) => setHsvBounds(p => ({ ...p, hMax: Number(e.target.value) }))}
                        className="w-full accent-[#05D5AF]"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">Saturation (S)</span>
                        <span className="text-[#01BEFE] font-mono">{hsvBounds.sMin}% - {hsvBounds.sMax}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={hsvBounds.sMin}
                        onChange={(e) => setHsvBounds(p => ({ ...p, sMin: Number(e.target.value) }))}
                        className="w-full accent-[#01BEFE]"
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={hsvBounds.sMax}
                        onChange={(e) => setHsvBounds(p => ({ ...p, sMax: Number(e.target.value) }))}
                        className="w-full accent-[#01BEFE]"
                      />
                    </div>

                    {/* Value */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">Value / Brightness (V)</span>
                        <span className="text-[#FED533] font-mono">{hsvBounds.vMin}% - {hsvBounds.vMax}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={hsvBounds.vMin}
                        onChange={(e) => setHsvBounds(p => ({ ...p, vMin: Number(e.target.value) }))}
                        className="w-full accent-[#FED533]"
                      />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={hsvBounds.vMax}
                        onChange={(e) => setHsvBounds(p => ({ ...p, vMax: Number(e.target.value) }))}
                        className="w-full accent-[#FED533]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Perspective Reset & Scan Freq */}
              {activeTab === 'perspective' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-[#0D0E15] p-4 rounded-xl border border-white/10">
                    <div>
                      <h4 className="text-sm font-semibold text-white">Auto-Detect Corners</h4>
                      <p className="text-xs text-slate-400">Render tracking markers and snap to them instantly</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCalibPoints({
                          topLeft: { x: 0, y: 0 },
                          topRight: { x: 320, y: 0 },
                          bottomRight: { x: 320, y: 240 },
                          bottomLeft: { x: 0, y: 240 }
                        })}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
                      >
                        Reset
                      </button>
                      <button
                        onClick={performAutoMap}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#FF00FF] hover:bg-[#FF00FF]/90 text-white text-xs font-bold transition-colors shadow-lg shadow-[#FF00FF]/20"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        Auto-Map
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#0D0E15] p-4 rounded-xl border border-white/10 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Camera Polygon Update Frequency</span>
                      <span className="text-[#05D5AF] font-mono">Every {platformUpdateFreq} frames</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={platformUpdateFreq}
                      onChange={(e) => setPlatformUpdateFreq(Number(e.target.value))}
                      className="w-full accent-[#05D5AF]"
                    />
                    <p className="text-[11px] text-slate-500">
                      Lower values update platform shapes faster; higher values optimize CPU performance.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-[#12131C] flex justify-end">
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#05D5AF] hover:bg-[#05D5AF]/90 text-slate-950 font-bold text-xs shadow-lg shadow-[#05D5AF]/20 transition-all"
              >
                <Check className="w-4 h-4" />
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
