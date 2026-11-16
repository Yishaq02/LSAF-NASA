import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export default function DeepLoadingOverlay({
  isLoading,
  message = 'DOWNLOADING OBSERVATIONAL CUTOUTS VIA NASA IRSA...',
  submessage = 'Streaming multi-epoch infrared telemetry to local FastAPI server on port 8000',
}) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#080D1B]/80 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none animate-fadeIn font-sans">
      <div className="cosmic-card p-6 max-w-md w-full text-center shadow-[0_0_50px_rgba(37,217,242,0.25)] border border-cyan-400/40">
        
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-14 h-14 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin"></div>
          <div className="absolute p-2.5 rounded-xl bg-[#080D1B] border border-cyan-400/40 text-cyan-300">
            <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
        </div>

        <h3 className="text-sm font-bold text-white tracking-wide uppercase mb-1">
          {message}
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          {submessage}
        </p>

        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-cyan-300 font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>NASA IRSA PIPELINE STREAMING LIVE</span>
        </div>
      </div>
    </div>
  );
}
