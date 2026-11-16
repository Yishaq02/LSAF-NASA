import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Compass,
  X,
  Navigation,
  Globe,
  Radio,
  Radar,
  ArrowDownCircle,
  Eye,
  Layers,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';

// 5 Active IRSA / SPHEREx Observational Strips for Free Sky Exploration (POST /api/explorar with target_id: null)
export const IRSA_COVERAGE_PRESETS = [
  {
    id: 'ophiuchus_field',
    name: 'Ophiuchus Field (Near Barnard)',
    shortName: 'Ophiuchus Field',
    ra: 269.4850,
    dec: 4.7210,
    tag: 'Active Strip',
    story: 'Rich stellar neighborhood near Barnard with dense multi-epoch SPHEREx coverage.',
  },
  {
    id: 'taurus_auriga',
    name: 'Taurus-Auriga Complex',
    shortName: 'Taurus-Auriga',
    ra: 76.9120,
    dec: 30.4280,
    tag: 'T-Tauri Zone',
    story: 'Stellar nursery filled with protoplanetary disks and young stellar objects.',
  },
  {
    id: 'draco_nep',
    name: 'Draco NEP Strip',
    shortName: 'Draco NEP Strip',
    ra: 249.1850,
    dec: 66.7820,
    tag: 'Deep Polar',
    story: 'North Ecliptic Pole region observing deep extragalactic space and Mira variables.',
  },
  {
    id: 'hydra_ir',
    name: 'Hydra IR Sector',
    shortName: 'Hydra IR Sector',
    ra: 133.8210,
    dec: -7.2150,
    tag: 'Sub-Stellar',
    story: 'Low optical background corridor ideal for hunting elusive cold brown dwarfs.',
  },
  {
    id: 'indus_south',
    name: 'Indus South Strip',
    shortName: 'Indus South Strip',
    ra: 331.0850,
    dec: -56.7610,
    tag: 'High PM Zone',
    story: 'Southern sky corridor with rapid stellar motion across consecutive epochs.',
  },
];

// Normalize survey IDs for Aladin Lite v3 HiPS endpoints (Strictly 2MASS & AllWISE)
export const normalizeSurvey = (s) => {
  if (!s) return 'P/2MASS/color';
  if (s.includes('2MASS')) return 'P/2MASS/color';
  if (s.includes('allWISE') || s.includes('AllWISE')) return 'P/allWISE/color';
  return s.startsWith('CDS/') ? s.replace('CDS/', '') : s;
};

export default function AladinLiteMap({
  ra,
  dec,
  survey = 'CDS/P/2MASS/color',
  onChangeSurvey,
  targets = [],
  activeTarget = null,
  onSelectTarget,
  onFreeSkyClick,
  onTriggerIngest,
  isIngesting = false,
  isLoadingSky = false,
  onAutoScroll,
  isExpertMode = false,
}) {
  const aladinRef = useRef(null);
  const catalogRef = useRef(null);
  const presetsCatalogRef = useRef(null);
  const isObjectClickRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const pointerDownPosRef = useRef({ x: 0, y: 0 });

  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showPopup, setShowPopup] = useState(true);
  const [activePresetId, setActivePresetId] = useState(null);
  const [selectedStarCoords, setSelectedStarCoords] = useState(null);
  const [showStarHud, setShowStarHud] = useState(false);
  const [currentFoV, setCurrentFoV] = useState(1.5);

  // 1. Dynamic Script Loader for Aladin Lite
  useEffect(() => {
    if (window.A && window.A.init) {
      setIsScriptLoaded(true);
      return;
    }

    const scriptId = 'aladin-lite-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = '/aladin.js';
      script.async = true;

      script.onload = () => setIsScriptLoaded(true);
      script.onerror = () => {
        const fallback = document.createElement('script');
        fallback.src = 'https://cdn.jsdelivr.net/npm/aladin-lite/dist/aladin.umd.cjs';
        fallback.onload = () => setIsScriptLoaded(true);
        fallback.onerror = () => setLoadError('Unable to initialize Aladin Lite v3 astrometric engine.');
        document.head.appendChild(fallback);
      };

      document.head.appendChild(script);
    } else {
      script.addEventListener('load', () => setIsScriptLoaded(true));
    }
  }, []);

  // 2. Initialize Aladin Lite v3 EXACTLY ONCE with FIXED TAN projection and FOV <= 30°
  useEffect(() => {
    if (!isScriptLoaded || !window.A) return;
    if (aladinRef.current) return; // STRICT SINGLETON GUARD

    window.A.init.then(() => {
      try {
        const container = document.getElementById('aladin-lite-div');
        if (!container) return;
        if (aladinRef.current) return;

        container.innerHTML = '';

        // Default target coordinates: Barnard's Star (269.4521 4.6933)
        const initialRa = typeof ra === 'number' && !isNaN(ra) ? ra : 269.4521;
        const initialDec = typeof dec === 'number' && !isNaN(dec) ? dec : 4.6933;
        const initialTarget = `${initialRa} ${initialDec}`;
        const initialFoV = 0.5; // Fast, bright, star-rich texture load
        setCurrentFoV(initialFoV);

        const chosenSurvey = normalizeSurvey(survey || 'P/2MASS/color');

        // Instantiate Aladin Lite v3 with FIXED "TAN" projection
        const aladin = window.A.aladin('#aladin-lite-div', {
          survey: chosenSurvey,
          fov: initialFoV,
          projection: 'TAN', // STRICTLY FIXED TO TAN - NEVER USE SIN/MOL/AIT
          cooFrame: 'ICRSd',
          target: initialTarget,
          showLayersControl: false,
          showGotoControl: false,
          showZoomControl: true,
          showFullscreenControl: false,
          showShareControl: false,
        });

        aladinRef.current = aladin;

        // Pre-register surveys to ensure IRSA HiPS endpoints are cached under all possible IDs
        try {
          if (typeof aladin.createImageSurvey === 'function') {
            aladin.createImageSurvey(
              'P/2MASS/color',
              '2MASS color',
              'https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color',
              'equatorial',
              9,
              { imgFormat: 'jpeg', tileSize: 512 }
            );
            aladin.createImageSurvey(
              'CDS/P/2MASS/color',
              '2MASS color',
              'https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color',
              'equatorial',
              9,
              { imgFormat: 'jpeg', tileSize: 512 }
            );
            aladin.createImageSurvey(
              'P/allWISE/color',
              'AllWISE color',
              'https://irsa.ipac.caltech.edu/data/hips/CDS/AllWISE/RGB-W4-W2-W1',
              'equatorial',
              8,
              { imgFormat: 'jpeg', tileSize: 512 }
            );
            aladin.createImageSurvey(
              'CDS/P/allWISE/color',
              'AllWISE color',
              'https://irsa.ipac.caltech.edu/data/hips/CDS/AllWISE/RGB-W4-W2-W1',
              'equatorial',
              8,
              { imgFormat: 'jpeg', tileSize: 512 }
            );
          }
        } catch (e) {
          console.warn('Pre-registration of HiPS survey warning:', e);
        }

        try {
          if (typeof aladin.setProjection === 'function') {
            aladin.setProjection('TAN');
          }
          if (typeof aladin.setFrame === 'function') {
            aladin.setFrame('ICRSd');
          }
          if (typeof aladin.setFoV === 'function') {
            aladin.setFoV(initialFoV);
          }
          if (typeof aladin.gotoRaDec === 'function') {
            aladin.gotoRaDec(initialRa, initialDec);
          }
        } catch (e) {
          console.warn('Aladin post-init setup warning:', e);
        }

        // Post-render frame safeguard for WebGL texture redraw
        requestAnimationFrame(() => {
          if (aladinRef.current) {
            try {
              if (typeof aladinRef.current.setFrame === 'function') {
                aladinRef.current.setFrame('ICRSd');
              }
              if (typeof aladinRef.current.setProjection === 'function') {
                aladinRef.current.setProjection('TAN');
              }
              aladinRef.current.setFoV(initialFoV);
              aladinRef.current.gotoRaDec(initialRa, initialDec);
              if (aladinRef.current.view?.requestRedraw) {
                aladinRef.current.view.requestRedraw();
              }
            } catch (err) {
              console.warn('Aladin frame safeguard error:', err);
            }
          }
        });

        // Keep FOV safely clamped to <= 30°
        if (typeof aladin.on === 'function') {
          aladin.on('zoomChanged', (fov) => {
            if (typeof fov === 'number') {
              if (fov > 30) {
                aladin.setFoV(30);
                setCurrentFoV(30);
              } else {
                setCurrentFoV(fov);
              }
              // Always guarantee TAN projection
              if (typeof aladin.setProjection === 'function') {
                aladin.setProjection('TAN');
              }
            }
          });
        }

        // Layer 1: Featured VIP Targets Catalog (Cyan Circles)
        const catalog = window.A.catalog({
          name: 'Featured Targets',
          sourceSize: 22,
          color: '#25D9F2',
          shape: 'circle',
          onClick: 'showPopup',
        });
        catalogRef.current = catalog;
        aladin.addCatalog(catalog);

        // Layer 2: Verified IRSA Coverage Presets Catalog (Violet/Amber Squares)
        const presetsCatalog = window.A.catalog({
          name: 'Verified Sky Sectors',
          sourceSize: 18,
          color: '#8B5CF6',
          shape: 'square',
          onClick: 'showPopup',
        });
        presetsCatalogRef.current = presetsCatalog;
        aladin.addCatalog(presetsCatalog);

        // Click on Catalog Marker
        aladin.on('objectClicked', (obj) => {
          isObjectClickRef.current = true;
          setTimeout(() => {
            isObjectClickRef.current = false;
          }, 400);

          if (!obj) return;
          const targetData = obj.data?.targetData || obj.data;
          if (targetData) {
            if (targetData.isPreset) {
              setActivePresetId(targetData.id);
              setShowPopup(false);
              if (aladinRef.current && targetData.ra && targetData.dec) {
                aladinRef.current.gotoRaDec(targetData.ra, targetData.dec);
                aladinRef.current.setFoV(0.5);
              }
              onFreeSkyClick(targetData.ra, targetData.dec);
              onAutoScroll?.();
            } else {
              setActivePresetId(null);
              const tid = targetData.id || targetData.tid || targetData.target_id;
              if (aladinRef.current && targetData.ra && targetData.dec) {
                aladinRef.current.gotoRaDec(targetData.ra, targetData.dec);
                aladinRef.current.setFoV(0.5);
              }
              onSelectTarget(tid);
              setShowPopup(true);
              onAutoScroll?.();
            }
          }
        });

        // Pointer Drag Filter
        container.addEventListener('pointerdown', (e) => {
          pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
          wasDraggingRef.current = false;
        });

        container.addEventListener('pointerup', (e) => {
          const dist = Math.hypot(e.clientX - pointerDownPosRef.current.x, e.clientY - pointerDownPosRef.current.y);
          if (dist > 5) {
            wasDraggingRef.current = true;
            setTimeout(() => {
              wasDraggingRef.current = false;
            }, 200);
          }
        });

        // Click anywhere on celestial sphere (Point & Click any star)
        aladin.on('click', (ev) => {
          if (isObjectClickRef.current || wasDraggingRef.current) return;
          if (!ev) return;
          let clickedRa, clickedDec;

          if (typeof ev.ra === 'number' && typeof ev.dec === 'number' && !isNaN(ev.ra) && !isNaN(ev.dec)) {
            clickedRa = ev.ra;
            clickedDec = ev.dec;
          } else if (ev.x !== undefined && ev.y !== undefined && aladin.pix2world) {
            try {
              const worldCoords = aladin.pix2world(ev.x, ev.y);
              if (worldCoords && worldCoords.length >= 2 && !isNaN(worldCoords[0]) && !isNaN(worldCoords[1])) {
                clickedRa = worldCoords[0];
                clickedDec = worldCoords[1];
              }
            } catch (err) {
              console.warn('pix2world warning:', err);
            }
          }

          if (clickedRa !== undefined && clickedDec !== undefined && !isNaN(clickedRa) && !isNaN(clickedDec)) {
            setActivePresetId(null);
            setShowPopup(false);
            setSelectedStarCoords({ ra: clickedRa, dec: clickedDec });
            setShowStarHud(true);
            if (typeof aladin.gotoRaDec === 'function') {
              aladin.gotoRaDec(clickedRa, clickedDec);
            }
            if (typeof aladin.setFoV === 'function') {
              aladin.setFoV(0.5);
              setCurrentFoV(0.5);
            }
            onFreeSkyClick(clickedRa, clickedDec);
            onAutoScroll?.();
          }
        });
      } catch (err) {
        console.error('Error initializing Aladin Lite:', err);
      }
    });
  }, [isScriptLoaded]);

  // 3. Update VIP Catalog sources when targets list updates
  useEffect(() => {
    if (!catalogRef.current || !window.A || !targets || targets.length === 0) return;

    try {
      catalogRef.current.clear();
      const sources = targets
        .filter((t) => typeof t.ra === 'number' && typeof t.dec === 'number')
        .map((t) => {
          const title = t.name || t.nombre || t.id;
          const desc = `${t.type || 'Featured Target'} (RA: ${t.ra.toFixed(4)}°, DEC: ${t.dec.toFixed(4)}°)`;
          if (window.A.marker) {
            return window.A.marker(t.ra, t.dec, {
              popupTitle: title,
              popupDesc: desc,
              targetData: t,
            });
          }
          return window.A.source(t.ra, t.dec, {
            name: title,
            targetData: t,
          });
        });

      catalogRef.current.addSources(sources);
      if (aladinRef.current?.view?.requestRedraw) {
        aladinRef.current.view.requestRedraw();
      }
    } catch (err) {
      console.error('Error updating VIP catalog sources:', err);
    }
  }, [targets, isScriptLoaded]);

  // 4. Update Presets Catalog layer (Verified Sky Sectors)
  useEffect(() => {
    if (!presetsCatalogRef.current || !window.A) return;

    try {
      presetsCatalogRef.current.clear();
      const presetSources = IRSA_COVERAGE_PRESETS.map((p) => {
        const title = p.name;
        const desc = `${p.tag} (RA: ${p.ra.toFixed(4)}°, DEC: ${p.dec.toFixed(4)}°)`;
        if (window.A.marker) {
          return window.A.marker(p.ra, p.dec, {
            popupTitle: title,
            popupDesc: desc,
            targetData: { ...p, isPreset: true },
          });
        }
        return window.A.source(p.ra, p.dec, {
          name: title,
          targetData: { ...p, isPreset: true },
        });
      });

      presetsCatalogRef.current.addSources(presetSources);
      if (aladinRef.current?.view?.requestRedraw) {
        aladinRef.current.view.requestRedraw();
      }
    } catch (err) {
      console.error('Error updating presets catalog sources:', err);
    }
  }, [isScriptLoaded]);

  // 5. Navigate camera when RA / DEC props update
  useEffect(() => {
    if (typeof ra === 'number' && typeof dec === 'number' && !isNaN(ra) && !isNaN(dec)) {
      setSelectedStarCoords({ ra, dec });
      if (aladinRef.current) {
        try {
          aladinRef.current.gotoRaDec(ra, dec);
          aladinRef.current.setProjection('TAN');
          aladinRef.current.setFoV(0.5);
          setCurrentFoV(0.5);
        } catch (err) {
          console.error('Error navigating Aladin to coords:', err);
        }
      }
    }
  }, [ra, dec]);

  // 6. Update survey layer when survey prop changes
  useEffect(() => {
    if (aladinRef.current && survey) {
      try {
        const normalized = normalizeSurvey(survey);
        aladinRef.current.setImageSurvey(normalized);
      } catch (err) {
        console.error('Error setting survey:', err);
      }
    }
  }, [survey]);

  // Safe Camera-Only Galactic Center View (15° FOV in TAN, ZERO BACKEND CALLS)
  const handleGoGalacticCenter = () => {
    setActivePresetId(null);
    setShowPopup(false);
    setShowStarHud(false);

    if (aladinRef.current) {
      try {
        aladinRef.current.setProjection('TAN');
        aladinRef.current.gotoRaDec(265.4405, -30.3439);
        aladinRef.current.setFoV(15);
        setCurrentFoV(15);
        if (aladinRef.current.view?.requestRedraw) {
          aladinRef.current.view.requestRedraw();
        }
      } catch (err) {
        console.warn('Error navigating to galactic center:', err);
      }
    }
  };

  // Preset Selection Handler
  const handlePresetSelect = (preset) => {
    setActivePresetId(preset.id);
    setShowPopup(false);

    if (aladinRef.current) {
      try {
        aladinRef.current.gotoRaDec(preset.ra, preset.dec);
        aladinRef.current.setProjection('TAN');
        aladinRef.current.setFoV(0.5);
        setCurrentFoV(0.5);
      } catch (err) {
        console.warn('Error navigating Aladin to preset:', err);
      }
    }

    onFreeSkyClick(preset.ra, preset.dec);
    onAutoScroll?.();
  };

  const currentSurveyName = survey?.includes('allWISE') ? 'AllWISE (Mid-IR)' : '2MASS (Near-IR)';

  return (
    <div className="relative cosmic-card p-3 md:p-5 flex flex-col gap-4 font-sans text-slate-100 overflow-hidden shadow-2xl">
      
      {/* Top Header of the Celestial Navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        
        {/* Title & Discovery Tag */}
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-[#25D9F2]/20 to-[#8B5CF6]/20 border border-cyan-400/30 text-cyan-300">
            <Compass className="w-4 h-4 text-[#25D9F2]" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-2">
              <span>Interactive Celestial Map</span>
              <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-semibold">
                Aladin Lite v3
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Explore stars across the infrared sky. Click any target or star to begin discovery.
            </p>
          </div>
        </div>

        {/* Tactical FOV & Camera Actions */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Galactic Center View Button (Safe 15° TAN View) */}
          <button
            type="button"
            onClick={handleGoGalacticCenter}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-amber-400/50 text-slate-200 transition-all cursor-pointer font-sans active:scale-95"
            title="Safe wide-angle view of the Milky Way core (15° FOV in TAN)"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-xs">Galactic Core (15°)</span>
          </button>

          {/* Instrument Readout */}
          <div className="flex items-center gap-2 bg-[#080D1B]/80 border border-white/10 rounded-xl px-3 py-1.5 text-slate-300 tabular-nums">
            <span className="text-cyan-400 font-bold">FOV: {currentFoV.toFixed(1)}°</span>
            <span className="text-white/20">|</span>
            <span className="text-slate-400 font-semibold">{currentSurveyName}</span>
          </div>
        </div>

      </div>

      {/* Featured VIP Stars Pills (Quick Discovery Bar) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Featured Stars:
        </span>
        {targets.map((t) => {
          const tid = t.id || t.tid || t.target_id;
          const isSelected = activeTarget && (activeTarget.id === tid || activeTarget.target_id === tid);
          const displayName = t.name || t.nombre || tid;

          return (
            <button
              key={tid}
              type="button"
              onClick={() => {
                setActivePresetId(null);
                onSelectTarget(tid);
                if (aladinRef.current && t.ra && t.dec) {
                  aladinRef.current.gotoRaDec(t.ra, t.dec);
                  aladinRef.current.setProjection('TAN');
                  aladinRef.current.setFoV(0.5);
                  setCurrentFoV(0.5);
                }
                setShowPopup(true);
                onAutoScroll?.();
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-[#25D9F2] to-[#8B5CF6] text-slate-950 font-bold shadow-[0_0_12px_rgba(37,217,242,0.4)]'
                  : 'bg-white/5 border border-white/10 hover:border-cyan-400/40 text-slate-200 hover:text-white'
              }`}
            >
              <span>{displayName}</span>
              {t.distance_ly && (
                <span className={`text-[10px] ${isSelected ? 'text-slate-950/80 font-bold' : 'text-slate-400'}`}>
                  • {t.distance_ly} ly
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Aladin Lite Map Viewport Enclosure (h-[62vh], rounded-2xl) */}
      <div className="relative w-full h-[58vh] sm:h-[62vh] min-h-[460px] rounded-2xl overflow-hidden border border-white/10 bg-black shadow-inner">
        
        <div
          id="aladin-lite-div"
          className="w-full h-full border-none"
        />

        {/* Loading Overlay */}
        {!isScriptLoaded && !loadError && (
          <div className="absolute inset-0 bg-[#080D1B]/90 flex flex-col items-center justify-center p-4 z-30">
            <div className="w-10 h-10 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mb-3" />
            <p className="text-xs text-cyan-300 font-semibold tracking-wider uppercase">
              Loading Aladin Lite v3 Celestial Avionics...
            </p>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 bg-[#080D1B]/90 flex flex-col items-center justify-center p-4 text-center z-30">
            <p className="text-xs text-red-400 mb-1 font-semibold">{loadError}</p>
            <p className="text-[11px] text-slate-400">Please verify connection to CDS / IPAC astrometry servers.</p>
          </div>
        )}

        {/* Dynamic Ingestion Overlay */}
        {isLoadingSky && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm font-bold text-cyan-300 tracking-wide">Querying NASA IRSA Time-Domain Archive...</p>
            <p className="text-xs text-slate-300 mt-1">Downloading multi-epoch FITS cutouts for selected coordinates</p>
          </div>
        )}

        {/* Floating Star Info Card (Selected VIP Target) */}
        {activeTarget && showPopup && (
          <div className="absolute top-4 right-4 max-w-[320px] w-full z-20 bg-[#0F1A34]/95 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-4 shadow-2xl text-slate-100 animate-fadeIn font-sans">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {activeTarget.name || activeTarget.nombre || activeTarget.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPopup(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Type / Class:</span>
                <span className="text-cyan-300 font-semibold">{activeTarget.type || 'Stellar Target'}</span>
              </div>
              {activeTarget.distance_ly && (
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Distance:</span>
                  <span className="text-amber-300 font-semibold">{activeTarget.distance_ly} light-years</span>
                </div>
              )}
              <div className="flex justify-between text-slate-300 font-mono text-[11px]">
                <span className="text-slate-400">Coordinates:</span>
                <span>
                  {activeTarget.ra?.toFixed(4)}°, {activeTarget.dec > 0 ? `+${activeTarget.dec?.toFixed(4)}` : activeTarget.dec?.toFixed(4)}°
                </span>
              </div>
            </div>

            {activeTarget.description && (
              <p className="text-[11px] text-slate-300 mt-2.5 pt-2 border-t border-white/10 leading-relaxed">
                {activeTarget.description}
              </p>
            )}

            {/* Prominent Analyze Star Below Button with Smooth Auto-Scroll */}
            <div className="mt-4 pt-2 border-t border-white/10 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onAutoScroll?.();
                  const targetDeck = document.getElementById('time-travel');
                  if (targetDeck) {
                    targetDeck.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#25D9F2] to-[#8B5CF6] hover:brightness-110 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(37,217,242,0.4)] cursor-pointer active:scale-95"
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>Analyze Star Below ↓</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Star HUD for Point & Click in Free Sky */}
        {showStarHud && selectedStarCoords && !activeTarget && (
          <div className="absolute top-4 right-4 max-w-[320px] w-full z-20 bg-[#0F1A34]/95 backdrop-blur-xl border border-purple-500/50 rounded-2xl p-4 shadow-2xl text-slate-100 animate-fadeIn font-sans">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Selected Star Coordinates
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStarHud(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Right Ascension (RA):</span>
                <span className="text-cyan-300 font-bold">{selectedStarCoords.ra.toFixed(5)}°</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Declination (DEC):</span>
                <span className="text-cyan-300 font-bold">
                  {selectedStarCoords.dec > 0 ? `+${selectedStarCoords.dec.toFixed(5)}` : selectedStarCoords.dec.toFixed(5)}°
                </span>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/10 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onFreeSkyClick(selectedStarCoords.ra, selectedStarCoords.dec);
                  onAutoScroll?.();
                  const targetDeck = document.getElementById('time-travel');
                  if (targetDeck) {
                    targetDeck.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(139,92,246,0.4)] cursor-pointer active:scale-95"
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>Analyze Star Below ↓</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Verified Sky Sectors (IRSA Active Strips Coverage) */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Radar className="w-3.5 h-3.5 text-amber-400" />
            <span>Verified Sky Sectors (SPHEREx Active Coverage)</span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Directly mapped to NASA IRSA time-domain strips
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {IRSA_COVERAGE_PRESETS.map((preset) => {
            const isMatch = activePresetId === preset.id || (
              !activeTarget &&
              typeof ra === 'number' &&
              typeof dec === 'number' &&
              Math.abs(ra - preset.ra) < 0.001 &&
              Math.abs(dec - preset.dec) < 0.001
            );

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                disabled={isLoadingSky}
                className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 ${
                  isMatch
                    ? 'bg-[#142B52]/70 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                    : 'bg-[#142B52]/30 border-white/10 hover:border-cyan-400/50 hover:bg-[#142B52]/50'
                }`}
                title={preset.story}
              >
                <div className="flex items-center justify-between gap-1 w-full mb-1">
                  <span className="font-bold text-xs text-white truncate">{preset.shortName}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300 shrink-0">
                    {preset.tag}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight font-sans">
                  {preset.story}
                </p>
                <div className="mt-2 text-[10px] font-mono text-cyan-400/80 tabular-nums">
                  RA {preset.ra.toFixed(4)}° • DEC {preset.dec > 0 ? `+${preset.dec.toFixed(4)}` : preset.dec.toFixed(4)}°
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
