import React, { useState } from 'react';
import { Compass, Globe, Copy, Check, Database, Layers, Sparkles, Orbit } from 'lucide-react';

export default function ActiveMetadataCard({
  targetId,
  ra,
  dec,
  targetDetails,
  manifest,
  framesCount = 0,
}) {
  const [copied, setCopied] = useState(false);

  // Decimal to HMS & DMS conversions
  const toHMS = (deg) => {
    if (deg === undefined || deg === null || isNaN(deg)) return '--';
    const hours = Math.floor(deg / 15);
    const minutes = Math.floor((deg / 15 - hours) * 60);
    const seconds = ((deg / 15 - hours) * 60 - minutes) * 60;
    return `${hours}h ${minutes}m ${seconds.toFixed(2)}s`;
  };

  const toDMS = (deg) => {
    if (deg === undefined || deg === null || isNaN(deg)) return '--';
    const sign = deg >= 0 ? '+' : '-';
    const absDeg = Math.abs(deg);
    const d = Math.floor(absDeg);
    const m = Math.floor((absDeg - d) * 60);
    const s = ((absDeg - d) * 60 - m) * 60;
    return `${sign}${d}° ${m}' ${s.toFixed(2)}"`;
  };

  const handleCopyCoords = () => {
    if (ra === undefined || dec === undefined) return;
    const text = `RA: ${ra}, DEC: ${dec}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const epochsCount = framesCount > 0
    ? framesCount
    : (Array.isArray(manifest) ? manifest.length : manifest?.epochs?.length || 0);

  return (
    <div className="relative cosmic-card p-4 md:p-5 flex flex-col gap-3 font-sans text-slate-100 shadow-2xl">
      
      {/* Module Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-[#8B5CF6]/20 to-[#E879F9]/20 border border-purple-400/30 text-purple-300">
            <Orbit className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Stellar Target Story & Telemetry</span>
            </h2>
            <p className="text-xs text-slate-400">
              Key astrophysical properties and mission observation epochs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyCoords}
          className="text-xs font-sans text-slate-300 hover:text-cyan-300 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 hover:border-cyan-400/40 transition-colors cursor-pointer"
          title="Copy celestial coordinates to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
          <span>{copied ? 'Copied' : 'Copy Coords'}</span>
        </button>
      </div>

      {/* Grid of Celestial Coordinates */}
      <div className="grid grid-cols-2 gap-3 bg-[#080D1B]/60 p-3 rounded-xl border border-white/10 text-xs font-mono">
        <div>
          <span className="text-slate-400 text-[10px] uppercase font-sans tracking-wide block mb-0.5">
            Right Ascension (RA)
          </span>
          <span className="text-cyan-300 text-sm font-bold tabular-nums">
            {typeof ra === 'number' ? `${ra.toFixed(5)}°` : '269.45210°'}
          </span>
          <span className="text-slate-500 text-[11px] block mt-0.5">
            {toHMS(typeof ra === 'number' ? ra : 269.4521)}
          </span>
        </div>

        <div>
          <span className="text-slate-400 text-[10px] uppercase font-sans tracking-wide block mb-0.5">
            Declination (DEC)
          </span>
          <span className="text-cyan-300 text-sm font-bold tabular-nums">
            {typeof dec === 'number' ? `${dec > 0 ? `+${dec.toFixed(5)}` : dec.toFixed(5)}°` : '+4.69330°'}
          </span>
          <span className="text-slate-500 text-[11px] block mt-0.5">
            {toDMS(typeof dec === 'number' ? dec : 4.6933)}
          </span>
        </div>
      </div>

      {/* Target Details and Classification */}
      <div className="space-y-2 text-xs bg-[#080D1B]/40 p-3 rounded-xl border border-white/10">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Classification:</span>
          <span className="text-white font-semibold">
            {targetDetails?.type || (targetId ? 'Featured Celestial Target' : 'Point & Click Star Field')}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Available Epochs:</span>
          <span className="text-cyan-300 font-bold tabular-nums">
            {epochsCount} Time-Series Epochs
          </span>
        </div>

        {targetDetails?.distance_ly && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Distance to Earth:</span>
            <span className="text-amber-300 font-semibold tabular-nums">
              {targetDetails.distance_ly} light-years
            </span>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-white/10 text-[11px]">
          <span className="text-slate-400">Observational Spacecraft:</span>
          <span className="text-emerald-400 font-semibold">
            NASA SPHEREx • Sun-Synchronous Polar Orbit
          </span>
        </div>
      </div>

    </div>
  );
}
