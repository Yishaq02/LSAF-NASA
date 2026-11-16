# LOOKING FOR STAR // Cosmic Scientific Design System (CSDS)
**Specification Document: LFS-V3.0-COSMIC**
**Brand Vision:** *"Every star has a story. Discover it."*
**Design Philosophy:** Modern Astronomical Discovery, Immersive Glassmorphism, Dual-Audience Interface (Beginner to Principal Investigator)

---

## 1. Executive Summary & Design Vision

**LOOKING FOR STAR** is an interactive, modern space-science discovery platform powered by open astrophysical telemetry from NASA SPHEREx ($0.75\,\mu\text{m} - 5.00\,\mu\text{m}$), NASA/IPAC IRSA, ESA Gaia DR3, and 2MASS/AllWISE surveys.

The platform balances high-fidelity astrophysics with accessible, inviting UX:
1. **Immersive Deep Space Canvas:** Rich deep-space blue canvas (`#080D1B`) with volumetric atmospheric glows (`#142B52` and `#8B5CF6/15`) providing extreme contrast for infrared images and colorful spectral curves.
2. **Cosmic Glassmorphism Panels:** Translucent galactic cards (`bg-[#142B52]/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl`) that create depth, hierarchy, and tactile elegance.
3. **Dual Exploration Modes:**
   - **Beginner Mode (Default):** Clean, friendly interface with intuitive educational guidance, hiding complex mathematical sliders and raw detector IDs while highlighting what makes each star special.
   - **Expert Mode:** Unlocks full scientific instrumentation, high-precision RA/DEC coordinates, FOV indicators, 6-detector filters, pixel matrix coordinates, and astrometric telemetry.
4. **100% English Global Interface:** Standardized English terminology for international researchers, educators, and astronomy enthusiasts.
5. **Zero Mocks & Zero Simulations:** 100% connected to live FastAPI endpoints (`http://localhost:8000`) and NASA IRSA / ESA Gaia registries.

---

## 2. Visual Palette & Semantic Tokens

### 2.1 Core Environment & Structural Canvas
| Token | Hex / Class | Purpose / Application |
|---|---|---|
| **Deep Space Blue** | `#080D1B` | Primary root canvas. Clean dark space background with ambient radial glows. |
| **Galactic Blue (Glass)** | `#142B52` (`/40`) | Semi-transparent card backings with `backdrop-blur-xl` and `border-white/10`. |
| **Cosmic Surface** | `#0F1A34` (`/70`) | Secondary container backgrounds, modal backdrops, and active toggle plates. |
| **Subtle Border** | `rgba(255,255,255,0.1)` | Crisp, ultra-thin border defining card boundaries without visual noise. |

### 2.2 Cosmic Accent Palette
| Accent | Hex Code | Semantic Role |
|---|---|---|
| **Bright Cyan** | `#25D9F2` | Primary brand accent, active navigation, B1 near-IR stellar band, interactive controls. |
| **Cosmic Violet** | `#8B5CF6` | Secondary brand glow, B3 water ice absorption ($1.64-2.42\,\mu\text{m}$), discovery tags. |
| **Stellar Magenta** | `#E879F9` | B4 organics & methane band ($2.42-3.82\,\mu\text{m}$), high proper motion badges. |
| **Solar Orange** | `#FFB45E` | B6 thermal IR / cold bodies ($4.42-5.00\,\mu\text{m}$), difference mode, warnings. |
| **Luminous White** | `#F5F7FF` | High-contrast primary headings, stellar labels, and active values. |
| **Gaia Green** | `#10B981` | Gaia DR3 confirmed star match, system nominal telemetry, nominal status. |

---

## 3. SPHEREx 6-Band Spectral Color Matrix
| Band | Wavelength Range | Color Token | Hex Code | Physical Astrophysical Tracer |
|---|---|---|---|---|
| **B1** | $0.75 - 1.11\,\mu\text{m}$ | Bright Cyan | `#25D9F2` | Near-IR Stellar Continuum |
| **B2** | $1.11 - 1.64\,\mu\text{m}$ | Stellar Blue | `#3B82F6` | Stellar Photosphere & Continuum |
| **B3** | $1.64 - 2.42\,\mu\text{m}$ | Cosmic Violet | `#8B5CF6` | Interstellar Water Ice ($H_2O$) |
| **B4** | $2.42 - 3.82\,\mu\text{m}$ | Stellar Magenta | `#E879F9` | Organics, Hydrocarbons & Methane |
| **B5** | $3.82 - 4.42\,\mu\text{m}$ | Carbon Amber | `#F97316` | Solid Carbon Monoxide & Dioxide ($CO / CO_2$) |
| **B6** | $4.42 - 5.00\,\mu\text{m}$ | Solar Orange | `#FFB45E` | Thermal Infrared / Ultra-Cool Sub-Stellar |

---

## 4. Aladin Lite v3 Configuration Standards
- **Projection:** Strictly fixed to `"TAN"` (Gnomonic Tangential projection). Never use `"SIN"`, `"MOL"`, or `"AIT"`.
- **Field of View (FOV):**
  - Default start: `1.5°` at Barnard's Star (`ra: 269.4521, dec: 4.6933`).
  - Target selection: `0.5°` for star-focused cutouts.
  - Galactic Center view: `15°` (safe wide-angle TAN view that never renders a black canvas).
  - Maximum allowable FOV: $\le 30°$.
- **Coordinate Frame:** `"ICRSd"` (Decimal degrees).
- **Default Survey:** `"CDS/P/2MASS/color"` with fast switch to `"CDS/P/allWISE/color"`.

---

## 5. UI Architecture & Smooth Navigation
- **Navigation Anchor Points:**
  - `#explore-universe`: Stage 1 — Sky exploration & star selector.
  - `#time-travel`: Stage 2 Left — Multi-epoch flipbook viewer & motion detector.
  - `#infrared-spectra`: Stage 2 Right Upper — 102-channel spectrophotometer.
  - `#gaia-validation`: Stage 2 Right Lower — ESA Gaia DR3 astrometric validation.
  - `#mission-data`: Stage 3 Footer — Open science provenance and missions.
