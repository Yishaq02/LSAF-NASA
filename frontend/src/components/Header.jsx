import React, { useState } from 'react';
import {
  Sparkles,
  Share2,
  Check,
  SlidersHorizontal
} from 'lucide-react';

export default function Header({
  backendConnected = true,
  isExpertMode = false,
  onToggleExpertMode,
}) {
  const [copied, setCopied] = useState(false);

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

  return (
    <header className="bg-[#080D1B]/90 border-b border-white/10 sticky top-0 z-40 px-3 md:px-5 py-2.5 backdrop-blur-xl transition-colors">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        
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

        {/* Streamlined Section Anchor Links (Decluttered) */}
        <nav className="hidden lg:flex items-center gap-1 bg-[#142B52]/30 border border-white/10 rounded-full px-2 py-1 text-xs text-slate-300 font-medium">
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
        </nav>

        {/* Dual Exploration Mode Toggle & Actions */}
        <div className="flex items-center gap-2.5">
          
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
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Expert Mode: Scientific telemetry, full instrument controls, and raw data cubes"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Expert</span>
            </button>
          </div>

          {/* Backend Health Status Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
              backendConnected
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/40 border-red-500/40 text-red-300'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            <span>{backendConnected ? 'SPHEREx API Online' : 'Backend Offline'}</span>
          </div>

          {/* Share Deep-Link Button */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all cursor-pointer"
            title="Copy deep link with current target and coordinates"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-cyan-300" />
                <span className="hidden md:inline">Share</span>
              </>
            )}
          </button>
        </div>

      </div>
    </header>
  );
}
