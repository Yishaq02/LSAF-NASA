import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ExternalLink,
  DownloadCloud
} from 'lucide-react';
import {
  formatTargetName,
  formatTargetType,
  formatTargetDescription,
  cleanStarName,
  formatSimbadOtype,
  raDecToSexagesimal
} from '../utils/astroLabels';

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
  survey = 'P/2MASS/color',
  onChangeSurvey,
  targets = [],
  activeTarget = null,
  onSelectTarget,
  onFreeSkyClick,
  onTriggerIngest,
  onOpenIngestModal,
  isIngesting = false,
  isLoadingSky = false,
  onAutoScroll,
  isExpertMode = false,
}) {
  const aladinRef = useRef(null);
  const catalogRef = useRef(null);
  const presetsCatalogRef = useRef(null);
  const simbadCatalogRef = useRef(null);
  const simbadSourcesRef = useRef([]);
  const catalogedStarsRef = useRef([]);
  const cursorTooltipRef = useRef(null);
  const positionTimeoutRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const lastSimbadQueryRef = useRef(null);
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
  const [showSimbadLabels, setShowSimbadLabels] = useState(true);
  const [hoveredStar, setHoveredStar] = useState(null);
  const [cursorTooltip, setCursorTooltip] = useState(null);
  const [isLoadingSimbad, setIsLoadingSimbad] = useState(false);

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

        // Zoom change handler: freely allow 0.05° to 180° with auto-switch to AIT for fov > 45
        if (typeof aladin.on === 'function') {
          aladin.on('zoomChanged', (fov) => {
            if (typeof fov === 'number') {
              setCurrentFoV(fov);
              if (fov > 45) {
                if (typeof aladin.setProjection === 'function') {
                  aladin.setProjection('AIT');
                }
              } else {
                if (typeof aladin.setProjection === 'function') {
                  aladin.setProjection('TAN');
                }
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

        // Layer 3: Live SIMBAD Interactive Astronomical Stars Catalog
        const simbadCatalog = window.A.catalog({
          name: 'SIMBAD Stars',
          sourceSize: 14,
          color: '#25D9F2',
          shape: 'circle',
          onClick: 'showPopup',
        });
        simbadCatalogRef.current = simbadCatalog;
        aladin.addCatalog(simbadCatalog);

        // Hover on Any Astronomical Object (VIP Target, Preset, or SIMBAD Star)
        aladin.on('objectHovered', (obj) => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }

          if (!obj) {
            hoverTimeoutRef.current = setTimeout(() => {
              setHoveredStar(null);
            }, 300);
            return;
          }

          const simbad = obj.data?.simbadData;
          const targetData = obj.data?.targetData || obj.data;

          let name = 'Unknown Star';
          let type = 'Stellar Target';
          let spType = null;
          let starRa = typeof obj.ra === 'number' ? obj.ra : null;
          let starDec = typeof obj.dec === 'number' ? obj.dec : null;
          let pmra = null;
          let pmdec = null;
          let plx = null;

          if (simbad) {
            name = cleanStarName(simbad.main_id);
            type = formatSimbadOtype(simbad.otype, simbad.otype_txt);
            spType = simbad.sp_type || null;
            starRa = simbad.ra ?? starRa;
            starDec = simbad.dec ?? starDec;
            pmra = simbad.pmra;
            pmdec = simbad.pmdec;
            plx = simbad.plx_value;
          } else if (targetData) {
            name = formatTargetName(targetData.name || targetData.nombre || targetData.id, targetData.id);
            type = formatTargetType(targetData.type, targetData.id);
            starRa = targetData.ra ?? starRa;
            starDec = targetData.dec ?? starDec;
          }

          setHoveredStar({
            name,
            type,
            spType,
            ra: starRa,
            dec: starDec,
            pmra,
            pmdec,
            plx,
            isVip: !!targetData && !targetData.isPreset && !simbad,
            isPreset: !!targetData?.isPreset,
            isSimbad: !!simbad,
            rawObj: obj,
          });
        });

        // Click on Catalog Marker
        aladin.on('objectClicked', (obj) => {
          isObjectClickRef.current = true;
          setTimeout(() => {
            isObjectClickRef.current = false;
          }, 400);

          if (!obj) return;
          const simbad = obj.data?.simbadData;
          const targetData = obj.data?.targetData || obj.data;

          if (simbad) {
            const starName = cleanStarName(simbad.main_id);
            setActivePresetId(null);
            setShowPopup(false);
            setSelectedStarCoords({ ra: simbad.ra, dec: simbad.dec });
            setShowStarHud(false);
            if (aladinRef.current && simbad.ra && simbad.dec) {
              aladinRef.current.gotoRaDec(simbad.ra, simbad.dec);
              aladinRef.current.setFoV(0.5);
              setCurrentFoV(0.5);
            }
            onFreeSkyClick(simbad.ra, simbad.dec, starName);
            onAutoScroll?.();
            return;
          }

          if (targetData) {
            if (targetData.isPreset) {
              setActivePresetId(targetData.id);
              setShowPopup(false);
              if (aladinRef.current && targetData.ra && targetData.dec) {
                aladinRef.current.gotoRaDec(targetData.ra, targetData.dec);
                aladinRef.current.setFoV(0.5);
                setCurrentFoV(0.5);
              }
              onFreeSkyClick(targetData.ra, targetData.dec, targetData.name);
              onAutoScroll?.();
            } else {
              setActivePresetId(null);
              const tid = targetData.id || targetData.tid || targetData.target_id;
              if (aladinRef.current && targetData.ra && targetData.dec) {
                aladinRef.current.gotoRaDec(targetData.ra, targetData.dec);
                aladinRef.current.setFoV(0.5);
                setCurrentFoV(0.5);
              }
              onSelectTarget(tid);
              setShowPopup(true);
              onAutoScroll?.();
            }
          }
        });

        // Precise Real-Time MouseMove Star Proximity Tracker (< 18px radius)
        const handleMouseMove = (e) => {
          if (!container || !catalogedStarsRef.current.length || !aladinRef.current?.world2pix) return;
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          let nearestStar = null;
          let minDistance = 18; // 18px proximity radius

          for (const star of catalogedStarsRef.current) {
            if (typeof star.ra !== 'number' || typeof star.dec !== 'number') continue;
            try {
              const pix = aladinRef.current.world2pix(star.ra, star.dec);
              if (pix && typeof pix[0] === 'number' && typeof pix[1] === 'number' && !isNaN(pix[0]) && !isNaN(pix[1])) {
                const d = Math.hypot(pix[0] - mouseX, pix[1] - mouseY);
                if (d < minDistance) {
                  minDistance = d;
                  nearestStar = star;
                }
              }
            } catch (err) {
              // Out of projection boundary
            }
          }

          if (nearestStar) {
            cursorTooltipRef.current = nearestStar;
            setCursorTooltip({
              star: nearestStar,
              x: mouseX,
              y: mouseY,
            });
          } else {
            cursorTooltipRef.current = null;
            setCursorTooltip(null);
          }
        };

        const handleMouseLeave = () => {
          cursorTooltipRef.current = null;
          setCursorTooltip(null);
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);

        // Debounced Live Catalog query on camera move
        if (typeof aladin.on === 'function') {
          aladin.on('positionChanged', () => {
            if (positionTimeoutRef.current) clearTimeout(positionTimeoutRef.current);
            positionTimeoutRef.current = setTimeout(() => {
              if (aladinRef.current?.getRaDec) {
                const coords = aladinRef.current.getRaDec();
                if (coords && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                  loadSimbadStarsForCoords(coords[0], coords[1]);
                }
              }
            }, 400);
          });
        }

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

          // If clicked near a star in hover radius (< 18px), select it directly!
          if (cursorTooltipRef.current) {
            const s = cursorTooltipRef.current;
            if (s.isVip && s.id) {
              onSelectTarget(s.id);
            } else {
              onFreeSkyClick(s.ra, s.dec, s.name.replace(/^★\s*/, ''));
            }
            onAutoScroll?.();
            return;
          }

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
            onFreeSkyClick(clickedRa, clickedDec, `Sky RA ${clickedRa.toFixed(4)}°`);
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
          const tid = t.id || t.tid || t.target_id;
          const title = formatTargetName(t.name || t.nombre, tid);
          const typeStr = formatTargetType(t.type, tid);
          const desc = `${typeStr} (RA: ${t.ra.toFixed(4)}°, DEC: ${t.dec.toFixed(4)}°)`;
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

  // Synchronize unified star registry for ultra-fast < 18px hover detection
  const syncCatalogedStars = useCallback((extraStars = []) => {
    const starsMap = new Map();

    // 1. VIP Targets (Barnard, WISE 0855, Epsilon Indi B, RW Aurigae, R Draconis)
    (targets || []).forEach((t) => {
      if (typeof t.ra === 'number' && typeof t.dec === 'number') {
        const tid = t.id || t.tid || t.target_id;
        const cleanName = formatTargetName(t.name || t.nombre, tid);
        starsMap.set(`${t.ra.toFixed(4)}_${t.dec.toFixed(4)}`, {
          name: cleanName.startsWith('★') ? cleanName : `★ ${cleanName}`,
          type: formatTargetType(t.type, tid),
          mag: t.distance_ly ? `~${t.distance_ly} ly` : null,
          ra: t.ra,
          dec: t.dec,
          isVip: true,
          id: tid,
        });
      }
    });

    // 2. Verified Sky Sector Presets
    IRSA_COVERAGE_PRESETS.forEach((p) => {
      starsMap.set(`${p.ra.toFixed(4)}_${p.dec.toFixed(4)}`, {
        name: `★ ${p.shortName}`,
        type: p.tag,
        mag: null,
        ra: p.ra,
        dec: p.dec,
        isPreset: true,
        id: p.id,
      });
    });

    // 3. Live SIMBAD / VizieR Catalog Stars
    (extraStars || []).forEach((s) => {
      const key = `${s.ra.toFixed(4)}_${s.dec.toFixed(4)}`;
      if (!starsMap.has(key)) {
        const cleanName = cleanStarName(s.main_id || s.name);
        starsMap.set(key, {
          name: cleanName.startsWith('★') ? cleanName : `★ ${cleanName}`,
          type: formatSimbadOtype(s.otype, s.otype_txt),
          mag: s.mag || (s.plx_value > 0 ? `${(1000 / s.plx_value * 3.26).toFixed(1)} ly` : null),
          ra: s.ra,
          dec: s.dec,
          isSimbad: true,
          id: null,
        });
      }
    });

    catalogedStarsRef.current = Array.from(starsMap.values());
  }, [targets]);

  useEffect(() => {
    syncCatalogedStars([]);
  }, [syncCatalogedStars]);

  // Query live SIMBAD stars for active sky coordinates
  const loadSimbadStarsForCoords = useCallback(async (currentRa, currentDec) => {
    if (
      lastSimbadQueryRef.current &&
      Math.abs(lastSimbadQueryRef.current.ra - currentRa) < 0.05 &&
      Math.abs(lastSimbadQueryRef.current.dec - currentDec) < 0.05
    ) {
      return;
    }
    lastSimbadQueryRef.current = { ra: currentRa, dec: currentDec };

    setIsLoadingSimbad(true);
    try {
      const query = `SELECT TOP 50 main_id, otype, otype_txt, sp_type, ra, dec, pmra, pmdec, plx_value FROM basic WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${currentRa},${currentDec},0.4))=1 ORDER BY nbref DESC`;
      const encoded = encodeURIComponent(query);
      const mirrors = [
        `https://simbad.cfa.harvard.edu/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=${encoded}`,
        `https://simbad.idia.ac.za/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=${encoded}`,
      ];

      let stars = [];
      for (const mirrorUrl of mirrors) {
        try {
          const res = await fetch(mirrorUrl, { signal: AbortSignal.timeout(4000) });
          if (!res.ok) continue;
          const json = await res.json();
          if (json && Array.isArray(json.data)) {
            stars = json.data.map((row) => ({
              main_id: row[0],
              otype: row[1],
              otype_txt: row[2],
              sp_type: row[3],
              ra: row[4],
              dec: row[5],
              pmra: row[6],
              pmdec: row[7],
              plx_value: row[8],
            }));
            break;
          }
        } catch (e) {
          // fallback to next mirror
        }
      }

      if (stars.length > 0) {
        syncCatalogedStars(stars);
        const sources = stars
          .filter((s) => typeof s.ra === 'number' && typeof s.dec === 'number')
          .map((s) => {
            const cleanName = cleanStarName(s.main_id);
            const typeStr = formatSimbadOtype(s.otype, s.otype_txt);
            const desc = `${typeStr}${s.sp_type ? ` [${s.sp_type}]` : ''} (RA: ${s.ra.toFixed(4)}°, DEC: ${s.dec.toFixed(4)}°)`;
            return window.A.source(s.ra, s.dec, {
              name: cleanName,
              simbadData: s,
              popupTitle: cleanName,
              popupDesc: desc,
            });
          });

        simbadSourcesRef.current = sources;
        if (simbadCatalogRef.current) {
          simbadCatalogRef.current.clear();
          if (showSimbadLabels) {
            simbadCatalogRef.current.addSources(sources);
          }
        }
        if (aladinRef.current?.view?.requestRedraw) {
          aladinRef.current.view.requestRedraw();
        }
      }
    } catch (err) {
      console.warn('SIMBAD live query notice:', err);
    } finally {
      setIsLoadingSimbad(false);
    }
  }, [showSimbadLabels, syncCatalogedStars]);

  // 5. Query and Update Live SIMBAD Astronomical Catalog
  useEffect(() => {
    if (!isScriptLoaded || !window.A || !simbadCatalogRef.current) return;
    const currentRa = typeof ra === 'number' && !isNaN(ra) ? ra : 269.4521;
    const currentDec = typeof dec === 'number' && !isNaN(dec) ? dec : 4.6933;

    const timer = setTimeout(() => {
      loadSimbadStarsForCoords(currentRa, currentDec);
    }, 400);

    return () => clearTimeout(timer);
  }, [ra, dec, isScriptLoaded, loadSimbadStarsForCoords]);

  // Toggle SIMBAD layer visibility
  const handleToggleSimbad = () => {
    const nextVal = !showSimbadLabels;
    setShowSimbadLabels(nextVal);
    if (simbadCatalogRef.current) {
      try {
        simbadCatalogRef.current.clear();
        if (nextVal && simbadSourcesRef.current?.length > 0) {
          simbadCatalogRef.current.addSources(simbadSourcesRef.current);
          if (typeof simbadCatalogRef.current.show === 'function') {
            simbadCatalogRef.current.show();
          }
        } else if (!nextVal && typeof simbadCatalogRef.current.hide === 'function') {
          simbadCatalogRef.current.hide();
        }
        if (aladinRef.current?.view?.requestRedraw) {
          aladinRef.current.view.requestRedraw();
        }
      } catch (err) {
        console.warn('Error toggling SIMBAD visibility:', err);
      }
    }
  };

  // 5. Navigate camera when RA / DEC props update
  useEffect(() => {
    if (typeof ra === 'number' && typeof dec === 'number' && !isNaN(ra) && !isNaN(dec)) {
      setSelectedStarCoords({ ra, dec });
      if (aladinRef.current) {
        try {
          aladinRef.current.gotoRaDec(ra, dec);
          if (currentFoV <= 45) {
            aladinRef.current.setProjection('TAN');
          }
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

  // Camera-Only Galactic Center View (110° FOV in AIT, Whole Galaxy Panorama without bounce)
  const handleGoGalacticCenter = () => {
    setActivePresetId(null);
    setShowPopup(false);
    setShowStarHud(false);
    cursorTooltipRef.current = null;
    setCursorTooltip(null);

    if (aladinRef.current) {
      try {
        aladinRef.current.setProjection('AIT');
        aladinRef.current.gotoRaDec(265.4405, -30.3439);
        aladinRef.current.setFoV(110);
        setCurrentFoV(110);
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
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          
          {/* Survey Selector (Strictly in Aladin Lite Map Header) */}
          <div className="flex items-center gap-1.5 bg-[#080D1B]/80 border border-white/10 rounded-xl px-2.5 py-1 text-slate-300 font-sans">
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={survey?.includes('allWISE') ? 'P/allWISE/color' : 'P/2MASS/color'}
              onChange={(e) => onChangeSurvey && onChangeSurvey(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="P/2MASS/color" className="bg-[#080D1B]">2MASS (Near-IR)</option>
              <option value="P/allWISE/color" className="bg-[#080D1B]">AllWISE (Mid-IR)</option>
            </select>
          </div>

          {/* Galactic Center View Button (Whole Galaxy 110° AIT View) */}
          <button
            type="button"
            onClick={handleGoGalacticCenter}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 hover:border-amber-400/50 text-slate-200 transition-all cursor-pointer font-sans active:scale-95"
            title="Panoramic view of the Milky Way galaxy (110° FOV in AIT)"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-xs hidden sm:inline">Galactic Core (110°)</span>
            <span className="font-semibold text-xs sm:hidden">Core</span>
          </button>

          {/* Instrument FOV Readout */}
          <div className="flex items-center gap-2 bg-[#080D1B]/80 border border-white/10 rounded-xl px-2.5 py-1 text-slate-300 tabular-nums">
            <span className="text-cyan-400 font-bold">FOV: {currentFoV.toFixed(1)}°</span>
          </div>

          {/* Interactive Star Labels (SIMBAD) Switch: ON / OFF */}
          <button
            type="button"
            onClick={handleToggleSimbad}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer font-sans active:scale-95 ${
              showSimbadLabels
                ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(37,217,242,0.3)]'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle live SIMBAD astronomical star labels on sky map"
          >
            <Sparkles className={`w-3.5 h-3.5 ${showSimbadLabels ? 'text-cyan-400 fill-cyan-400/30' : 'text-slate-400'}`} />
            <span>Star Labels (SIMBAD): <strong className={showSimbadLabels ? 'text-white' : 'text-slate-400'}>{showSimbadLabels ? 'ON' : 'OFF'}</strong></span>
            {isLoadingSimbad && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping ml-0.5" />}
          </button>

          {/* IRSA Ingestion Trigger Modal Button (Expert Mode Only) */}
          {isExpertMode && onOpenIngestModal && (
            <button
              type="button"
              onClick={onOpenIngestModal}
              disabled={isIngesting}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-[0_0_10px_rgba(245,158,11,0.2)] disabled:opacity-50 font-sans"
              title="Download customized multi-epoch FITS cubes directly from NASA IRSA"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>IRSA Ingest</span>
            </button>
          )}
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
          const displayName = formatTargetName(t.name || t.nombre, tid);

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

        {/* Floating Tooltip right next to cursor on < 18px star hover */}
        {cursorTooltip && (
          <div
            className="absolute z-50 pointer-events-none select-none animate-fadeIn transition-transform duration-75"
            style={{
              left: `${Math.min(cursorTooltip.x + 14, 520)}px`,
              top: `${Math.max(10, cursorTooltip.y - 75)}px`,
            }}
          >
            <div className="bg-[#080D1B]/95 backdrop-blur-md border border-cyan-400/80 rounded-xl px-3 py-2 shadow-[0_0_25px_rgba(37,217,242,0.45)] text-slate-100 font-sans min-w-[210px] max-w-[280px]">
              <div className="flex items-center gap-1.5 font-bold text-xs text-white border-b border-white/10 pb-1 mb-1">
                <span className="text-cyan-400 font-black">★</span>
                <span className="truncate">{cursorTooltip.star.name.replace(/^★\s*/, '')}</span>
              </div>
              <div className="text-[11px] space-y-0.5 text-slate-300">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Type:</span>
                  <span className="text-cyan-300 font-semibold truncate max-w-[150px]">{cursorTooltip.star.type}</span>
                </div>
                {cursorTooltip.star.mag && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400">Magnitude:</span>
                    <span className="text-amber-300 font-mono">{cursorTooltip.star.mag}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>RA {cursorTooltip.star.ra.toFixed(4)}°</span>
                  <span>DEC {cursorTooltip.star.dec > 0 ? `+${cursorTooltip.star.dec.toFixed(4)}` : cursorTooltip.star.dec.toFixed(4)}°</span>
                </div>
              </div>
              <div className="mt-1.5 pt-1 border-t border-white/10 text-[9.5px] font-mono text-cyan-300/90 font-medium">
                Click to load FITS & 102-Band Spectrum
              </div>
            </div>
          </div>
        )}

        {/* Instant Floating Cosmic Star HUD (Live on Hover) */}
        {hoveredStar && (
          <div className="absolute top-4 left-4 max-w-[340px] w-full z-20 bg-[#0F1A34]/95 backdrop-blur-xl border border-cyan-400/60 rounded-2xl p-4 shadow-[0_0_30px_rgba(37,217,242,0.25)] text-slate-100 animate-fadeIn font-sans pointer-events-auto">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <div>
                  <span className="text-[10px] font-mono tracking-wider uppercase text-cyan-400 font-bold block">
                    Star Quick Look // Live Catalog
                  </span>
                  <h3 className="text-sm font-black text-white tracking-tight truncate max-w-[210px]" title={hoveredStar.name}>
                    {hoveredStar.name}
                  </h3>
                </div>
              </div>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase shrink-0 ${
                hoveredStar.isVip
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                  : hoveredStar.isPreset
                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                    : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
              }`}>
                {hoveredStar.isVip ? 'VIP Target' : hoveredStar.isPreset ? 'Active Sector' : 'SIMBAD Star'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400">Class / Type:</span>
                <span className="text-cyan-300 font-semibold text-right truncate max-w-[190px]" title={hoveredStar.type}>
                  {hoveredStar.type}
                </span>
              </div>

              {hoveredStar.spType && (
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Spectral Class:</span>
                  <span className="text-amber-300 font-mono font-bold">{hoveredStar.spType}</span>
                </div>
              )}

              {typeof hoveredStar.ra === 'number' && typeof hoveredStar.dec === 'number' && (
                <>
                  <div className="flex justify-between items-center text-slate-300 font-mono text-[11px]">
                    <span className="text-slate-400 font-sans">Decimal RA/DEC:</span>
                    <span className="text-slate-200">
                      {hoveredStar.ra.toFixed(4)}°, {hoveredStar.dec > 0 ? `+${hoveredStar.dec.toFixed(4)}` : hoveredStar.dec.toFixed(4)}°
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 font-mono text-[10px]">
                    <span className="text-slate-400 font-sans">J2000 Epoch:</span>
                    <span className="text-cyan-400/90">{raDecToSexagesimal(hoveredStar.ra, hoveredStar.dec).fullStr.replace('J2000 ', '')}</span>
                  </div>
                </>
              )}

              {(hoveredStar.pmra !== null && hoveredStar.pmra !== undefined && hoveredStar.pmdec !== null && hoveredStar.pmdec !== undefined) && (
                <div className="flex justify-between items-center text-slate-300 font-mono text-[10px]">
                  <span className="text-slate-400 font-sans">Proper Motion:</span>
                  <span className="text-amber-300/90">
                    μ: {Math.hypot(hoveredStar.pmra, hoveredStar.pmdec).toFixed(1)} mas/yr
                  </span>
                </div>
              )}

              {hoveredStar.plx > 0 && (
                <div className="flex justify-between items-center text-slate-300 font-mono text-[10px]">
                  <span className="text-slate-400 font-sans">Parallax / Dist:</span>
                  <span className="text-emerald-300">
                    {(1000 / hoveredStar.plx * 3.26156).toFixed(1)} ly ({hoveredStar.plx.toFixed(2)} mas)
                  </span>
                </div>
              )}
            </div>

            {/* Quick Action to Run Discovery Pipeline */}
            <div className="mt-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  if (hoveredStar.isVip && hoveredStar.rawObj?.data?.targetData?.id) {
                    onSelectTarget(hoveredStar.rawObj.data.targetData.id);
                  } else if (typeof hoveredStar.ra === 'number' && typeof hoveredStar.dec === 'number') {
                    onFreeSkyClick(hoveredStar.ra, hoveredStar.dec, hoveredStar.name);
                  }
                  onAutoScroll?.();
                  const targetDeck = document.getElementById('time-travel');
                  if (targetDeck) {
                    targetDeck.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-cyan-400 to-[#8B5CF6] hover:brightness-110 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(37,217,242,0.4)] cursor-pointer active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 fill-slate-950 shrink-0" />
                <span>Click to Run 3-Pillar Pipeline ↓</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Star Info Card (Selected VIP Target) */}
        {activeTarget && showPopup && (
          <div className="absolute top-4 right-4 max-w-[320px] w-full z-20 bg-[#0F1A34]/95 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-4 shadow-2xl text-slate-100 animate-fadeIn font-sans">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {formatTargetName(activeTarget.name || activeTarget.nombre, activeTarget.id)}
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
                <span className="text-cyan-300 font-semibold">{formatTargetType(activeTarget.type, activeTarget.id)}</span>
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

            {(activeTarget.description || activeTarget.id) && (
              <p className="text-[11px] text-slate-300 mt-2.5 pt-2 border-t border-white/10 leading-relaxed">
                {formatTargetDescription(activeTarget.description, activeTarget.id)}
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
