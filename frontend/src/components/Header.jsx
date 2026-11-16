import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Share2,
  Check,
  DownloadCloud,
  Layers,
  Compass,
  CheckCircle2,
  X,
  Crosshair,
  Activity,
  SlidersHorizontal,
  ChevronDown,
  Globe,
  Radio,
  Loader2,
  Eye,
  Rocket
} from 'lucide-react';

export default function Header({
  targets = [],
  selectedTargetId,
  onSelectTarget,
  onTriggerIngest,
  isIngesting = false,
  backendConnected = true,
  survey = 'CDS/P/2MASS/color',
  onChangeSurvey,
  ra,
  dec,
  detector: controlledDetector,
  onChangeDetector,
  isExpertMode = false,
  onToggleExpertMode,
}) {
  const [copied, setCopied] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [internalDetector, setInternalDetector] = useState('ALL');
  const detector = controlledDetector !== undefined ? controlledDetector : internalDetector;
  const setDetector = (val) => {
    setInternalDetector(val);
    if (onChangeDetector) onChangeDetector(val);
  };
  const [maxEpochs, setMaxEpochs] = useState(20);

  // Ingest modal local state
  const [isLocalIngesting, setIsLocalIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [ingestSuccess, setIngestSuccess] = useState(false);
  const [ingestError, setIngestError] = useState(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openModal = () => {
    setIsLocalIngesting(false);
    setIngestProgress(0);
    setRemainingTime(0);
    setIngestSuccess(false);
    setIngestError(null);
    setShowIngestModal(true);
  };

  const handleIngestSubmit = async (e) => {
    e.preventDefault();
    const tid = selectedTargetId || 'sky';

    setIsLocalIngesting(true);
    setIngestProgress(10);
    setIngestError(null);
    setIngestSuccess(false);

    const estDurationSec = Math.max(4, Math.round(maxEpochs * 1.2));
    setRemainingTime(estDurationSec);

    const progressTimer = setInterval(() => {
      setIngestProgress((prev) => {
        if (prev >= 92) return 92;
        return prev + Math.floor(Math.random() * 8) + 4;
      });
      setRemainingTime((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    try {
      await onTriggerIngest(tid, {
        detector: detector === 'ALL' ? null : Number(detector),
        max_epocas: Number(maxEpochs),
        ra,
        dec,
      });
      clearInterval(progressTimer);
      setIngestProgress(100);
      setRemainingTime(0);
      setIngestSuccess(true);
      setTimeout(() => {
        setShowIngestModal(false);
        setIsLocalIngesting(false);
      }, 1200);
    } catch (err) {
      clearInterval(progressTimer);
      setIsLocalIngesting(false);
      setIngestError(err.message || 'Error connecting to NASA IRSA');
    }
  };

  return (
    <header className="bg-[#080D1B]/90 border-b border-white/10 sticky top-0 z-40 px-3 md:px-5 py-2.5 backdrop-blur-xl transition-colors">
      <div className="max-w-[1920px] mx-auto flex flex-col gap-2">
        {/* Main Navbar Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand Logo & Slogan */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollToSection('explore-universe')}
              className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-none"
              title="LOOKING FOR STAR - Home"
            >
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-[#25D9F2] via-[#8B5CF6] to-[#E879F9] p-[1.5px] shadow-[0_0_20px_rgba(37,217,242,0.4)] group-hover:shadow-[0_0_25px_rgba(139,92,246,0.6)] transition-all">
                <div className="w-full h-full bg-[#080D1B] rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#25D9F2] group-hover:scale-110 transition-transform" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base md:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-[#25D9F2] bg-clip-text text-transparent font-sans">
                    LOOKING FOR STAR
                  </span>
                  <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-cyan-300 font-semibold hidden sm:inline-block">
                    NASA SPHEREx
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans tracking-wide">
                  Every star has a story. <span className="text-cyan-300 font-medium">Discover it.</span>
                </p>
              </div>
            </button>
          </div>

          {/* Quick Section Anchor Links (Smooth Navigation) */}
          <nav className="hidden xl:flex items-center gap-1 bg-[#142B52]/30 border border-white/10 rounded-full px-2 py-1 text-xs text-slate-300 font-medium">
            <button
              onClick={() => scrollToSection('explore-universe')}
              className="px-3 py-1 rounded-full hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              Explore the Universe
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={() => scrollToSection('time-travel')}
              className="px-3 py-1 rounded-full hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              Time Travel
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={() => scrollToSection('infrared-spectra')}
              className="px-3 py-1 rounded-full hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              Infrared Spectra
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={() => scrollToSection('gaia-validation')}
              className="px-3 py-1 rounded-full hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              Gaia Validation
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={() => scrollToSection('mission-data')}
              className="px-3 py-1 rounded-full hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              Mission Data
            </button>
          </nav>

          {/* Dual Exploration Mode Toggle & Action Badges */}
          <div className="flex items-center gap-2">
            
            {/* Beginner vs Expert Mode Switch */}
            <div className="flex items-center bg-[#142B52]/50 border border-white/15 rounded-full p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => onToggleExpertMode && onToggleExpertMode(false)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                  !isExpertMode
                    ? 'bg-gradient-to-r from-[#25D9F2] to-[#8B5CF6] text-slate-950 font-bold shadow-[0_0_12px_rgba(37,217,242,0.4)]'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Beginner Mode: Clean, intuitive guidance and friendly cards"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Beginner</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleExpertMode && onToggleExpertMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all cursor-pointer ${
                  isExpertMode
                    ? 'bg-gradient-to-r from-[#8B5CF6] to-[#E879F9] text-white font-bold shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Expert Mode: Full astrometric controls, exact coordinates & detector settings"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Expert</span>
              </button>
            </div>

            {/* Backend Connectivity Status */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono tracking-tight ${
                backendConnected
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/40 text-red-300'
              }`}
              title="FastAPI Backend Health Status (GET /health)"
            >
              <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-semibold">{backendConnected ? 'LIVE FEED' : 'OFFLINE'}</span>
            </div>

            {/* Share Link Button */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border border-white/10 hover:border-cyan-400/50 bg-white/5 hover:bg-white/10 text-slate-200 transition-all cursor-pointer active:scale-95"
              title="Share Deep Link to this Celestial Discovery"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="hidden md:inline">Share Link</span>
                </>
              )}
            </button>

            {/* Prominent Call to Action: START EXPLORING */}
            <button
              onClick={() => scrollToSection('explore-universe')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-950 bg-gradient-to-r from-[#25D9F2] via-cyan-300 to-[#8B5CF6] hover:brightness-110 transition-all shadow-[0_0_18px_rgba(37,217,242,0.5)] active:scale-95 cursor-pointer"
            >
              <Rocket className="w-3.5 h-3.5 text-slate-950" />
              <span>START EXPLORING</span>
            </button>
          </div>

        </div>

        {/* Secondary Expert Instruments Toolbar (Rendered only when Expert Mode is ON) */}
        {isExpertMode && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/10 text-xs font-mono animate-fadeIn">
            
            {/* Real-time RA / DEC Telemetry */}
            <div className="flex items-center gap-2 bg-[#0F1A34] border border-white/10 rounded-lg px-2.5 py-1">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400 font-semibold">RA:</span>
              <span className="text-cyan-300 tabular-nums">
                {typeof ra === 'number' && !isNaN(ra) ? `${ra.toFixed(5)}°` : '269.45210°'}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-slate-400 font-semibold">DEC:</span>
              <span className="text-cyan-300 tabular-nums">
                {typeof dec === 'number' && !isNaN(dec) ? `${dec > 0 ? `+${dec.toFixed(5)}` : dec.toFixed(5)}°` : '+4.69330°'}
              </span>
            </div>

            {/* Expert Controls: Survey, Detector, and Ingest */}
            <div className="flex items-center gap-2">
              
              {/* Survey Selector */}
              <div className="flex items-center gap-1 bg-[#0F1A34] border border-white/10 rounded-lg px-2 py-0.5">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <select
                  value={survey}
                  onChange={(e) => onChangeSurvey && onChangeSurvey(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="CDS/P/2MASS/color" className="bg-[#080D1B]">Survey: 2MASS (Near-IR)</option>
                  <option value="CDS/P/allWISE/color" className="bg-[#080D1B]">Survey: AllWISE (Mid-IR)</option>
                </select>
              </div>

              {/* SPHEREx Detector Band Selector */}
              <div className="flex items-center gap-1 bg-[#0F1A34] border border-white/10 rounded-lg px-2 py-0.5">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <select
                  value={detector}
                  onChange={(e) => setDetector(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-[#080D1B]">Detectors: ALL (1 to 6)</option>
                  <option value="1" className="bg-[#080D1B]">Band 1 (0.75 - 1.11 μm)</option>
                  <option value="2" className="bg-[#080D1B]">Band 2 (1.11 - 1.64 μm)</option>
                  <option value="3" className="bg-[#080D1B]">Band 3 (1.64 - 2.42 μm)</option>
                  <option value="4" className="bg-[#080D1B]">Band 4 (2.42 - 3.82 μm)</option>
                  <option value="5" className="bg-[#080D1B]">Band 5 (3.82 - 4.42 μm)</option>
                  <option value="6" className="bg-[#080D1B]">Band 6 (4.42 - 5.00 μm)</option>
                </select>
              </div>

              {/* IRSA Ingestion Trigger Modal Button */}
              <button
                type="button"
                onClick={openModal}
                disabled={isIngesting || isLocalIngesting}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 transition-all cursor-pointer disabled:opacity-50"
                title="Download customized multi-epoch FITS cubes directly from NASA IRSA"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-amber-400" />
                <span>IRSA INGEST</span>
              </button>
            </div>

          </div>
        )}
      </div>

      {/* NASA IRSA Ingestion Configuration Modal */}
      {showIngestModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-sans">
          <div className="relative w-full max-w-lg bg-[#0F1A34] border border-cyan-500/40 rounded-2xl shadow-2xl p-5 text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                  <DownloadCloud className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    NASA IRSA Ingestion Pipeline
                  </h3>
                  <p className="text-xs text-slate-400">
                    Target: <span className="text-cyan-300 font-bold">{selectedTargetId ? selectedTargetId.toUpperCase() : 'COSMIC FIELD'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isLocalIngesting && setShowIngestModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleIngestSubmit} className="space-y-4 text-xs font-sans">
              <p className="text-slate-300 text-xs leading-relaxed">
                Download calibrated multi-epoch time-domain FITS cubes directly from Caltech / NASA IPAC IRSA archive for deep temporal analysis.
              </p>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  SPHEREx Detector Band:
                </label>
                <select
                  disabled={isLocalIngesting}
                  value={detector}
                  onChange={(e) => setDetector(e.target.value)}
                  className="w-full bg-[#080D1B] border border-white/15 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                >
                  <option value="ALL">All Detectors (Bands 1 to 6)</option>
                  <option value="1">Detector 1 (0.75 - 1.11 μm - Stellar Continuum)</option>
                  <option value="2">Detector 2 (1.11 - 1.64 μm - Near-IR Photosphere)</option>
                  <option value="3">Detector 3 (1.64 - 2.42 μm - Interstellar H₂O Ice)</option>
                  <option value="4">Detector 4 (2.42 - 3.82 μm - Organics & Methane)</option>
                  <option value="5">Detector 5 (3.82 - 4.42 μm - CO & CO₂ Ice)</option>
                  <option value="6">Detector 6 (4.42 - 5.00 μm - Thermal Infrared)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Maximum Observation Epochs:
                </label>
                <select
                  disabled={isLocalIngesting}
                  value={maxEpochs}
                  onChange={(e) => setMaxEpochs(Number(e.target.value))}
                  className="w-full bg-[#080D1B] border border-white/15 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 disabled:opacity-50 font-mono"
                >
                  <option value={10}>10 Epochs (Fast Ingest)</option>
                  <option value={20}>20 Epochs (Recommended Standard)</option>
                  <option value={50}>50 Epochs (Extended Time-Series)</option>
                  <option value={100}>100 Epochs (Ultra-Deep Coverage)</option>
                </select>
              </div>

              {/* Ingestion Progress Bar */}
              {isLocalIngesting && (
                <div className="p-3 bg-[#080D1B] border border-cyan-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-cyan-300 font-medium">
                    <span className="flex items-center gap-1.5">
                      {ingestSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Ingestion Complete!</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                          <span>Streaming FITS cutouts from NASA IRSA...</span>
                        </>
                      )}
                    </span>
                    <span className="font-bold tabular-nums">{ingestProgress}%</span>
                  </div>

                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        ingestSuccess
                          ? 'bg-emerald-400 shadow-[0_0_12px_#10B981]'
                          : 'bg-gradient-to-r from-cyan-400 to-purple-500'
                      }`}
                      style={{ width: `${ingestProgress}%` }}
                    />
                  </div>

                  {remainingTime > 0 && !ingestSuccess && (
                    <p className="text-[11px] text-slate-400 text-right">
                      Estimated time: ~<span className="text-cyan-300 font-bold">{remainingTime}s</span>
                    </p>
                  )}
                </div>
              )}

              {ingestError && (
                <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-xs text-red-200">
                  {ingestError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                {!isLocalIngesting && (
                  <button
                    type="button"
                    onClick={() => setShowIngestModal(false)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-xl hover:bg-white/5 font-semibold"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLocalIngesting}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-purple-500 hover:from-cyan-300 hover:to-purple-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(37,217,242,0.4)] disabled:opacity-50 cursor-pointer"
                >
                  {isLocalIngesting ? 'Downloading...' : 'Start Ingestion'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
