import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Activity, Radio, BarChart2, Layers, Sparkles, Info } from 'lucide-react';
import { formatTargetName } from '../utils/astroLabels';

// SPHEREx Physical Detector Band Mapping (102 channels in 6 arrays of 17 channels each)
export const SPHEREX_BANDS = [
  {
    id: '1',
    key: 'B1 Near-IR',
    name: 'Band 1',
    minCh: 1,
    maxCh: 17,
    minWl: 0.75,
    maxWl: 1.11,
    color: '#25D9F2',
    label: 'B1 Near-IR (0.75-1.11 μm)',
    description: 'Near-IR Stellar Continuum (0.75 - 1.11 μm)',
  },
  {
    id: '2',
    key: 'B2 Continuum',
    name: 'Band 2',
    minCh: 18,
    maxCh: 34,
    minWl: 1.11,
    maxWl: 1.64,
    color: '#3B82F6',
    label: 'B2 Continuum (1.11-1.64 μm)',
    description: 'Stellar Photosphere Continuum (1.11 - 1.64 μm)',
  },
  {
    id: '3',
    key: 'B3 H₂O Ice',
    name: 'Band 3',
    minCh: 35,
    maxCh: 51,
    minWl: 1.64,
    maxWl: 2.42,
    color: '#8B5CF6',
    label: 'B3 H₂O Ice (1.64-2.42 μm)',
    description: 'Interstellar Water Ice (1.64 - 2.42 μm)',
  },
  {
    id: '4',
    key: 'B4 CH₄ / Organics',
    name: 'Band 4',
    minCh: 52,
    maxCh: 68,
    minWl: 2.42,
    maxWl: 3.82,
    color: '#E879F9',
    label: 'B4 CH₄ / Organics (2.42-3.82 μm)',
    description: 'Prebiotic Organics & Methane (2.42 - 3.82 μm)',
  },
  {
    id: '5',
    key: 'B5 CO₂ Ice',
    name: 'Band 5',
    minCh: 69,
    maxCh: 85,
    minWl: 3.82,
    maxWl: 4.42,
    color: '#F97316',
    label: 'B5 CO₂ Ice (3.82-4.42 μm)',
    description: 'Solid Carbon Dioxide Ice (3.82 - 4.42 μm)',
  },
  {
    id: '6',
    key: 'B6 Thermal / Planet X',
    name: 'Band 6',
    minCh: 86,
    maxCh: 102,
    minWl: 4.42,
    maxWl: 5.00,
    color: '#FFB45E',
    label: 'B6 Thermal / Planet X (4.42-5.00 μm)',
    description: 'Cold Bodies & Thermal Infrared (4.42 - 5.00 μm)',
  },
];

export default function SpectrumChart({
  spectrumData = null,
  targetId,
  ra,
  dec,
  inspectedPixel = null,
  isLoading = false,
  selectedDetector = 'ALL',
  onSelectDetector,
  isExpertMode = false,
}) {
  // Extract raw 102 channels array from various API response shapes
  const rawChannels = useMemo(() => {
    if (!spectrumData) return null;
    if (Array.isArray(spectrumData)) return spectrumData;
    if (Array.isArray(spectrumData.spectrum_102)) return spectrumData.spectrum_102;
    if (Array.isArray(spectrumData.spectrum)) return spectrumData.spectrum;
    if (Array.isArray(spectrumData.flux)) return spectrumData.flux;
    if (Array.isArray(spectrumData.flujos)) return spectrumData.flujos;
    if (Array.isArray(spectrumData.data)) return spectrumData.data;
    return null;
  }, [spectrumData]);

  // Transform into points with calculated physical wavelengths and band assignments
  const allChartPoints = useMemo(() => {
    if (!rawChannels || rawChannels.length === 0) return [];

    const wavelengths = Array.isArray(spectrumData?.wavelengths_um)
      ? spectrumData.wavelengths_um
      : (Array.isArray(spectrumData?.wavelengths) ? spectrumData.wavelengths : null);

    const totalChannels = rawChannels.length;
    const minWavelength = 0.75;
    const maxWavelength = 5.00;

    return rawChannels.map((fluxVal, index) => {
      const channelNum = index + 1;

      let wavelength = wavelengths && wavelengths[index] !== undefined
        ? Number(wavelengths[index])
        : minWavelength + ((maxWavelength - minWavelength) * index) / Math.max(1, totalChannels - 1);

      wavelength = Math.round(wavelength * 1000) / 1000;

      const bandObj = SPHEREX_BANDS.find(
        (b) => channelNum >= b.minCh && channelNum <= b.maxCh
      ) || SPHEREX_BANDS[0];

      return {
        channel: channelNum,
        wavelength,
        flux: typeof fluxVal === 'number' && !isNaN(fluxVal) ? Math.max(0, fluxVal) : 0,
        bandId: bandObj.id,
        bandKey: bandObj.key,
        bandColor: bandObj.color,
        description: bandObj.description,
      };
    });
  }, [rawChannels, spectrumData]);

  // Active filter for single detector or ALL 102 channels
  const filteredPoints = useMemo(() => {
    if (!selectedDetector || selectedDetector === 'ALL') {
      return allChartPoints;
    }
    return allChartPoints.filter((pt) => String(pt.bandId) === String(selectedDetector));
  }, [allChartPoints, selectedDetector]);

  const activeBandInfo = useMemo(() => {
    if (!selectedDetector || selectedDetector === 'ALL') return null;
    return SPHEREX_BANDS.find((b) => b.id === String(selectedDetector));
  }, [selectedDetector]);

  return (
    <div className="relative cosmic-card p-4 md:p-5 flex flex-col gap-4 font-sans text-slate-100 shadow-2xl">
      
      {/* Module Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-[#25D9F2]/20 to-[#8B5CF6]/20 border border-cyan-400/30 text-cyan-300">
            <BarChart2 className="w-4 h-4 text-[#25D9F2]" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Infrared Spectroscopy: Discover What Light Reveals</span>
              {targetId && (
                <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-semibold truncate max-w-[200px]" title={targetId}>
                  Target: {formatTargetName(targetId).toUpperCase()}
                </span>
              )}
              <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-semibold">
                102 Channels (0.75 - 5.00 μm)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Every object interacts with infrared light differently. Its spectrum helps scientists understand what it is made of.
            </p>
          </div>
        </div>

        {/* Pixel Readout Status */}
        {inspectedPixel && (
          <div className="flex items-center gap-2 bg-[#0F1A34] border border-cyan-500/40 rounded-xl px-2.5 py-1 text-xs font-mono text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Target Pixel ({inspectedPixel.x}, {inspectedPixel.y})</span>
          </div>
        )}
      </div>

      {/* 6-Band Selector Buttons (B1 to B6 + ALL) — Pillar 2: 102-Band Chemical Fingerprinting */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {/* ALL Channels Button */}
        <button
          type="button"
          onClick={() => onSelectDetector && onSelectDetector('ALL')}
          className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            selectedDetector === 'ALL'
              ? 'bg-gradient-to-r from-cyan-400 via-purple-500 to-amber-400 text-slate-950 shadow-[0_0_15px_rgba(37,217,242,0.4)]'
              : 'bg-white/5 border border-white/10 hover:border-white/25 text-slate-300 hover:text-white'
          }`}
        >
          ALL (102 Ch)
        </button>

        {/* Individual Band Buttons */}
        {SPHEREX_BANDS.map((band) => {
          const isSelected = selectedDetector === band.id;

          return (
            <button
              key={band.id}
              type="button"
              onClick={() => onSelectDetector && onSelectDetector(band.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10.5px] font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                isSelected
                  ? 'border font-bold text-white shadow-lg'
                  : 'bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white'
              }`}
              style={{
                borderColor: isSelected ? band.color : undefined,
                backgroundColor: isSelected ? `${band.color}25` : undefined,
                boxShadow: isSelected ? `0 0 12px ${band.color}40` : undefined,
              }}
              title={band.description}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: band.color }}
              />
              <span>{band.key}</span>
            </button>
          );
        })}
      </div>

      {/* Active Band Educational Description Banner */}
      {activeBandInfo && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#0F1A34]/60 border border-white/10 text-xs text-slate-300 animate-fadeIn">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-white">{activeBandInfo.key} ({activeBandInfo.minWl} - {activeBandInfo.maxWl} μm):</strong>{' '}
            {activeBandInfo.description}. Channels {activeBandInfo.minCh} to {activeBandInfo.maxCh}.
          </span>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="relative w-full h-64 md:h-72 bg-black/40 rounded-2xl border border-white/10 p-2 overflow-hidden shadow-inner">
        
        {isLoading && (
          <div className="absolute inset-0 bg-[#080D1B]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-cyan-300 font-semibold tracking-wider">
              EXTRACTING 102-BAND SPECTROMETRIC CUBE...
            </p>
          </div>
        )}

        {filteredPoints.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredPoints} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                {/* Dynamic Multi-Color Gradient for ALL 102 channels */}
                <linearGradient id="spectrumGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#25D9F2" />
                  <stop offset="20%" stopColor="#3B82F6" />
                  <stop offset="40%" stopColor="#8B5CF6" />
                  <stop offset="60%" stopColor="#E879F9" />
                  <stop offset="80%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#FFB45E" />
                </linearGradient>

                {/* Single Band Gradients */}
                {SPHEREX_BANDS.map((b) => (
                  <linearGradient key={`grad-${b.id}`} id={`grad-${b.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={b.color} stopOpacity={0.6} />
                    <stop offset="95%" stopColor={b.color} stopOpacity={0.0} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />

              <XAxis
                dataKey="wavelength"
                stroke="#64748B"
                fontSize={10}
                tickFormatter={(val) => `${val.toFixed(2)}μm`}
                tickLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={10}
                tickFormatter={(val) => Number(val).toFixed(2)}
                tickLine={false}
              />

              {/* Band Separation Lines when in ALL mode */}
              {selectedDetector === 'ALL' && [1.11, 1.64, 2.42, 3.82, 4.42].map((borderWl) => (
                <ReferenceLine
                  key={borderWl}
                  x={borderWl}
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeDasharray="2 2"
                />
              ))}

              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[#080D1B]/95 border border-cyan-400/40 rounded-xl p-3 shadow-2xl text-xs font-sans space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-white border-b border-white/10 pb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.bandColor }} />
                        <span>Channel {data.channel} of 102</span>
                        <span className="text-cyan-300 font-mono">({data.wavelength} μm)</span>
                      </div>
                      <div className="flex justify-between text-slate-300 font-mono">
                        <span className="text-slate-400">Flux:</span>
                        <span className="text-cyan-300 font-bold">{data.flux.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-400">Band:</span>
                        <span className="text-white font-medium">{data.bandKey}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-white/10">
                        {data.description}
                      </div>
                    </div>
                  );
                }}
              />

              <Area
                type="monotone"
                dataKey="flux"
                stroke={activeBandInfo ? activeBandInfo.color : 'url(#spectrumGradient)'}
                strokeWidth={2.5}
                fill={activeBandInfo ? `url(#grad-${activeBandInfo.id})` : 'url(#spectrumGradient)'}
                fillOpacity={0.25}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <Radio className="w-8 h-8 text-slate-600 mb-2" />
            <p>No spectral data loaded for current celestial target.</p>
          </div>
        )}

      </div>

    </div>
  );
}
