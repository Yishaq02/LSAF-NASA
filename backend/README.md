<div align="center">

# ⚙️ LOOKING FOR STAR — Backend Architecture & Scientific API
### Motor de Telemetría Astrofísica, Espectroscopía de 102 Canales y Análisis Multiepocal

> Módulo central de procesamiento de datos astronómicos y API REST de alto rendimiento para el proyecto **LOOKING FOR STAR (SPHEREx Time-Domain Explorer)** en el marco del **NASA International Space Apps Challenge**.

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

## 🧭 Navegación entre Módulos

- [⬅️ Volver a la Documentación Principal (`../README.md`)](../README.md)
- [💻 Explorar la Documentación del Frontend (`../frontend/README.md`)](../frontend/README.md)

---

## 📑 Tabla de Contenidos

- [Visión General del Motor Backend](#-visión-general-del-motor-backend)
- [Fundamentos de Algoritmia Astrofísica](#-fundamentos-de-algoritmia-astrofísica)
  - [1. Lectura Eficiente de FITS (`memmap=True`)](#1-lectura-eficiente-de-fits-memmaptrue)
  - [2. Recortes Dinámicos WCS (`Cutout2D`)](#2-recortes-dinámicos-wcs-cutout2d)
  - [3. Detección de Movimiento Propio con NumPy (`MAD Sigma-Clipping`)](#3-detección-de-movimiento-propio-con-numpy-mad-sigma-clipping)
  - [4. Espectrometría de Apertura en 102 Canales Infrarrojos](#4-espectrometría-de-apertura-en-102-canales-infrarrojos)
  - [5. Síntesis y Normalización Visual (ZScale + asinh + FFmpeg)](#5-síntesis-y-normalización-visual-zscale--asinh--ffmpeg)
  - [6. Validación Cruzada con ESA Gaia DR3](#6-validación-cruzada-con-esa-gaia-dr3)
- [Estructura del Directorio `backend/`](#-estructura-del-directorio-backend)
- [Contrato Completo de la API (Endpoints REST)](#-contrato-completo-de-la-api-endpoints-rest)
- [Instalación, Entorno Virtual y Despliegue](#-instalación-entorno-virtual-y-despliegue)
- [Créditos de Ingeniería de Datos](#-créditos-de-ingeniería-de-datos)

---

## 🚀 Visión General del Motor Backend

El backend de **LOOKING FOR STAR** ha sido diseñado bajo una arquitectura de microservicios complementarios orientados a procesar telemetría espacial real sin recurrir a simulaciones o mocks sintéticos:

1. **`app.py` (Core SPHEREx Engine):** Servidor principal que expone los endpoints estándar para el frontend, administra la caché local de objetivos VIP (`barnard`, `wise0855`, `epsilon_indi_b`, `rwaur`, `rdra`, `plutino`), gestiona la descarga directa de cortes astronómicos desde NASA IRSA (`/ingest/{tid}`), extrae espectros pixelados y genera videos científicos MP4.
2. **`api_backend_buscador_din_mico.py` (Dynamic Sky Explorer v2.0):** Servicio especializado para coordenadas arbitrarias. Cuando un usuario hace clic sobre el planetario interactivo fuera de los objetivos precargados, este módulo resuelve las coordenadas $RA/DEC$, verifica si están cubiertas por FITS locales mediante WCS (`Cutout2D`) o descarga automáticamente mosaicos reales mediante protocolos SIA de IRSA o NASA SkyView.

---

## 🔬 Fundamentos de Algoritmia Astrofísica

### 1. Lectura Eficiente de FITS (`memmap=True`)
En astrofísica moderna, manipular archivos `.FITS` (*Flexible Image Transport System*) de cientos de megabytes puede saturar la memoria RAM. En `fits_engine.py`, la lectura se realiza implementando proyección de memoria directa:
```python
with fits.open(path, memmap=True) as hdul:
    ext = "IMAGE" if "IMAGE" in hdul else next(
        i for i, h in enumerate(hdul) if h.data is not None and h.data.ndim == 2
    )
    hdr = hdul[ext].header.copy()
    datos = np.array(hdul[ext].data, dtype=np.float32)
```
Esto permite acceder instantáneamente a matrices de píxeles y cabeceras astronómicas sin decodificar el archivo completo en memoria.

### 2. Recortes Dinámicos WCS (`Cutout2D`)
Para trasladar clics de pantalla a coordenadas astronómicas celestes ($RA, DEC$), el motor implementa el estándar WCS (*World Coordinate System*) de `astropy.wcs.WCS` y extrae submatrices exactas centradas en el objeto:
```python
coord = SkyCoord(ra * u.deg, dec * u.deg, frame="icrs")
cutout = Cutout2D(imagen, position=coord, size=(size_px, size_px), wcs=wcs)
```
Garantizando que las transformaciones de píxel a coordenadas ecuatoriales $ICRSd$ mantengan precisión submilisegundo de arco.

### 3. Detección de Movimiento Propio con NumPy (`MAD Sigma-Clipping`)
Para aislar candidatos a **Planeta X**, asteroides transneptunianos o estrellas de alto movimiento propio transversal, `diff.py` ejecuta una sustracción de épocas temporales:

$$\Delta I = I_{\text{nueva}} - I_{\text{vieja}}$$

Para aniquilar estrellas fijas de fondo y ruido instrumental sin eliminar la señal de movimiento, se calcula la Mediana de Desviaciones Absolutas (**MAD**):

$$\text{MAD} = \text{median}(|\Delta I - \text{median}(\Delta I)|) \times 1.4826$$
$$\text{Umbral} = \sigma \times \text{MAD}$$

Todos los píxeles con $|\Delta I| < \text{Umbral}$ se fuerzan a $0.0$, produciendo una imagen diferencial donde solo resaltan dipolos característicos de movimiento o variabilidad lumínica.

### 4. Espectrometría de Apertura en 102 Canales Infrarrojos
El telescopio espacial SPHEREx no utiliza una rendija espectral clásica, sino filtros lineales variables (**LVF**) distribuidos en 6 detectores ópticos (`B1` a `B6`). Cada detector muestrea 17 canales continuos:
- **Detector 1 (`B1`):** $0.75 - 1.11\,\mu\text{m}$ (Continuo estelar cercano al infrarrojo).
- **Detector 2 (`B2`):** $1.11 - 1.64\,\mu\text{m}$ (Fotosferas estelares).
- **Detector 3 (`B3`):** $1.64 - 2.42\,\mu\text{m}$ (Hielos de agua interestelar $H_2O$).
- **Detector 4 (`B4`):** $2.42 - 3.82\,\mu\text{m}$ (Compuestos orgánicos, hidrocarburos y metano $CH_4$).
- **Detector 5 (`B5`):** $3.82 - 4.42\,\mu\text{m}$ (Hielo de monóxido y dióxido de carbono $CO / CO_2$).
- **Detector 6 (`B6`):** $4.42 - 5.00\,\mu\text{m}$ (Infrarrojo térmico y cuerpos ultrafríos).

En `spectra.py`, el flujo de cada canal se obtiene mediante integración fotométrica en una apertura de $3 \times 3$ píxeles alrededor de la coordenada objetivo, interpolando sobre la rejilla física nominal de SPHEREx.

### 5. Síntesis y Normalización Visual (ZScale + asinh + FFmpeg)
Para convertir matrices de flujo en coma flotante con amplio rango dinámico a imágenes visibles de 8 bits sin quemar los núcleos estelares:
1. Se aplica estiramiento **ZScale** para determinar los cortes inferior y superior basados en la dispersión $\sigma$.
2. Se aplica compresión no lineal con seno hiperbólico inverso ($\text{asinh}$):
   $$I_{\text{disp}} = \frac{\text{asinh}(x / 0.1)}{\text{asinh}(1.0 / 0.1)} \times 255$$
3. En `video.py`, las secuencias de épocas se envían a través de un pipe a **FFmpeg** codificando en H.264 (`yuv420p`) a tasas de $1, 2, 5, 10, 15, 20, 24$ o $30\,\text{fps}$.

### 6. Validación Cruzada con ESA Gaia DR3
En `gaia_check.py`, cada objetivo es contrastado en tiempo real contra el catálogo astrométrico óptico de **Gaia DR3** mediante consultas TAP / VizieR (`I/355/gaiadr3`). Si se halla una contraparte en un radio de $5''$, se devuelven su $G_{\text{mag}}$, paralaje y movimiento propio ($\mu_{\alpha}, \mu_{\delta}$). Si no existe contraparte óptica en Gaia pero la fuente emite vigorosamente en las bandas infrarrojas de SPHEREx, el sistema marca el objetivo con la bandera:
`anomaly: true` $\rightarrow$ **Candidato a Planeta X / Enana Marrón Ultrafría**.

---

## 📂 Estructura del Directorio `backend/`

```bash
backend/
├── api_backend_buscador_din_mico.py  # Servidor Dynamic Sky Explorer (FastAPI v2.0)
├── app.py                   # API REST Principal y despachador de objetivos VIP
├── config.py                # Rutas del sistema, mapeo de bandas y constantes
├── diff.py                  # Algoritmo NumPy de diferencia de épocas y umbral MAD
├── explorer_engine.py       # Motor dinámico de búsqueda en FITS locales y descargas IRSA
├── fetchers.py              # Funciones auxiliares de consulta a IRSA, Gaia y SkyView
├── fits_engine.py           # Abstracción de bajo nivel sobre astropy.io.fits y WCS
├── gaia_check.py            # Validador astrométrico contra el catálogo ESA Gaia DR3
├── requirements.txt         # Especificación de dependencias del entorno Python
├── spectra.py               # Algoritmo de extracción de espectro en 102 canales
├── spherex_real_loader.py   # Ingestor HTTP Range de FITS oficiales SPHEREx
├── start.sh                 # Script bash para levantar Uvicorn en el puerto 8000
├── targets.json             # Catálogo JSON de estrellas VIP con coordenadas RA/DEC
├── video.py                 # Generador de videos científicos MP4 mediante FFmpeg
├── README.md                # Este documento técnico de referencia
└── data/                    # Almacén estructurado de matrices FITS
    ├── barnard/             # 20+ épocas multitemporales de la Estrella de Barnard
    ├── wise0855/            # FITS de la sub-enana marrón WISE 0855-0714
    ├── epsilon_indi_b/      # FITS de la enana marrón binaria Epsilon Indi B
    ├── rwaur/               # FITS de la variable joven RW Aurigae
    ├── rdra/                # FITS de la gigante pulsante R Draconis
    ├── plutino/             # FITS de objeto transneptuniano
    ├── click_*/             # Recortes generados dinámicamente tras clics de usuario
    └── custom_*/            # Descargas automáticas de mosaicos IRSA
```

---

## 📡 Contrato Completo de la API (Endpoints REST)

Todos los endpoints responden con cabeceras CORS permisivas (`*`) y devuelven tipos de contenido MIME estándar (`application/json`, `image/png`, `video/mp4`, `image/fits`).

| Método | Ruta | Parámetros (Query / Body) | Formato Retorno | Descripción Técnica |
|---|---|---|---|---|
| `GET` | `/health` | Ninguno | `JSON` | Comprobación de salud (*health check*) para el Frontend Connection Boundary. |
| `GET` | `/targets` | Ninguno | `JSON` | Lista cruda de objetivos VIP definidos en `targets.json`. |
| `GET` | `/api/targets` | Ninguno | `JSON` | Catálogo VIP enriquecido con descripciones, tipos espectrales y distancias en años luz. |
| `GET` | `/fits/{tid}` | `tid` (path: ID del objetivo) | `JSON` | Manifiesto de épocas disponibles con MJD, detector, wavelength y URLs de descarga. |
| `GET` | `/fits/{tid}/{index}` | `tid`, `index` (int), `format` (`fits` \| `png`) | `image/fits` o `image/png` | Descarga el archivo FITS original o el frame renderizado en PNG con estiramiento ZScale. |
| `POST` | `/ingest/{tid}` | `tid` (path), `max_epocas` (int, default 20), `detector` (int), `ra` (float), `dec` (float) | `JSON` | Ingesta en vivo de cutouts oficiales SPHEREx desde NASA IRSA a disco local. |
| `GET` | `/spectrum/{tid}` | `tid`, `x` (int), `y` (int), `index` (int), `ra` (float), `dec` (float) | `JSON` | Espectro completo de 102 canales con longitud de onda ($\mu\text{m}$) y flujo calibrado. |
| `GET` | `/diff/{tid}` | `tid`, `a` (int), `b` (int), `detector` (int), `sigma` (float, default 3.0), `ra`, `dec` | `JSON` | Sustracción matricial NumPy ($\text{Época } A - \text{Época } B$) en Base64 con umbral MAD. |
| `POST` | `/api/explorar` | Body JSON: `{"ra": float, "dec": float, "mode": "normal"|"diff", "max_epocas": int}` | `JSON` | Búsqueda dinámica con Cutout2D WCS y descarga on-the-fly de cualquier coordenada. |
| `GET` | `/gaia-check` | `ra` (float), `dec` (float), `radius` (float, default 5.0), `target` (str) | `JSON` | Validación astrométrica en vivo contra ESA Gaia DR3 (detecta anomalías / Planeta X). |
| `GET` | `/export-mp4` | `target` (str), `mode` (`normal` \| `diff`), `fps` (int: 1-30), `ra`, `dec` | `video/mp4` | Genera y descarga un video MP4 codificado en H.264 de la serie temporal. |

---

### Ejemplos de Peticiones y Respuestas

#### 1. Ingesta y Consulta de Espectro (`GET /spectrum/barnard`)
```bash
curl -X GET "http://localhost:8000/spectrum/barnard" -H "Accept: application/json"
```
**Respuesta:**
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

#### 2. Sustracción Diferencial NumPy (`GET /diff/barnard?a=-1&b=-2&sigma=3.0`)
```bash
curl -X GET "http://localhost:8000/diff/barnard?a=-1&b=-2&detector=1&sigma=3.0"
```
**Respuesta:**
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

#### 3. Validación Astrométrica Gaia DR3 (`GET /gaia-check?ra=269.4521&dec=4.6933`)
```bash
curl -X GET "http://localhost:8000/gaia-check?ra=269.4521&dec=4.6933&radius=5.0"
```
**Respuesta:**
```json
{
  "known_star": true,
  "gaia_id": "Gaia DR3 4472832130942575872",
  "pmra": -801.551,
  "pmdec": 10362.394,
  "proper_motion_mas_yr": 10393.385,
  "parallax": 546.9759,
  "g_mag": 8.694,
  "message": "Fuente estelar confirmada en Gaia DR3 a 0.21\"",
  "anomaly": false,
  "nearest_arcsec": 0.21
}
```

---

## 🛠️ Instalación, Entorno Virtual y Despliegue

### Prerrequisitos del Sistema
- **Python**: Versión `3.10` o superior instalada.
- **FFmpeg**: Necesario para el endpoint de exportación de video `/export-mp4`.
  - En Ubuntu / Debian: `sudo apt-get install -y ffmpeg`
  - En macOS (Homebrew): `brew install ffmpeg`
  - En Windows: `winget install Gyan.FFmpeg` o descargar binario oficial.

### Paso a Paso para Despliegue Local

```bash
# 1. Ingresar al directorio del backend
cd LSAF-NASA/backend

# 2. Crear entorno virtual aislado
python3 -m venv venv

# 3. Activar el entorno virtual
# En Linux / macOS:
source venv/bin/activate
# En Windows (PowerShell):
# .\venv\Scripts\Activate.ps1

# 4. Actualizar gestor de paquetes e instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt

# 5. Ejecutar el servidor con recarga en caliente
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

---

## 👥 Créditos de Ingeniería de Datos

- **Diosdado**: Arquitectura de canalización de datos astrofísicos y lectura de telemetría FITS.
- **Rafa**: Integración de contratos REST, routing FastAPI y serialización NumPy.
- **Isaac Atilano Tobón ([@Yishaq02](https://github.com/Yishaq02))**: Supervisión arquitectónica y enlace con cliente Frontend.
