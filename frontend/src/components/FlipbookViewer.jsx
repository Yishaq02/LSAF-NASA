import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Sun,
  Contrast as ContrastIcon,
  RotateCcw,
  Video,
  Download,
  Sliders,
  Layers,
  Crosshair,
  AlertCircle,
  Eye,
  Activity,
  Sparkles,
  Zap
} from 'lucide-react';
import { getEpochImageUrl, getDifference, exportAndDownloadMp4 } from '../services/api';

// Map aliases to backend target IDs
const BACKEND_ID = {
  barnard: 'barnard',
  wise_0855: 'wise0855',
  wise0855: 'wise0855',
  epsilon_indi_b: 'epsilon_indi_b',
  rw_aurigae: 'rwaur',
  rwaur: 'rwaur',
  r_draconis: 'rdra',
  rdra: 'rdra',
  plutino: 'plutino',
};

export default function FlipbookViewer({
  targetId,
  ra,
  dec,
  manifest,
  frames = [],
  mode = 'normal',
  onChangeMode,
  fps = 5,
  onChangeFps,
  invert = false,
  onChangeInvert,
  epochA = 0,
  onChangeEpochA,
  epochB = 1,
  onChangeEpochB,
  onPixelClick,
  onTriggerIngest,
  isIngesting = false,
  isLoadingDiff = false,
  isLoadingSky = false,
  isExpertMode = false,
}) {
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Optical Potentiometers
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);

  // Difference Mode Settings
  const [diffDetector, setDiffDetector] = useState(1);
  const [diffSigma, setDiffSigma] = useState(3.0);
  const [diffImageUrl, setDiffImageUrl] = useState(null);
  const [diffError, setDiffError] = useState(null);
  const [computingDiff, setComputingDiff] = useState(false);

  // Pixel inspection & Hover state
  const [inspectedPixel, setInspectedPixel] = useState(null);
  const [hoverPixel, setHoverPixel] = useState(null);

  // Video Export
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportError, setExportError] = useState(null);

  const imageContainerRef = useRef(null);

  // Calculate total epochs
  const manifestEpochs = Array.isArray(manifest)
    ? manifest
    : manifest?.epochs || manifest?.epocas || [];

  const totalEpochs = (frames && frames.length > 0)
    ? frames.length
    : manifestEpochs.length;

  useEffect(() => {
    setCurrentEpoch(0);
  }, [targetId, frames?.length]);

  useEffect(() => {
    if (totalEpochs > 0 && currentEpoch >= totalEpochs) {
      setCurrentEpoch(0);
    }
  }, [totalEpochs, currentEpoch]);

  // Playback Loop synced to FPS
  useEffect(() => {
    if (!isPlaying || totalEpochs <= 1 || mode === 'diff') {
      return;
    }

    const intervalMs = Math.round(1000 / fps);
    const timer = setInterval(() => {
      setCurrentEpoch((prev) => (prev + 1) % totalEpochs);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, totalEpochs, fps, mode]);

  // Load Difference Image when in diff mode
  useEffect(() => {
    if (mode !== 'diff') {
      setDiffImageUrl(null);
      return;
    }

    const effectiveId = targetId || 'sky';
    let isMounted = true;
    setComputingDiff(true);
    setDiffError(null);

    const backendId = BACKEND_ID[effectiveId] || effectiveId;
    getDifference(backendId, {
      a: epochA,
      b: epochB,
      detector: diffDetector,
      sigma: diffSigma,
      ra,
      dec,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.imageUrl) {
          setDiffImageUrl(res.imageUrl);
        } else if (res.data?.png_base64) {
          const b64 = res.data.png_base64;
          setDiffImageUrl(b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`);
        } else if (res.data?.frame) {
          const b64 = res.data.frame;
          setDiffImageUrl(b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setDiffError(err.message || 'Error calculating NumPy difference');
        if (frames && frames.length > 0) {
          const f = frames[0];
          setDiffImageUrl(f ? (f.startsWith('data:') ? f : `data:image/png;base64,${f}`) : null);
        }
      })
      .finally(() => {
        if (isMounted) setComputingDiff(false);
      });

    return () => {
      isMounted = false;
    };
  }, [mode, targetId, epochA, epochB, diffDetector, diffSigma, ra, dec, frames]);

  // Determine current image source
  let currentImageSrc = null;
  if (mode === 'diff') {
    if (diffImageUrl) {
      currentImageSrc = diffImageUrl;
    } else if (frames && frames.length > 0) {
      const f = frames[0];
      currentImageSrc = f?.startsWith('data:') ? f : `data:image/png;base64,${f}`;
    }
  } else if (frames && frames.length > 0) {
    const idx = Math.min(Math.max(0, currentEpoch), frames.length - 1);
    const frame = frames[idx];
    currentImageSrc = frame?.startsWith('data:') ? frame : `data:image/png;base64,${frame}`;
  } else if (targetId && totalEpochs > 0) {
    const backendId = BACKEND_ID[targetId] || targetId;
    currentImageSrc = getEpochImageUrl(backendId, currentEpoch);
  } else if (manifestEpochs.length > 0 && targetId) {
    const backendId = BACKEND_ID[targetId] || targetId;
    currentImageSrc = getEpochImageUrl(backendId, currentEpoch);
  }

  // Handle pixel click (auto pause playback on exact frame)
  const handleImageClick = (e) => {
    if (isPlaying) {
      setIsPlaying(false);
    }

    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = (imageContainerRef.current.naturalWidth || rect.width) / rect.width;
    const scaleY = (imageContainerRef.current.naturalHeight || rect.height) / rect.height;

    const pixelX = Math.round(x * scaleX);
    const pixelY = Math.round(y * scaleY);

    setInspectedPixel({ x: pixelX, y: pixelY, displayX: x, displayY: y });
    if (onPixelClick) {
      onPixelClick({ x: pixelX, y: pixelY, index: currentEpoch });
    }
  };

  const handleMouseMove = (e) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scaleX = (imageContainerRef.current.naturalWidth || rect.width) / rect.width;
    const scaleY = (imageContainerRef.current.naturalHeight || rect.height) / rect.height;
    setHoverPixel({ x: Math.round(x * scaleX), y: Math.round(y * scaleY) });
  };

  const resetFilters = () => {
    setBrightness(100);
    setContrast(100);
    onChangeInvert(false);
  };

  const handleExportMp4 = async () => {
    if (!targetId && !frames?.length && (ra === undefined || dec === undefined)) {
      setExportError('A target or sky exploration is required to export discovery video');
      return;
    }
    setIsExportingVideo(true);
    setExportError(null);
    try {
      const backendId = BACKEND_ID[targetId] || targetId || 'sky';
      await exportAndDownloadMp4({
        target: backendId,
        mode,
        fps,
        ra: typeof ra === 'number' && !isNaN(ra) ? ra : undefined,
        dec: typeof dec === 'number' && !isNaN(dec) ? dec : undefined,
      });
    } catch (err) {
      console.error('Export video error:', err);
      setExportError(err.message || 'Failed to generate MP4 video');
    } finally {
      setIsExportingVideo(false);
    }
  };

  return (
    <div className="relative cosmic-card p-4 md:p-5 flex flex-col gap-4 font-sans text-slate-100 shadow-2xl">
      
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-[#FFB45E]/20 to-[#E879F9]/20 border border-amber-400/30 text-amber-300">
            <Zap className="w-4 h-4 text-[#FFB45E]" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Time Travel: Explore the Universe Through Time</span>
            </h2>
            <p className="text-xs text-slate-400">
              Compare observations from different moments to reveal what has changed in the sky.
            </p>
          </div>
        </div>

        {/* Prominent Motion Detector (NumPy Difference) Switch */}
        <div className="flex items-center gap-1.5 bg-[#0F1A34] p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => onChangeMode('normal')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'normal'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(37,217,242,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Temporal Flipbook
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('diff')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              mode === 'diff'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(255,180,94,0.4)]'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Motion Detector (Difference)</span>
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative w-full aspect-square max-h-[460px] mx-auto bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center shadow-inner group">
        
        {/* Loading Spinner */}
        {(computingDiff || isLoadingDiff || isLoadingSky) && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-bold text-amber-300 tracking-wide uppercase">
              {mode === 'diff' ? 'Computing NumPy Epoch Subtraction...' : 'Loading Scientific FITS Cutout...'}
            </p>
          </div>
        )}

        {/* FITS / PNG Epoch Image */}
        {currentImageSrc ? (
          <img
            ref={imageContainerRef}
            src={currentImageSrc}
            alt="Astronomical Epoch Observation"
            onClick={handleImageClick}
            onMouseMove={handleMouseMove}
            style={{
              filter: `brightness(${brightness}%) contrast(${contrast}%) ${invert ? 'invert(1)' : ''}`,
            }}
            className="w-full h-full object-contain cursor-crosshair select-none transition-filter"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
            <p className="text-xs font-medium">No observation epochs loaded yet.</p>
            <p className="text-[11px] text-slate-500 mt-1">Select a featured star or explore a sky sector to load imagery.</p>
          </div>
        )}

        {/* Inspected Pixel Crosshair Reticle Overlay */}
        {inspectedPixel && imageContainerRef.current && (
          <div
            className="absolute pointer-events-none z-10 w-4 h-4 border border-cyan-400 -translate-x-1/2 -translate-y-1/2 animate-ping"
            style={{
              left: `${inspectedPixel.displayX}px`,
              top: `${inspectedPixel.displayY}px`,
            }}
          />
        )}

        {/* Hover / Current Frame Readout Overlay */}
        <div className="absolute top-3 left-3 z-10 bg-[#080D1B]/85 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1 text-[11px] font-mono text-slate-200">
          {mode === 'diff' ? (
            <span className="text-amber-300 font-bold">Difference: Epoch {epochA + 1} − Epoch {epochB + 1}</span>
          ) : (
            <span>
              Epoch <span className="text-cyan-400 font-bold">{totalEpochs > 0 ? String(currentEpoch + 1).padStart(2, '0') : '00'}</span> / {String(totalEpochs || 0).padStart(2, '0')}
            </span>
          )}
        </div>

        {/* Coordinates Readout Overlay (Bottom Right) */}
        {hoverPixel && (
          <div className="absolute bottom-3 right-3 z-10 bg-[#080D1B]/85 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1 text-[10px] font-mono text-cyan-300">
            Pixel: ({hoverPixel.x}, {hoverPixel.y})
          </div>
        )}
      </div>

      {/* Playback & Epoch Controls (Temporal Flipbook Mode) */}
      {mode === 'normal' && (
        <div className="flex flex-col gap-3 bg-[#0F1A34]/50 border border-white/10 rounded-xl p-3">
          
          {/* Timeline Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium shrink-0">Timeline:</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, totalEpochs - 1)}
              value={currentEpoch}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentEpoch(Number(e.target.value));
              }}
              className="w-full h-1.5 cursor-pointer"
            />
            <span className="text-xs font-mono text-cyan-300 font-bold shrink-0 tabular-nums">
              {totalEpochs > 0 ? currentEpoch + 1 : 0} of {totalEpochs}
            </span>
          </div>

          {/* Buttons: Prev, Play/Pause, Next, and Speed Selectors */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentEpoch((prev) => (prev - 1 + totalEpochs) % totalEpochs);
                }}
                disabled={totalEpochs <= 1}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-all cursor-pointer disabled:opacity-40"
                title="Previous Epoch"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={totalEpochs <= 1}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(37,217,242,0.4)] cursor-pointer disabled:opacity-40"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-slate-950" />}
                <span>{isPlaying ? 'Pause' : 'Play Flipbook'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentEpoch((prev) => (prev + 1) % totalEpochs);
                }}
                disabled={totalEpochs <= 1}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition-all cursor-pointer disabled:opacity-40"
                title="Next Epoch"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Speed Selector (FPS: 2, 5, 10) */}
            <div className="flex items-center gap-1 bg-[#080D1B] border border-white/10 rounded-xl p-1 text-xs">
              <span className="text-[11px] text-slate-400 px-1 font-medium">Speed:</span>
              {[2, 5, 10].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onChangeFps(rate)}
                  className={`px-2.5 py-0.5 rounded-lg font-mono text-xs transition-all cursor-pointer ${
                    fps === rate
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rate} FPS
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Difference Mode Controls */}
      {mode === 'diff' && (
        <div className="flex flex-col gap-3 bg-[#0F1A34]/50 border border-amber-500/30 rounded-xl p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-medium">Epoch A:</span>
              <select
                value={epochA}
                onChange={(e) => onChangeEpochA(Number(e.target.value))}
                className="bg-[#080D1B] border border-white/15 rounded-lg px-2 py-1 text-slate-200 font-mono"
              >
                {Array.from({ length: totalEpochs }, (_, i) => (
                  <option key={i} value={i}>Epoch {i + 1}</option>
                ))}
              </select>

              <span className="text-slate-300 font-medium">Epoch B:</span>
              <select
                value={epochB}
                onChange={(e) => onChangeEpochB(Number(e.target.value))}
                className="bg-[#080D1B] border border-white/15 rounded-lg px-2 py-1 text-slate-200 font-mono"
              >
                {Array.from({ length: totalEpochs }, (_, i) => (
                  <option key={i} value={i}>Epoch {i + 1}</option>
                ))}
              </select>
            </div>

            {isExpertMode && (
              <div className="flex items-center gap-3 font-mono text-[11px]">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Detector:</span>
                  <select
                    value={diffDetector}
                    onChange={(e) => setDiffDetector(Number(e.target.value))}
                    className="bg-[#080D1B] border border-white/15 rounded-lg px-2 py-0.5 text-slate-200"
                  >
                    {[1, 2, 3, 4, 5, 6].map((d) => (
                      <option key={d} value={d}>Band {d}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Threshold (σ):</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={diffSigma}
                    onChange={(e) => setDiffSigma(Number(e.target.value))}
                    className="w-14 bg-[#080D1B] border border-white/15 rounded-lg px-1.5 py-0.5 text-slate-200 text-center"
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            NumPy subtraction computes (Epoch A − Epoch B). Static stars cancel out, leaving bright/dark bipolar signatures that reveal moving stars or asteroids.
          </p>
        </div>
      )}

      {/* Optical Potentiometers (Brightness, Contrast, Invert) & MP4 Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
        
        {/* Optical Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Brightness */}
          <div className="flex items-center gap-1.5" title="Adjust Image Brightness">
            <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <input
              type="range"
              min="50"
              max="200"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-20 h-1 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-400 w-8 tabular-nums">{brightness}%</span>
          </div>

          {/* Contrast */}
          <div className="flex items-center gap-1.5" title="Adjust Image Contrast">
            <ContrastIcon className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <input
              type="range"
              min="50"
              max="200"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-20 h-1 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-400 w-8 tabular-nums">{contrast}%</span>
          </div>

          {/* Invert Colors Toggle */}
          <button
            type="button"
            onClick={() => onChangeInvert(!invert)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer ${
              invert
                ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <span>Invert Colors</span>
          </button>

          {/* Reset Filters */}
          {(brightness !== 100 || contrast !== 100 || invert) && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-slate-400 hover:text-cyan-300 p-1"
              title="Reset Optical Filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Download Discovery Video (.MP4) */}
        <div>
          <button
            type="button"
            onClick={handleExportMp4}
            disabled={isExportingVideo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-cyan-400/50 text-cyan-300 font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
            title="Export synchronized high-definition MP4 video loop of current observations"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isExportingVideo ? 'Rendering Video...' : 'Download Discovery Video (.MP4)'}</span>
          </button>
        </div>

      </div>

      {exportError && (
        <div className="p-2 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200">
          {exportError}
        </div>
      )}

    </div>
  );
}
