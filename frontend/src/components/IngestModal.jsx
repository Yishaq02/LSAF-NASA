import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { DownloadCloud, CheckCircle2, Loader2, X, Radio, Layers } from 'lucide-react';

export default function IngestModal({
  isOpen,
  onClose,
  targetId,
  ra,
  dec,
  onTriggerIngest,
}) {
  const [detector, setDetector] = useState('ALL');
  const [maxEpochs, setMaxEpochs] = useState(20);
  const [isLocalIngesting, setIsLocalIngesting] = useState(false);
  const [ingestProgress, setIngestProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [ingestSuccess, setIngestSuccess] = useState(false);
  const [ingestError, setIngestError] = useState(null);

  if (!isOpen) return null;

  const handleIngestSubmit = async (e) => {
    e.preventDefault();
    const tid = targetId || 'sky';

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
        setIsLocalIngesting(false);
        onClose();
      }, 1200);
    } catch (err) {
      clearInterval(progressTimer);
      setIsLocalIngesting(false);
      setIngestError(err.message || 'Error connecting to NASA IRSA');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0F1A34] border border-cyan-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 font-sans text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm md:text-base text-white tracking-tight">
                NASA IRSA Custom FITS Ingestion
              </h3>
              <p className="text-xs text-slate-400">
                Stream time-series FITS cubes directly from IPAC archives
              </p>
            </div>
          </div>
          {!isLocalIngesting && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Form */}
        <form onSubmit={handleIngestSubmit} className="space-y-4 text-xs">
          <div className="p-3 bg-[#080D1B] rounded-xl border border-white/10 space-y-1 font-mono text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Target / Mode:</span>
              <span className="text-cyan-300 font-bold uppercase">{targetId || 'FREE SKY EXPLORATION'}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Coordinates:</span>
              <span className="text-slate-200">
                RA {typeof ra === 'number' ? ra.toFixed(4) : '269.4521'}° • DEC {typeof dec === 'number' ? dec.toFixed(4) : '+4.6933'}°
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1">
              Select SPHEREx Detector Band:
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
                onClick={onClose}
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
  );
}
