import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  CheckCircle2,
  Sparkles,
  Radio,
  Crosshair,
  Loader2,
  RefreshCw,
  Flame,
  Info
} from 'lucide-react';
import { checkGaia } from '../services/api';

export default function GaiaValidationPanel({
  targetId,
  ra,
  dec,
  isExpertMode = false,
}) {
  const [radius, setRadius] = useState(5.0); // arcseconds
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Auto-query Gaia DR3 on target or coordinates changes
  useEffect(() => {
    setResult(null);
    setError(null);

    if (!targetId && (ra === undefined || ra === null || isNaN(ra))) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const data = await checkGaia({
          target: targetId || undefined,
          ra: typeof ra === 'number' && !isNaN(ra) ? ra : undefined,
          dec: typeof dec === 'number' && !isNaN(dec) ? dec : undefined,
          radius,
        });
        if (isMounted) {
          setResult(data);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Auto Gaia check error:', err);
          setError(err.message || 'Error querying ESA Gaia DR3');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [targetId, ra, dec, radius]);

  const handleRunGaiaCheck = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await checkGaia({
        target: targetId || undefined,
        ra: typeof ra === 'number' && !isNaN(ra) ? ra : undefined,
        dec: typeof dec === 'number' && !isNaN(dec) ? dec : undefined,
        radius,
      });
      setResult(data);
    } catch (err) {
      console.error('Gaia check error:', err);
      setError(err.message || 'Error querying ESA Gaia DR3');
    } finally {
      setIsLoading(false);
    }
  };

  const isMatched = result && (
    result.matched === true ||
    (result.count && result.count > 0) ||
    result.gaia_id ||
    (result.sources && result.sources.length > 0)
  );

  const gaiaSource = result?.sources?.[0] || result || {};
  const gaiaId = result?.gaia_id || gaiaSource.SOURCE_ID || gaiaSource.source_id || gaiaSource.designation;
  const pmra = result?.pmra ?? gaiaSource.pmra;
  const pmdec = result?.pmdec ?? gaiaSource.pmdec;
  const parallax = result?.parallax ?? gaiaSource.parallax;
  const photG = result?.phot_g_mean_mag ?? gaiaSource.phot_g_mean_mag;

  return (
    <div className="relative cosmic-card p-4 md:p-5 flex flex-col gap-3 font-sans text-slate-100 shadow-2xl">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-[#10B981]/20 to-[#25D9F2]/20 border border-emerald-400/30 text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Gaia DR3 Validation: Verify Your Discovery</span>
            </h2>
            <p className="text-xs text-slate-400">
              Cross-references target position against ESA Gaia DR3 astrometry (1.8B+ stars).
            </p>
          </div>
        </div>

        {/* Action Button & Search Radius */}
        <div className="flex items-center gap-2">
          {isExpertMode && (
            <div className="flex items-center gap-1 bg-[#0F1A34] px-2.5 py-1 rounded-xl border border-white/10 text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase">Cone:</span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="30"
                value={radius}
                onChange={(e) => setRadius(parseFloat(e.target.value) || 5.0)}
                className="w-10 bg-transparent text-cyan-300 font-bold text-right focus:outline-none tabular-nums"
              />
              <span className="text-[10px] text-slate-500">arcsec</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleRunGaiaCheck}
            disabled={isLoading || (ra === undefined && !targetId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 font-semibold text-xs transition-all cursor-pointer disabled:opacity-40"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>{isLoading ? 'Querying...' : 'Verify in Gaia'}</span>
          </button>
        </div>
      </div>

      {/* STATE 1: Validation Pending */}
      {isLoading && (
        <div className="p-4 rounded-xl bg-[#0F1A34]/50 border border-cyan-500/30 flex items-center gap-3 text-xs text-slate-300 animate-pulse">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
          <div>
            <p className="font-bold text-white">Validation Pending...</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Querying European Space Agency (ESA) Gaia DR3 TAP catalogue for astrometric cross-matches.
            </p>
          </div>
        </div>
      )}

      {/* STATE 2: Connection Error */}
      {error && !isLoading && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-start justify-between gap-3 font-sans">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-300">Connection Error</p>
              <p className="text-[11px] text-red-200/80 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRunGaiaCheck}
            className="px-2.5 py-1 rounded-lg bg-red-900/60 hover:bg-red-900 border border-red-700 text-[11px] text-white shrink-0 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* RESULT CARDS */}
      {result && !isLoading && !error && (
        <div>
          {isMatched ? (
            /* STATE 3: Confirmed Star in Gaia DR3 */
            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/50 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400 flex items-center gap-1.5 tracking-tight">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Confirmed Star in Gaia DR3
                </span>
                <span className="text-[10px] font-mono bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700 text-emerald-300 font-semibold">
                  MATCH VERIFIED
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Optical counterpart located within the search radius. Astrometric motion and parallax confirm this target in the ESA Gaia catalogue.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums pt-2 border-t border-emerald-900/40">
                {gaiaId && (
                  <div className="col-span-2 bg-[#080D1B]/50 p-2 rounded-lg border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-sans block mb-0.5">Gaia DR3 Source ID:</span>
                    <span className="text-cyan-300 select-all font-bold break-all">{gaiaId}</span>
                  </div>
                )}
                {pmra !== undefined && (
                  <div className="bg-[#080D1B]/50 p-2 rounded-lg border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-sans block mb-0.5">Proper Motion RA:</span>
                    <span className="text-white font-semibold">{Number(pmra).toFixed(2)} mas/yr</span>
                  </div>
                )}
                {pmdec !== undefined && (
                  <div className="bg-[#080D1B]/50 p-2 rounded-lg border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-sans block mb-0.5">Proper Motion DEC:</span>
                    <span className="text-white font-semibold">{Number(pmdec).toFixed(2)} mas/yr</span>
                  </div>
                )}
                {parallax !== undefined && (
                  <div className="bg-[#080D1B]/50 p-2 rounded-lg border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-sans block mb-0.5">Parallax (Distance):</span>
                    <span className="text-white font-semibold">{Number(parallax).toFixed(2)} mas</span>
                  </div>
                )}
                {photG !== undefined && (
                  <div className="bg-[#080D1B]/50 p-2 rounded-lg border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-sans block mb-0.5">Gaia G-Magnitude:</span>
                    <span className="text-white font-semibold">{Number(photG).toFixed(2)} mag</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* STATE 4: No Optical Match Found in Gaia DR3 (Brown Dwarf / Planet X Candidate) */
            <div className="p-4 rounded-xl bg-gradient-to-tr from-amber-950/40 via-purple-950/30 to-[#142B52]/40 border border-amber-400/60 space-y-2 shadow-[0_0_20px_rgba(255,180,94,0.15)]">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <span>No Optical Match Found in Gaia DR3 — Infrared Only Anomaly!</span>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                No optical source exists in Gaia DR3 within the {radius}&quot; search radius. Because SPHEREx detects infrared emission here while visible telescopes see nothing, this object is a prime candidate for an <strong>ultra-cool sub-stellar body</strong>, a <strong>cold brown dwarf (Y-class)</strong>, or a <strong>distant Solar System planetoid</strong>.
              </p>

              <div className="pt-2 border-t border-amber-500/30 flex items-center justify-between text-[11px] font-mono text-amber-300">
                <span>Astronomical Anomaly Detected</span>
                <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 font-bold uppercase text-[10px]">
                  Infrared Cold Body
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !isLoading && !error && (
        <div className="p-3 rounded-xl bg-[#0F1A34]/30 border border-white/5 text-xs text-slate-400">
          Target ready. Click &quot;Verify in Gaia&quot; or select a star to inspect optical catalog confirmation.
        </div>
      )}

    </div>
  );
}
