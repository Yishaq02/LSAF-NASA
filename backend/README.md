<div align="center">

# ⚙️ LOOKING FOR STAR — Backend Architecture & Scientific API
### Astrophysical Telemetry Engine, 102-Channel Spectrophotometry & Time-Series Analytics

> High-throughput scientific computing backend and REST API engineered for the **LOOKING FOR STAR (SPHEREx Time-Domain Explorer)** project within the **NASA International Space Apps Challenge**.

---

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Uvicorn](https://img.shields.io/badge/Uvicorn-ASGI-499848?style=for-the-badge&logo=gunicorn&logoColor=white)](https://www.uvicorn.org/)
[![Astropy](https://img.shields.io/badge/Astropy-v6.0+-FF6F00?style=for-the-badge&logo=scipy&logoColor=white)](https://www.astropy.org/)
[![NumPy](https://img.shields.io/badge/NumPy-Array_Ops-013243?style=for-the-badge&logo=numpy&logoColor=white)](https://numpy.org/)
[![Astroquery](https://img.shields.io/badge/Astroquery-IVOA_TAP-0B3D91?style=for-the-badge&logo=nasa&logoColor=white)](https://astroquery.readthedocs.io/)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-H.264_MP4-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)
[![Swagger OpenAPI](https://img.shields.io/badge/OpenAPI-Interactive_Docs-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](http://localhost:8000/docs)

</div>

---

## 🧭 Navigation

- [⬅️ Back to Monorepo Root (`../README.md`)](../README.md)
- [💻 Explore Frontend Documentation (`../frontend/README.md`)](../frontend/README.md)

---

## 📑 Table of Contents

- [Backend Engine Architectural Overview](#-backend-engine-architectural-overview)
- [Astrophysical Algorithms & Pipeline Specifications](#-astrophysical-algorithms--pipeline-specifications)
  - [1. Memory-Mapped FITS Streaming (`memmap=True`)](#1-memory-mapped-fits-streaming-memmaptrue)
  - [2. WCS Astrometry & Dynamic `Cutout2D` Extraction](#2-wcs-astrometry--dynamic-cutout2d-extraction)
  - [3. NumPy Epoch Subtraction & MAD Sigma-Clipping](#3-numpy-epoch-subtraction--mad-sigma-clipping)
  - [4. 102-Channel Spectrophotometry ($3 \times 3$ Aperture Integration)](#4-102-channel-spectrophotometry-3-times-3-aperture-integration)
  - [5. Visual Synthesis (ZScale + asinh + FFmpeg H.264)](#5-visual-synthesis-zscale--asinh--ffmpeg-h264)
  - [6. Live Astrometric Cross-Matching with ESA Gaia DR3](#6-live-astrometric-cross-matching-with-esa-gaia-dr3)
- [Directory Hierarchy (`backend/`)](#-directory-hierarchy-backend)
- [Complete REST API Contract & Endpoint Reference](#-complete-rest-api-contract--endpoint-reference)
- [Installation, Virtual Environment & Deployment](#-installation-virtual-environment--deployment)
- [Data Engineering Credits](#-data-engineering-credits)

---

## 🚀 Backend Engine Architectural Overview

The backend for **LOOKING FOR STAR** is built on a modular, high-performance architecture operating with 100% genuine astronomical telemetry (zero mocks or synthetic arrays):

1. **`app.py` (Core SPHEREx Telemetry Service):** Primary REST API handling client sessions, serving pre-cached VIP benchmark targets (`barnard`, `wise0855`, `epsilon_indi_b`, `rwaur`, `rdra`, `plutino`), managing direct IRSA cutout downloads (`/ingest/{tid}`), executing on-the-fly spectral synthesis, and generating scientific MP4 video files.
2. **`api_backend_buscador_din_mico.py` (Dynamic Sky Explorer v2.0):** Microservice specialized in arbitrary celestial coordinate lookups. When an observer clicks on an uncataloged sector in the Aladin Lite planetarium, this engine converts screen coordinates to $RA/DEC$, checks local FITS footprints using Astropy WCS, or queries NASA IRSA / SkyView SIA endpoints in real time to ingest and process raw FITS data on-the-fly.

---

## 🔬 Astrophysical Algorithms & Pipeline Specifications

### 1. Memory-Mapped FITS Streaming (`memmap=True`)
Handling astronomical `.FITS` files containing millions of pixels requires efficient I/O. In `fits_engine.py`, the ingestion layer utilizes direct OS memory mapping:
```python
with fits.open(path, memmap=True) as hdul:
    ext = "IMAGE" if "IMAGE" in hdul else next(
        i for i, h in enumerate(hdul) if h.data is not None and h.data.ndim == 2
    )
    hdr = hdul[ext].header.copy()
    datos = np.array(hdul[ext].data, dtype=np.float32)
```
This enables instantaneous pixel slice access and header parsing without saturating RAM.

### 2. WCS Astrometry & Dynamic `Cutout2D` Extraction
To map screen interactions directly to celestial coordinates ($RA, DEC$), the engine implements the World Coordinate System (WCS) standard and extracts sub-arrays centered exactly on target sources:
```python
coord = SkyCoord(ra * u.deg, dec * u.deg, frame="icrs")
cutout = Cutout2D(imagen, position=coord, size=(size_px, size_px), wcs=wcs)
```
This preserves sub-milliarcsecond astrometric fidelity across epoch reprojections.

### 3. NumPy Epoch Subtraction & MAD Sigma-Clipping
To isolate transiting Solar System objects, extreme high proper motion stars, or candidate Planet X bodies, `diff.py` computes the temporal difference matrix between observation epochs:

$$\Delta I = I_{\text{new}} - I_{\text{old}}$$

To eliminate stationary background stars and instrumental noise while preserving real motion, the engine calculates the Median Absolute Deviation (**MAD**):

$$\text{MAD} = \text{median}(|\Delta I - \text{median}(\Delta I)|) \times 1.4826$$
$$\text{Threshold} = \sigma \times \text{MAD}$$

All pixels satisfying $|\Delta I| < \text{Threshold}$ are clamped to $0.0$, generating a pristine difference map revealing the characteristic motion dipole:

```
[Negative Hole (Epoch A)] <---- Motion Vector ----> [Positive Peak (Epoch B)]
```

### 4. 102-Channel Spectrophotometry ($3 \times 3$ Aperture Integration)
The SPHEREx observatory utilizes Linear Variable Filters (**LVF**) mounted across 6 distinct focal plane detectors (`B1` to `B6`), each delivering 17 continuous spectral bands:
- **Detector 1 (`B1`):** $0.75 - 1.11\,\mu\text{m}$ (Near-IR stellar continuum).
- **Detector 2 (`B2`):** $1.11 - 1.64\,\mu\text{m}$ (Stellar photospheres and continuum).
- **Detector 3 (`B3`):** $1.64 - 2.42\,\mu\text{m}$ (Interstellar water ice absorption $H_2O$).
- **Detector 4 (`B4`):** $2.42 - 3.82\,\mu\text{m}$ (Hydrocarbons, organics, and gaseous methane $CH_4$).
- **Detector 5 (`B5`):** $3.82 - 4.42\,\mu\text{m}$ (Solid carbon monoxide and dioxide $CO / CO_2$).
- **Detector 6 (`B6`):** $4.42 - 5.00\,\mu\text{m}$ (Thermal infrared and ultra-cool brown dwarfs).

In `spectra.py`, the flux for each channel is integrated within a calibrated $3 \times 3$ pixel aperture surrounding the coordinate centroid, followed by interpolation onto SPHEREx's physical wavelength grid.

### 5. Visual Synthesis (ZScale + asinh + FFmpeg H.264)
To map scientific floating-point data with dynamic ranges spanning multiple orders of magnitude into clear 8-bit displays without saturating stellar cores:
1. An astronomical **ZScale** algorithm computes optimal lower and upper cutoffs based on pixel variance $\sigma$.
2. An inverse hyperbolic sine ($\text{asinh}$) non-linear compression is applied:
   $$I_{\text{display}} = \frac{\text{asinh}(x / 0.1)}{\text{asinh}(1.0 / 0.1)} \times 255$$
3. In `video.py`, normalized epoch sequences are streamed via standard pipes to **FFmpeg**, rendering H.264 MP4 videos (`yuv420p`) at user-selected frame rates ($1, 2, 5, 10, 15, 20, 24, 30\,\text{fps}$).

### 6. Live Astrometric Cross-Matching with ESA Gaia DR3
In `gaia_check.py`, observed coordinates are cross-matched in real time against the **Gaia DR3** optical catalog (`I/355/gaiadr3`) via VizieR TAP and ESA Cone Search. When an optical counterpart exists within $5''$, its $G_{\text{mag}}$, parallax, and proper motion ($\mu_{\alpha}, \mu_{\delta}$) are extracted. If strong infrared emission is detected in SPHEREx but no optical source exists in Gaia DR3, the system triggers:
`anomaly: true` $\rightarrow$ **Candidate Planet X / Ultra-Cool Sub-Stellar Object**.

---

## 📂 Directory Hierarchy (`backend/`)

```bash
backend/
├── api_backend_buscador_din_mico.py  # Dynamic Sky Explorer service (FastAPI v2.0)
├── app.py                   # Core REST API & VIP target service
├── config.py                # System paths, detector mapping, and constants
├── diff.py                  # NumPy matrix difference & MAD thresholding algorithms
├── explorer_engine.py       # Dynamic Cutout2D extractor & on-the-fly IRSA fetcher
├── fetchers.py              # Astroquery wrappers for IRSA, Gaia, and SkyView
├── fits_engine.py           # Low-level memory-mapped FITS parser & WCS resolver
├── gaia_check.py            # Live astrometric cross-validator against ESA Gaia DR3
├── requirements.txt         # Production Python dependencies specification
├── spectra.py               # 102-channel spectral extraction & interpolation engine
├── spherex_real_loader.py   # HTTP Range / SIA client for official SPHEREx FITS
├── start.sh                 # Shell launcher for Uvicorn server on port 8000
├── targets.json             # Curated catalog of VIP astronomical targets
├── video.py                 # Scientific H.264 MP4 animator powered by FFmpeg
├── README.md                # This technical reference manual
└── data/                    # Astronomical FITS repository
    ├── barnard/             # Multi-epoch FITS series for Barnard's Star
    ├── wise0855/            # FITS cutouts for the Y-dwarf WISE 0855-0714
    ├── epsilon_indi_b/      # FITS cutouts for brown dwarf binary Epsilon Indi B
    ├── rwaur/               # FITS cutouts for T Tauri variable RW Aurigae
    ├── rdra/                # FITS cutouts for Mira-type pulsating variable R Draconis
    ├── plutino/             # FITS cutouts for Trans-Neptunian Object (TNO)
    ├── click_*/             # Dynamic cutouts generated from interactive user clicks
    └── custom_*/            # Automated on-the-fly IRSA SIA downloads
```

---

## 📡 Complete REST API Contract & Endpoint Reference

All endpoints include permissive Cross-Origin Resource Sharing (`CORS: *`) headers and return standardized MIME formats (`application/json`, `image/png`, `video/mp4`, `image/fits`).

| Method | Endpoint | Query / Body Parameters | Response MIME | Technical Description |
|---|---|---|---|---|
| `GET` | `/health` | None | `application/json` | System health check used by the Frontend Connection Boundary. |
| `GET` | `/targets` | None | `application/json` | Raw array of VIP targets from `targets.json`. |
| `GET` | `/api/targets` | None | `application/json` | Enriched VIP target catalog with descriptions, spectral types, and distances. |
| `GET` | `/fits/{tid}` | `tid` (path: Target identifier) | `application/json` | Manifest of available epochs including MJD, detector ID, wavelength, and image URLs. |
| `GET` | `/fits/{tid}/{index}` | `tid`, `index` (int), `format` (`fits` \| `png`) | `image/fits` or `image/png` | Downloads raw original FITS file or a ZScale-stretched 8-bit PNG frame. |
| `POST` | `/ingest/{tid}` | `tid`, `max_epocas` (int, default 20), `detector` (int), `ra` (float), `dec` (float) | `application/json` | Ingests live SPHEREx cutouts from NASA IRSA directly to local disk. |
| `GET` | `/spectrum/{tid}` | `tid`, `x` (int), `y` (int), `index` (int), `ra` (float), `dec` (float) | `application/json` | Extracts calibrated 102-channel infrared spectrum with wavelengths ($\mu\text{m}$) and flux. |
| `GET` | `/diff/{tid}` | `tid`, `a` (int), `b` (int), `detector` (int), `sigma` (float, default 3.0), `ra`, `dec` | `application/json` | Computes NumPy matrix subtraction ($\text{Epoch } A - \text{Epoch } B$) with MAD thresholding. |
| `POST` | `/api/explorar` | Body: `{"ra": float, "dec": float, "mode": "normal"|"diff", "max_epocas": int}` | `application/json` | Dynamic Cutout2D WCS search with automated fallback to live NASA IRSA downloads. |
| `GET` | `/gaia-check` | `ra` (float), `dec` (float), `radius` (float, default 5.0), `target` (str) | `application/json` | Live astrometric cross-match with ESA Gaia DR3 (detects Planet X anomalies). |
| `GET` | `/export-mp4` | `target` (str), `mode` (`normal` \| `diff`), `fps` (int: 1-30), `ra`, `dec` | `video/mp4` | Compiles and streams a scientific H.264 MP4 video of the multi-epoch sequence. |

---

### Request & Response Examples

#### 1. Ingest and Fetch 102-Channel Spectrum (`GET /spectrum/barnard`)
```bash
curl -X GET "http://localhost:8000/spectrum/barnard" -H "Accept: application/json"
```
**Response JSON:**
```json
{
  "target": "barnard",
  "ra": 269.4521,
  "dec": 4.6933,
  "total_canales": 102,
  "espectro": [
    { "canal": 1, "detector": 1, "wavelength_um": 0.75, "flujo": 142.508 },
    { "canal": 2, "detector": 1, "wavelength_um": 0.772, "flujo": 145.120 },
    "..."
  ]
}
```

#### 2. NumPy Matrix Subtraction (`GET /diff/barnard?a=-1&b=-2&sigma=3.0`)
```bash
curl -X GET "http://localhost:8000/diff/barnard?a=-1&b=-2&detector=1&sigma=3.0"
```
**Response JSON:**
```json
{
  "shape": [64, 64],
  "png_base64": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACA...",
  "frame": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACA...",
  "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACA...",
  "mjd_nueva": 61110.77038,
  "mjd_vieja": 60914.21253
}
```

#### 3. Gaia DR3 Astrometric Cross-Matching (`GET /gaia-check?ra=269.4521&dec=4.6933`)
```bash
curl -X GET "http://localhost:8000/gaia-check?ra=269.4521&dec=4.6933&radius=5.0"
```
**Response JSON:**
```json
{
  "known_star": true,
  "gaia_id": "Gaia DR3 4472832130942575872",
  "pmra": -801.551,
  "pmdec": 10362.394,
  "proper_motion_mas_yr": 10393.385,
  "parallax": 546.9759,
  "g_mag": 8.694,
  "message": "Confirmed stellar source in Gaia DR3 at 0.21\"",
  "anomaly": false,
  "nearest_arcsec": 0.21
}
```

---

## 🛠️ Installation, Virtual Environment & Deployment

### System Prerequisites
- **Python**: Version `3.10` or higher.
- **FFmpeg**: Required for the `/export-mp4` video generation endpoint.
  - Ubuntu / Debian: `sudo apt-get install -y ffmpeg`
  - macOS (Homebrew): `brew install ffmpeg`
  - Windows: `winget install Gyan.FFmpeg` or download official static build.

### Step-by-Step Setup

```bash
# 1. Enter the backend directory
cd LSAF-NASA/backend

# 2. Create an isolated virtual environment
python3 -m venv venv

# 3. Activate the virtual environment
# On Linux / macOS:
source venv/bin/activate
# On Windows (PowerShell):
# .\venv\Scripts\Activate.ps1

# 4. Upgrade pip and install scientific requirements
pip install --upgrade pip
pip install -r requirements.txt

# 5. Start the API service with hot-reloading
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

---

## 👥 Data Engineering Credits

- **Diosdado**: Astrophysical data pipelines, FITS telemetry ingestion, and aperture photometry.
- **Rafa**: REST API routing, FastAPI contract integration, and NumPy serialization.
- **Isaac Atilano Tobón ([@Yishaq02](https://github.com/Yishaq02))**: Software architecture oversight and frontend contract coordination.
