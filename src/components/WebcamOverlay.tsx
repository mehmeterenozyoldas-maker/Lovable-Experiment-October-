import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, AlertCircle, Video, CheckCircle, RefreshCw } from 'lucide-react';
import { ColorHSV, CalibrationPoints, InputMode, PlatformPolygon } from '../types';
import { CVProcessor } from '../vision/cvProcessor';
import { physicsEngine } from '../physics/physicsEngine';

interface WebcamOverlayProps {
  inputMode: InputMode;
  hsvBounds: ColorHSV;
  calibPoints: CalibrationPoints;
  platformUpdateFreq: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const WebcamOverlay: React.FC<WebcamOverlayProps> = ({
  inputMode,
  hsvBounds,
  calibPoints,
  platformUpdateFreq,
  videoRef
}) => {
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const demoCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraStatus, setCameraStatus] = useState<'idle' | 'active' | 'denied' | 'simulated'>('idle');
  const [detectedPlatformsCount, setDetectedPlatformsCount] = useState<number>(0);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    try {
      setCameraStatus('idle');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraStatus('active');
      }
    } catch (err) {
      console.warn('Webcam access error:', err);
      setCameraStatus('denied');
    }
  }, [videoRef]);

  useEffect(() => {
    if (inputMode === 'webcam_cv') {
      startCamera();
    } else if (inputMode === 'demo_simulation') {
      setCameraStatus('simulated');
    } else {
      // Release camera
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      setCameraStatus('idle');
    }
  }, [inputMode, startCamera, videoRef]);

  // Demo Video Simulation Generator
  useEffect(() => {
    if (inputMode !== 'demo_simulation') return;

    const demoCanvas = demoCanvasRef.current;
    if (!demoCanvas) return;

    const ctx = demoCanvas.getContext('2d');
    if (!ctx) return;

    demoCanvas.width = 640;
    demoCanvas.height = 480;

    let frame = 0;
    let animId: number;

    const renderDemoFrame = () => {
      frame++;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 640, 480);

      // Draw simulated camera background scene
      ctx.fillStyle = '#334155';
      ctx.fillRect(20, 20, 600, 440);

      // Draw moving Green Tape platforms
      ctx.fillStyle = '#22c55e'; // Bright Green Tape

      // Tape Platform 1
      const offset1 = Math.sin(frame * 0.02) * 20;
      ctx.beginPath();
      ctx.moveTo(80, 140 + offset1);
      ctx.lineTo(380, 220 + offset1);
      ctx.lineTo(380, 245 + offset1);
      ctx.lineTo(80, 165 + offset1);
      ctx.closePath();
      ctx.fill();

      // Tape Platform 2
      const offset2 = Math.cos(frame * 0.025) * 15;
      ctx.beginPath();
      ctx.moveTo(260, 320 + offset2);
      ctx.lineTo(560, 260 + offset2);
      ctx.lineTo(560, 285 + offset2);
      ctx.lineTo(260, 345 + offset2);
      ctx.closePath();
      ctx.fill();

      animId = requestAnimationFrame(renderDemoFrame);
    };

    animId = requestAnimationFrame(renderDemoFrame);
    return () => cancelAnimationFrame(animId);
  }, [inputMode]);

  // Process video frames for platform extraction
  useEffect(() => {
    if (inputMode === 'interactive_draw') return;

    let frameCount = 0;
    let animId: number;

    const processLoop = () => {
      frameCount++;

      const isTime = platformUpdateFreq === 0 || frameCount % platformUpdateFreq === 0;

      if (isTime) {
        let sourceElement: HTMLVideoElement | HTMLCanvasElement | null = null;

        if (inputMode === 'webcam_cv' && videoRef.current && videoRef.current.readyState >= 2) {
          sourceElement = videoRef.current;
        } else if (inputMode === 'demo_simulation' && demoCanvasRef.current) {
          sourceElement = demoCanvasRef.current;
        }

        if (sourceElement) {
          const procCanvas = processCanvasRef.current;
          if (procCanvas) {
            const w = 320;
            const h = 240;
            procCanvas.width = w;
            procCanvas.height = h;

            const pCtx = procCanvas.getContext('2d');
            if (pCtx) {
              pCtx.drawImage(sourceElement, 0, 0, w, h);

              const imgData = pCtx.getImageData(0, 0, w, h);
              const { matchingPixels } = CVProcessor.processHSVThreshold(imgData, hsvBounds);

              // Extract raw camera clusters
              const clusters = CVProcessor.extractPlatformPolygons(matchingPixels, w, h, 20);

              // Pre-compute True 3x3 Homography Matrix mapping camera bounds to screen bounds
              const screenW = window.innerWidth;
              const screenH = window.innerHeight;

              const srcPts = [
                calibPoints.topLeft,
                calibPoints.topRight,
                calibPoints.bottomRight,
                calibPoints.bottomLeft
              ];
              const dstPts = [
                { x: 0, y: 0 },
                { x: screenW, y: 0 },
                { x: screenW, y: screenH },
                { x: 0, y: screenH }
              ];
              
              const homographyMatrix = CVProcessor.calculateHomography(srcPts, dstPts);

              const platforms: PlatformPolygon[] = clusters.map((hull, idx) => {
                const transformed = hull.map(p => CVProcessor.applyHomography(p, homographyMatrix));
                return {
                  id: `cv_plat_${idx}`,
                  points: transformed,
                  color: '#05D5AF'
                };
              });

              setDetectedPlatformsCount(platforms.length);
              physicsEngine.updatePlatforms(platforms);
            }
          }
        }
      }

      animId = requestAnimationFrame(processLoop);
    };

    animId = requestAnimationFrame(processLoop);
    return () => cancelAnimationFrame(animId);
  }, [inputMode, hsvBounds, calibPoints, platformUpdateFreq, videoRef]);

  if (inputMode === 'interactive_draw') return null;

  return (
    <>
      {/* Hidden processing canvas */}
      <canvas ref={processCanvasRef} className="hidden" />

      {/* Hidden Video element for webcam stream */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* Hidden Demo canvas */}
      <canvas ref={demoCanvasRef} className="hidden" />

      {/* Camera PIP View Floating Overlay */}
      <div className="absolute bottom-6 right-6 z-20 w-64 bg-[#181A24]/90 backdrop-blur-md border border-white/15 rounded-2xl p-3 shadow-2xl flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white flex items-center gap-1.5">
            {inputMode === 'webcam_cv' ? (
              <Camera className="w-3.5 h-3.5 text-[#05D5AF]" />
            ) : (
              <Video className="w-3.5 h-3.5 text-[#01BEFE]" />
            )}
            {inputMode === 'webcam_cv' ? 'Live Camera Feed' : 'Demo Tape Stream'}
          </span>

          <span className="text-[10px] font-mono text-[#05D5AF] bg-[#05D5AF]/10 px-2 py-0.5 rounded-full border border-[#05D5AF]/30">
            {detectedPlatformsCount} Platforms
          </span>
        </div>

        {/* Video Preview Frame */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
          {cameraStatus === 'denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-rose-950/80 text-rose-200">
              <AlertCircle className="w-6 h-6 text-rose-400 mb-1" />
              <p className="text-[11px] font-medium">Camera Access Denied or Unavailable</p>
              <button
                onClick={startCamera}
                className="mt-2 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[10px] font-bold"
              >
                <RefreshCw className="w-3 h-3" /> Retry Camera
              </button>
            </div>
          )}

          {cameraStatus === 'active' && (
            <video
              ref={el => {
                if (el && videoRef.current && videoRef.current.srcObject) {
                  el.srcObject = videoRef.current.srcObject;
                  el.play().catch(() => {});
                }
              }}
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          )}

          {cameraStatus === 'simulated' && (
            <canvas
              ref={el => {
                if (el && demoCanvasRef.current) {
                  const ctx = el.getContext('2d');
                  const draw = () => {
                    if (ctx && demoCanvasRef.current) {
                      ctx.drawImage(demoCanvasRef.current, 0, 0, el.width, el.height);
                    }
                    requestAnimationFrame(draw);
                  };
                  draw();
                }
              }}
              width={256}
              height={144}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </div>
    </>
  );
};
