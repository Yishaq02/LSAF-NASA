import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import AladinLiteMap from './components/AladinLiteMap';
import FlipbookViewer from './components/FlipbookViewer';
import SpectrumChart from './components/SpectrumChart';
import GaiaValidationPanel from './components/GaiaValidationPanel';
import ActiveMetadataCard from './components/ActiveMetadataCard';
import DeepLoadingOverlay from './components/DeepLoadingOverlay';
import BackendConnectionBoundary from './components/BackendConnectionBoundary';
import {
  getTargets,
  getFitsManifest,
  getSpectrum,
  exploreSky,
  ingestTarget
} from './services/api';
import { AlertTriangle, Info, ArrowUp, Sparkles, Orbit, Database, Radio, Globe } from 'lucide-react';

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

    if (isExploringSkyRef.current) return;

    const isVip = targets.some(t => (t.id || t.tid || t.target_id) === selectedTargetId) || selectedTargetId === 'barnard';
    if (!isVip) return;

    if (frames && frames.length > 0) return;

    let isMounted = true;
    const targetObj = targets.find(t => (t.id || t.tid || t.target_id) === selectedTargetId);
    if (targetObj && targetObj.ra !== undefined && targetObj.dec !== undefined) {
      setRa(targetObj.ra);
      setDec(targetObj.dec);
    }

    setFrames([]);
    setInspectedPixel(null);
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
  const handleFreeSkyClick = useCallback(async (clickedRa, clickedDec) => {
    triggerAutoScrollToAnalysis();
    isExploringSkyRef.current = true;
    setSelectedTargetId(null);
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

  const activeTargetObj = targets.find(t => (t.id || t.tid || t.target_id) === selectedTargetId);

  return (
    <BackendConnectionBoundary>
      <div className="min-h-screen bg-[#080D1B] text-slate-100 flex flex-col font-sans selection:bg-cyan-400 selection:text-slate-950">
        
        {/* Global Loading Overlay */}
        <DeepLoadingOverlay
          isLoading={isLoadingDeep}
          message={deepLoadingMessage}
          submessage="Streaming live infrared telemetry directly from NASA IRSA to local server"
        />

        {/* Modern Top Header */}
        <Header
          targets={targets}
          selectedTargetId={selectedTargetId}
          onSelectTarget={handleSelectVipTarget}
          onTriggerIngest={handleTriggerIngest}
          isIngesting={isIngesting}
          backendConnected={backendConnected}
          survey={survey}
          onChangeSurvey={setSurvey}
          ra={ra}
          dec={dec}
          detector={selectedDetector}
          onChangeDetector={setSelectedDetector}
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
            
            {/* Friendly Discovery Welcome Banner */}
            <div className="bg-gradient-to-r from-[#142B52]/60 via-[#142B52]/80 to-[#142B52]/60 border border-white/10 rounded-2xl px-4 py-3 text-center text-xs md:text-sm text-cyan-200 tracking-wide flex items-center justify-center gap-2 shadow-lg">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
              <span>
                <strong>Stage 1:</strong> Explore the infrared universe. Select a featured star or click any point in the sky to begin ↓
              </span>
            </div>

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
            className="min-h-screen pt-6 flex flex-col gap-6 border-t border-white/10"
          >
            {/* Stage Navigation Header */}
            <div className="flex items-center justify-between bg-[#142B52]/40 border border-white/10 rounded-2xl px-4 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold text-white tracking-wide">
                  Stage 2: Time-Domain & Spectroscopic Laboratory
                </span>
                <span className="text-xs text-cyan-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-medium">
                  {selectedTargetId ? `Target: ${selectedTargetId.toUpperCase()}` : `Sky: RA ${ra?.toFixed(4)}° DEC ${dec?.toFixed(4)}°`}
                </span>
              </div>

              <button
                type="button"
                onClick={handleScrollToTop}
                className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold text-cyan-300 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 transition-all cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Back to Sky Map</span>
              </button>
            </div>

            {/* 2 Analytical Columns (50% / 50% Desktop Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">

              {/* LEFT COLUMN: Time Travel (Flipbook & Motion Detector) */}
              <div className="lg:col-span-6 flex flex-col gap-6">
                <FlipbookViewer
                  targetId={selectedTargetId}
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
                    targetId={selectedTargetId}
                    ra={ra}
                    dec={dec}
                    inspectedPixel={inspectedPixel}
                    isLoading={isLoadingSpectrum}
                    selectedDetector={selectedDetector}
                    onSelectDetector={setSelectedDetector}
                    isExpertMode={isExpertMode}
                  />
                </div>

                {/* Sub-grid: Gaia DR3 Validation & Mission Metadata */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div id="gaia-validation">
                    <GaiaValidationPanel
                      targetId={selectedTargetId}
                      ra={ra}
                      dec={dec}
                      isExpertMode={isExpertMode}
                    />
                  </div>

                  <ActiveMetadataCard
                    targetId={selectedTargetId}
                    ra={ra}
                    dec={dec}
                    targetDetails={activeTargetObj}
                    manifest={manifest}
                    framesCount={frames.length}
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

        {/* Floating Quick Action Button: Return to Celestial Map */}
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-12 right-6 z-40 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-purple-400 hover:brightness-110 shadow-[0_0_20px_rgba(37,217,242,0.5)] transition-all active:scale-95 cursor-pointer"
          title="Return to Celestial Map"
        >
          <ArrowUp className="w-4 h-4 text-slate-950" />
          <span>Back to Sky Map</span>
        </button>

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
            <span>NASA Space Apps Challenge 2024</span>
            <span className="text-white/20">•</span>
            <span className="text-emerald-400 font-semibold">Engine: Nominal</span>
          </div>
        </footer>

      </div>
    </BackendConnectionBoundary>
  );
}
