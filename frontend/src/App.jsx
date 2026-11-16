import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import AladinLiteMap from './components/AladinLiteMap';
import FlipbookViewer from './components/FlipbookViewer';
import SpectrumChart from './components/SpectrumChart';
import GaiaValidationPanel from './components/GaiaValidationPanel';
import IngestModal from './components/IngestModal';
import DeepLoadingOverlay from './components/DeepLoadingOverlay';
import BackendConnectionBoundary from './components/BackendConnectionBoundary';
import {
  getTargets,
  getFitsManifest,
  getSpectrum,
  exploreSky,
  ingestTarget
} from './services/api';
import {
  AlertTriangle,
  Info,
  ArrowUp,
  Sparkles,
  Orbit,
  Database,
  Radio,
  Globe,
  Copy,
  Check
} from 'lucide-react';
import {
  formatTargetName,
  formatTargetType,
  formatTargetDescription
} from './utils/astroLabels';

export default function App() {
  // Read URL query parameters on initial boot
  const parseUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      target: params.get('target') || null,
      ra: params.get('ra') ? parseFloat(params.get('ra')) : null,
      dec: params.get('dec') ? parseFloat(params.get('dec')) : null,
      mode: params.get('mode') === 'diff' ? 'diff' : 'normal',
      fps: [2, 5, 10].includes(Number(params.get('fps'))) ? Number(params.get('fps')) : 5,
      invert: params.get('invert') === 'true',
      epochA: params.get('epochA') ? parseInt(params.get('epochA'), 10) : 0,
      epochB: params.get('epochB') ? parseInt(params.get('epochB'), 10) : 1,
    };
  };

  const initialParams = parseUrlParams();

  // Default target: Barnard's Star (rich stellar field, 100% cached & functional from second 1)
  const BARNARD_RA = 269.4521;
  const BARNARD_DEC = 4.6933;

  // Dual Exploration Mode (Beginner vs Expert)
  const [isExpertMode, setIsExpertMode] = useState(false);

  // Application Core State
  const [targets, setTargets] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState(initialParams.target || 'barnard');
  const [customStarName, setCustomStarName] = useState(null);
  const [ra, setRa] = useState(initialParams.ra !== null ? initialParams.ra : BARNARD_RA);
  const [dec, setDec] = useState(initialParams.dec !== null ? initialParams.dec : BARNARD_DEC);
  const [mode, setMode] = useState(initialParams.mode);
  const [fps, setFps] = useState(initialParams.fps);
  const [invert, setInvert] = useState(initialParams.invert);
  const [epochA, setEpochA] = useState(initialParams.epochA);
  const [epochB, setEpochB] = useState(initialParams.epochB);

  // Survey state: strictly 2MASS by default with AllWISE switch
  const [survey, setSurvey] = useState('P/2MASS/color');

  // Interactive Detector Band State
  const [selectedDetector, setSelectedDetector] = useState('ALL');

  // Backend Data State
  const [manifest, setManifest] = useState(null);
  const [frames, setFrames] = useState([]); // Base64 frames from /api/explorar
  const [spectrumData, setSpectrumData] = useState(null);
  const [inspectedPixel, setInspectedPixel] = useState(null);
  const [backendConnected, setBackendConnected] = useState(true);

  // Loading States
  const [isLoadingDeep, setIsLoadingDeep] = useState(false);
  const [deepLoadingMessage, setDeepLoadingMessage] = useState('');
  const [isLoadingSky, setIsLoadingSky] = useState(false);
  const [isLoadingSpectrum, setIsLoadingSpectrum] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [noticeMessage, setNoticeMessage] = useState(null);

  // Ingestion Modal State
  const [showIngestModal, setShowIngestModal] = useState(false);

  // Intelligent Scroll-to-Top Visibility
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Target Telemetry Coordinates Copy State
  const [coordsCopied, setCoordsCopied] = useState(false);
  const handleCopyCoords = useCallback(() => {
    if (ra === undefined || dec === undefined) return;
    const text = `RA: ${ra}, DEC: ${dec}`;
    navigator.clipboard.writeText(text);
    setCoordsCopied(true);
    setTimeout(() => setCoordsCopied(false), 2000);
  }, [ra, dec]);

  // Reference for Station 2 auto-scroll
  const analysisSectionRef = useRef(null);

  // Smooth auto-scroll down to Stage 2
  const triggerAutoScrollToAnalysis = useCallback(() => {
    setTimeout(() => {
      analysisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  // Smooth scroll back up to Stage 1 (Celestial Map)
  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Flag for dynamic exploration
  const isExploringSkyRef = useRef(false);

  // VIP Target selection handler
  const handleSelectVipTarget = useCallback((tid) => {
    isExploringSkyRef.current = false;
    setCustomStarName(null);
    setFrames([]);
    setInspectedPixel(null);
    setSelectedTargetId(tid || null);
    if (tid) {
      triggerAutoScrollToAnalysis();
    }
  }, [triggerAutoScrollToAnalysis]);

  // 1. Synchronize URLSearchParams on state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedTargetId) params.set('target', selectedTargetId);
    if (ra !== null && ra !== undefined && !isNaN(ra)) params.set('ra', ra.toFixed(6));
    if (dec !== null && dec !== undefined && !isNaN(dec)) params.set('dec', dec.toFixed(6));
    if (mode) params.set('mode', mode);
    if (fps) params.set('fps', String(fps));
    if (invert) params.set('invert', 'true');
    if (epochA !== undefined) params.set('epochA', String(epochA));
    if (epochB !== undefined) params.set('epochB', String(epochB));

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [selectedTargetId, ra, dec, mode, fps, invert, epochA, epochB]);

  // 2. Load VIP Targets Catalog from backend on mount
  useEffect(() => {
    let isMounted = true;
    async function loadCatalog() {
      try {
        const data = await getTargets();
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : data.targets || [];
        setTargets(list);

        const initialTargetKey = initialParams.target || 'barnard';
        const matched = list.find(t => (t.id || t.tid || t.target_id) === initialTargetKey);
        if (matched && matched.ra !== undefined && matched.dec !== undefined) {
          setRa(matched.ra);
          setDec(matched.dec);
          setSelectedTargetId(initialTargetKey);
        } else {
          setRa(BARNARD_RA);
          setDec(BARNARD_DEC);
          setSelectedTargetId('barnard');
        }
      } catch (err) {
        console.error('Error fetching VIP targets catalog:', err);
        setErrorMessage(err.message || 'Error loading featured targets catalog');
      }
    }

    loadCatalog();
    return () => { isMounted = false; };
  }, []);

  // 3. Load Target Data when VIP Target changes (or on boot)
  useEffect(() => {
    if (!selectedTargetId) return;

    const isVip = targets.some(t => (t.id || t.tid || t.target_id) === selectedTargetId) || selectedTargetId === 'barnard';
    if (!isVip) return;

    let isMounted = true;
    const targetObj = targets.find(t => (t.id || t.tid || t.target_id) === selectedTargetId);
    if (targetObj && targetObj.ra !== undefined && targetObj.dec !== undefined) {
      setRa(targetObj.ra);
      setDec(targetObj.dec);
    }

    setFrames([]);
    setInspectedPixel(null);
    setIsLoadingSky(false);
    setIsLoadingDeep(false);
    setIsLoadingSpectrum(true);

    getFitsManifest(selectedTargetId)
      .then((man) => {
        if (!isMounted) return;
        setManifest(man);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn(`Manifest for ${selectedTargetId} warning:`, err);
        setManifest(null);
      });

    getSpectrum(selectedTargetId, {
      index: 0,
      ra: targetObj?.ra || ra || undefined,
      dec: targetObj?.dec || dec || undefined
    })
      .then((spec) => {
        if (!isMounted) return;
        setSpectrumData(spec);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn(`Spectrum for ${selectedTargetId} error:`, err);
        setSpectrumData(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSpectrum(false);
      });

    return () => { isMounted = false; };
  }, [selectedTargetId, targets]);

  // 4. Handle Free Sky Click in Aladin Lite
  const handleFreeSkyClick = useCallback(async (clickedRa, clickedDec, starName = null) => {
    triggerAutoScrollToAnalysis();
    isExploringSkyRef.current = true;
    setSelectedTargetId(null);
    setCustomStarName(starName || null);
    setRa(clickedRa);
    setDec(clickedDec);
    setInspectedPixel(null);
    setIsLoadingSky(true);
    setIsLoadingDeep(true);
    setDeepLoadingMessage('QUERYING NASA IRSA ARCHIVE // REAL-TIME FITS CUTOUTS');

    try {
      const result = await exploreSky({
        ra: clickedRa,
        dec: clickedDec,
        target_id: null,
        mode: mode,
      });

      if (result) {
        const receivedFrames = Array.isArray(result.frames) ? result.frames : [];
        if (receivedFrames.length > 0) {
          setFrames(receivedFrames);
        }

        const foundId = result.metadata?.id || result.metadata?.target_id;
        if (foundId) {
          setSelectedTargetId(foundId);
        }

        if (result.spectrum_102) {
          setSpectrumData(result);
        } else if (result.spectrum) {
          setSpectrumData(result);
        }

        const meta = result.metadata ? { ...result.metadata } : {};
        if (!meta.epochs && receivedFrames.length > 0) {
          meta.epochs = receivedFrames.map((f, i) => ({
            index: i,
            image_url: f,
            png_url: f,
          }));
        }
        setManifest(meta);
      }
    } catch (err) {
      console.warn('Dynamic exploration info:', err);
      if (err.status === 404 || err.message?.includes('404') || err.message?.includes('IRSA no devolvio')) {
        setNoticeMessage(`Scientific Advisory: NASA IRSA did not return observation cutouts for RA ${clickedRa.toFixed(4)}°, DEC ${clickedDec.toFixed(4)}°. Try selecting from the verified sky sectors or featured stars.`);
        setTimeout(() => setNoticeMessage(null), 8000);
      } else {
        setErrorMessage(err.message || 'Error in dynamic celestial sky exploration');
      }
    } finally {
      setIsLoadingSky(false);
      setIsLoadingDeep(false);
      setTimeout(() => {
        isExploringSkyRef.current = false;
      }, 200);
    }
  }, [mode, triggerAutoScrollToAnalysis]);

  // 5. Handle Pixel Click on Flipbook Image
  const handlePixelClick = useCallback(async ({ x, y, index }) => {
    setInspectedPixel({ x, y });
    setIsLoadingSpectrum(true);

    try {
      const currentTid = selectedTargetId || 'sky';
      const spec = await getSpectrum(currentTid, {
        x,
        y,
        index,
        ra: ra || undefined,
        dec: dec || undefined
      });
      setSpectrumData(spec);
    } catch (err) {
      console.error('Error fetching pixel spectrum:', err);
    } finally {
      setIsLoadingSpectrum(false);
    }
  }, [selectedTargetId, ra, dec]);

  // 6. Handle Ingestion Trigger (POST /ingest/{tid})
  const handleTriggerIngest = async (tid, params = { detector: 'ALL', max_epocas: 20 }) => {
    const targetKey = tid || 'sky';
    setIsIngesting(true);
    setIsLoadingDeep(true);
    setDeepLoadingMessage(`DOWNLOADING TIME-DOMAIN OBSERVATIONS FOR ${targetKey.toUpperCase()}...`);

    try {
      const ingestRes = await ingestTarget(targetKey, {
        ...params,
        ra: ra || params.ra,
        dec: dec || params.dec,
      });

      const effectiveTid = (ingestRes && ingestRes.target) ? ingestRes.target : targetKey;
      try {
        const newManifest = await getFitsManifest(effectiveTid);
        setManifest(newManifest);
      } catch (e) {
        console.warn('Could not reload manifest:', e);
      }

      try {
        const newSpectrum = await getSpectrum(effectiveTid, {
          index: 0,
          ra: ra || params.ra,
          dec: dec || params.dec,
        });
        setSpectrumData(newSpectrum);
      } catch (e) {
        console.warn('Could not reload spectrum:', e);
      }

      if (!selectedTargetId && typeof ra === 'number' && typeof dec === 'number') {
        const exploreRes = await exploreSky({
          ra,
          dec,
          target_id: null,
          mode,
        });
        if (exploreRes?.frames?.length > 0) {
          setFrames(exploreRes.frames);
        }
      }
    } catch (err) {
      console.error('Ingest error:', err);
      setErrorMessage(err.message || `Error processing ingestion for ${targetKey}`);
    } finally {
      setIsIngesting(false);
      setIsLoadingDeep(false);
    }
  };

  const activeTargetObj = targets.find(t => (t.id || t.tid || t.target_id) === selectedTargetId) || (customStarName ? {
    id: customStarName,
    name: customStarName,
    type: 'SIMBAD Astronomical Star',
    ra,
    dec,
    description: `Real astronomical object identified in SIMBAD catalog at RA ${ra?.toFixed(4)}°, DEC ${dec?.toFixed(4)}°. Cross-checked with NASA IRSA time-domain observations.`
  } : null);

  return (
    <BackendConnectionBoundary>
      <div className="min-h-screen bg-[#080D1B] text-slate-100 flex flex-col font-sans selection:bg-cyan-400 selection:text-slate-950">

        {/* Modern Top Header (Decluttered) */}
        <Header
          backendConnected={backendConnected}
          isExpertMode={isExpertMode}
          onToggleExpertMode={setIsExpertMode}
        />

        {/* Advisory notification banner in English */}
        {noticeMessage && (
          <div className="bg-[#142B52]/90 border-y border-amber-500/60 text-amber-200 px-4 py-2.5 text-xs flex items-center justify-between font-sans animate-fadeIn shadow-lg">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{noticeMessage}</span>
            </span>
            <button
              onClick={() => setNoticeMessage(null)}
              className="text-amber-300 hover:text-white font-bold ml-4 border border-amber-500/40 px-2.5 py-0.5 text-xs rounded-lg hover:bg-amber-900/50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error notification banner in English */}
        {errorMessage && (
          <div className="bg-[#142B52]/90 border-y border-red-500/60 text-red-200 px-4 py-2.5 text-xs flex items-center justify-between font-sans shadow-lg">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>[SPHEREx Engine Notice]: {errorMessage}</span>
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-300 hover:text-white font-bold ml-4 border border-red-500/40 px-2.5 py-0.5 text-xs rounded-lg hover:bg-red-900/50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main 2-Stage Interactive Layout */}
        <main className="flex-1 p-3 md:p-6 max-w-[1920px] mx-auto w-full space-y-8">

          {/* STAGE 1: Full Viewport 1 — Explore the Universe */}
          <section id="explore-universe" className="min-h-[calc(100vh-80px)] flex flex-col justify-between space-y-4">
            
            {/* Aladin Lite v3 Celestial Horizon Card */}
            <div className="flex-1 w-full flex flex-col">
              <AladinLiteMap
                ra={ra}
                dec={dec}
                survey={survey}
                onChangeSurvey={setSurvey}
                targets={targets}
                activeTarget={activeTargetObj}
                onSelectTarget={handleSelectVipTarget}
                onFreeSkyClick={handleFreeSkyClick}
                onTriggerIngest={handleTriggerIngest}
                onOpenIngestModal={() => setShowIngestModal(true)}
                isIngesting={isIngesting}
                isLoadingSky={isLoadingSky}
                onAutoScroll={triggerAutoScrollToAnalysis}
                isExpertMode={isExpertMode}
              />
            </div>
          </section>

          {/* STAGE 2: Full Viewport 2 — Time Travel & Infrared Laboratory */}
          <section
            ref={analysisSectionRef}
            id="time-travel"
            className="min-h-screen pt-6 flex flex-col gap-5 border-t border-white/10"
          >
            {/* Stage Navigation Header */}
            <div className="flex items-center justify-between bg-[#142B52]/40 border border-white/10 rounded-2xl px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold text-white tracking-wide">
                  Stage 2: Time-Domain & Spectroscopic Laboratory
                </span>
                <span className="text-xs text-cyan-300 bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full font-medium">
                  {customStarName
                    ? `Target: ${customStarName.toUpperCase()}`
                    : selectedTargetId
                      ? `Target: ${formatTargetName(activeTargetObj?.name || activeTargetObj?.nombre, selectedTargetId).toUpperCase()}`
                      : `Sky: RA ${ra?.toFixed(4)}° DEC ${dec?.toFixed(4)}°`}
                </span>
              </div>

              <button
                type="button"
                onClick={handleScrollToTop}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-cyan-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Back to Sky Map</span>
              </button>
            </div>

            {/* Target Telemetry Strip (Merged from redundant card) */}
            <div className="bg-[#080D1B]/90 border border-white/10 rounded-2xl p-3 md:px-5 md:py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-sans shadow-lg">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{customStarName || formatTargetName(activeTargetObj?.name || activeTargetObj?.nombre, selectedTargetId)}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-semibold">
                  {customStarName ? 'SIMBAD Star (Real Astronomical Object)' : formatTargetType(activeTargetObj?.type, selectedTargetId)}
                </span>
                {activeTargetObj?.distance_ly && (
                  <span className="text-[11px] text-amber-300 font-mono hidden sm:inline">
                    • {activeTargetObj.distance_ly} light-years
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3.5 text-xs font-mono text-slate-300">
                <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                  <span className="text-slate-400 font-sans text-[11px]">RA:</span>
                  <span className="text-cyan-300 font-bold">{typeof ra === 'number' ? `${ra.toFixed(4)}°` : '--'}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                  <span className="text-slate-400 font-sans text-[11px]">DEC:</span>
                  <span className="text-cyan-300 font-bold">{typeof dec === 'number' ? `${dec > 0 ? `+${dec.toFixed(4)}` : dec.toFixed(4)}°` : '--'}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hidden md:flex">
                  <span className="text-slate-400 font-sans text-[11px]">Epochs:</span>
                  <span className="text-purple-300 font-bold">{frames.length > 0 ? frames.length : (Array.isArray(manifest) ? manifest.length : manifest?.epochs?.length || 0)} FITS</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCoords}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 text-slate-300 text-[11px] font-sans transition-colors cursor-pointer active:scale-95"
                  title="Copy celestial coordinates to clipboard"
                >
                  {coordsCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{coordsCopied ? 'Copied' : 'Copy Coords'}</span>
                </button>
              </div>
            </div>

            {/* 2 Analytical Columns (50% / 50% Desktop Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">

              {/* LEFT COLUMN: Time Travel (Flipbook & Motion Detector) */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                <FlipbookViewer
                  targetId={customStarName || selectedTargetId}
                  ra={ra}
                  dec={dec}
                  manifest={manifest}
                  frames={frames}
                  mode={mode}
                  onChangeMode={setMode}
                  fps={fps}
                  onChangeFps={setFps}
                  invert={invert}
                  onChangeInvert={setInvert}
                  epochA={epochA}
                  onChangeEpochA={setEpochA}
                  epochB={epochB}
                  onChangeEpochB={setEpochB}
                  onPixelClick={handlePixelClick}
                  onTriggerIngest={handleTriggerIngest}
                  onOpenIngestModal={() => setShowIngestModal(true)}
                  isIngesting={isIngesting}
                  isLoadingSky={isLoadingSky}
                  isExpertMode={isExpertMode}
                />
              </div>

              {/* RIGHT COLUMN: Infrared Spectroscopy & Gaia Astrometry */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                {/* 102-Band Infrared Spectrometer */}
                <div id="infrared-spectra">
                  <SpectrumChart
                    spectrumData={spectrumData}
                    targetId={customStarName || selectedTargetId}
                    ra={ra}
                    dec={dec}
                    inspectedPixel={inspectedPixel}
                    isLoading={isLoadingSpectrum}
                    selectedDetector={selectedDetector}
                    onSelectDetector={setSelectedDetector}
                    isExpertMode={isExpertMode}
                  />
                </div>

                {/* Full-width Gaia DR3 Validation Panel */}
                <div id="gaia-validation" className="w-full">
                  <GaiaValidationPanel
                    targetId={customStarName || selectedTargetId}
                    ra={ra}
                    dec={dec}
                    isExpertMode={isExpertMode}
                  />
                </div>
              </div>

            </div>

          </section>

          {/* STAGE 3: Mission Data — Powered by Open Science */}
          <section id="mission-data" className="pt-8 border-t border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
                Mission Data — Powered by Open Science
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              LOOKING FOR STAR connects directly to open data repositories, space telescopes, and all-sky surveys. Every frame, spectrum, and coordinate represents genuine astrophysical measurements.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              
              <div className="cosmic-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>NASA SPHEREx</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  NASA MIDEX all-sky spectral survey observing 102 distinct infrared bands (0.75 - 5.00 μm) to unlock cosmic origins, water ice, and planet formation.
                </p>
              </div>

              <div className="cosmic-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <span>NASA / IPAC IRSA</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Infrared Science Archive at Caltech/IPAC delivering time-domain FITS cutouts, photometric points, and astrometric calibration.
                </p>
              </div>

              <div className="cosmic-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>ESA Gaia DR3</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  European Space Agency astrometry catalogue measuring precise positions, distances, and proper motions for over 1.8 billion stars in the Milky Way.
                </p>
              </div>

              <div className="cosmic-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                  <Orbit className="w-4 h-4 text-purple-400" />
                  <span>2MASS & AllWISE</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Two Micron All Sky Survey (Near-IR J, H, Ks) and Wide-field Infrared Survey Explorer (Mid-IR W1-W4) providing deep baseline color textures.
                </p>
              </div>

            </div>
          </section>

        </main>

        {/* Floating Quick Action Button: Return to Celestial Map (Intelligently hidden at top) */}
        {showScrollTop && (
          <button
            type="button"
            onClick={handleScrollToTop}
            className="fixed bottom-12 right-6 z-40 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-purple-400 hover:brightness-110 shadow-[0_0_20px_rgba(37,217,242,0.5)] transition-all active:scale-95 cursor-pointer animate-fadeIn"
            title="Return to Celestial Map"
          >
            <ArrowUp className="w-4 h-4 text-slate-950" />
            <span>Back to Sky Map</span>
          </button>
        )}

        {/* IRSA Custom Ingestion Modal */}
        <IngestModal
          isOpen={showIngestModal}
          onClose={() => setShowIngestModal(false)}
          targetId={selectedTargetId}
          ra={ra}
          dec={dec}
          onTriggerIngest={handleTriggerIngest}
        />

        {/* Global Footer */}
        <footer className="bg-[#080D1B]/95 border-t border-white/10 py-4 px-6 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold tracking-tight">
              LOOKING FOR STAR
            </span>
            <span className="text-white/20">|</span>
            <span>Every star has a story. Discover it.</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <span>NASA Space Apps Challenge 2026</span>
            <span className="text-white/20">•</span>
            <span className="text-emerald-400 font-semibold">Engine: Nominal</span>
          </div>
        </footer>

      </div>
    </BackendConnectionBoundary>
  );
}
