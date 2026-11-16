<div align="center">

# 🌌 LOOKING FOR STAR (LFS)
### SPHEREx Time-Domain & 102-Channel Infrared Spectral Explorer

> *"Every star has a story. Discover it."*

Plataforma de exploración y análisis astrofísico en el dominio temporal e infrarrojo desarrollada para el **NASA International Space Apps Challenge** (Desafío: *Planet X and SPHEREx*). Diseñada para la búsqueda, detección y validación de objetos transitorios, candidatos a Planeta X, enanas marrones ultrafrías y estrellas de alto movimiento propio a partir de telemetría científica real de la misión espacial **NASA SPHEREx**, archivos **NASA/IPAC IRSA** y el catálogo astrométrico **ESA Gaia DR3**.

---

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Astropy](https://img.shields.io/badge/Astropy-FF6F00?style=for-the-badge&logo=scipy&logoColor=white)](https://www.astropy.org/)
[![NumPy](https://img.shields.io/badge/NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white)](https://numpy.org/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite_5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Aladin Lite](https://img.shields.io/badge/Aladin_Lite_v3-0B3D91?style=for-the-badge&logo=nasa&logoColor=white)](https://aladin.cds.unistra.fr/AladinLite/)
[![NASA SPHEREx](https://img.shields.io/badge/NASA-SPHEREx_Mission-E03C31?style=for-the-badge&logo=nasa&logoColor=white)](https://spherex.caltech.edu/)
[![ESA Gaia](https://img.shields.io/badge/ESA-Gaia_DR3-003399?style=for-the-badge&logo=esa&logoColor=white)](https://www.cosmos.esa.int/web/gaia/data-release-3)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

---

## 📑 Tabla de Contenidos

- [Links Rápidos de Documentación](#-links-rápidos-de-documentación)
- [Visión General y Desafío Científico](#-visión-general-y-desafío-científico)
- [Arquitectura del Sistema y Flujo de Datos](#-arquitectura-del-sistema-y-flujo-de-datos)
- [Estructura Global del Repositorio](#-estructura-global-del-repositorio)
- [Objetivos Científicos VIP y Exploración Libre](#-objetivos-científicos-vip-y-exploración-libre)
- [Guía Rápida de Ejecución (Full-Stack Quick Start)](#-guía-rápida-de-ejecución-full-stack-quick-start)
- [Equipo de Desarrollo y Créditos](#-equipo-de-desarrollo-y-créditos)
- [Licencia y Agradecimientos](#-licencia-y-agradecimientos)

---

## 🔗 Links Rápidos de Documentación

Este ecosistema cuenta con documentación técnica exhaustiva y modularizada para cada capa de software:

| Módulo | Documentación Específica | Rol Tecnológico Principal |
|---|---|---|
| **Motor Backend** | [⚙️ Documentación Técnica Backend (`./backend/README.md`)](./backend/README.md) | FastAPI, Astropy WCS/Cutout2D, NumPy Sustracción Matricial, FFmpeg, TAP Gaia DR3 |
| **Cliente Frontend** | [💻 Documentación Técnica Frontend (`./frontend/README.md`)](./frontend/README.md) | React 18, Vite, Aladin Lite v3 (WebGL TAN), Recharts 102-Ch, Tailwind CSS CSDS |

---

## 🔭 Visión General y Desafío Científico

El desafío del **NASA International Space Apps Challenge (Track: Planet X and SPHEREx)** convoca a crear herramientas capaces de procesar la colosal riqueza espectral y temporal de la misión **SPHEREx** (*Spectro-Photometer for the History of the Universe, Epoch of Reionization, and Ices Explorer*).

### La Misión SPHEREx en Cifras
- **Cobertura Espectral**: 102 canales infrarrojos continuos desde $0.75\,\mu\text{m}$ hasta $5.00\,\mu\text{m}$.
- **Detectores LVF (*Linear Variable Filter*)**: 6 detectores independientes (`B1` a `B6`), cada uno subdividido en 17 canales fotométricos precisos.
- **Cadencia Temporal**: Mapeos multiepocales de todo el cielo para revelar movimiento propio, paralaje y variabilidad estelar/subestelar.

### Política Estricta: 100% Real Telemetry / Zero Mocks
A diferencia de demostradores con datos sintéticos, **LOOKING FOR STAR** opera bajo una regla de arquitectura estricta de **cero simulación**:
1. Cada imagen procesada proviene de matrices `.FITS` oficiales descargadas mediante protocolos IVOA / SIA desde **NASA/IPAC IRSA**.
2. Cada espectro se calcula pixel a pixel o mediante integración de apertura $3 \times 3$ con calibración WCS real.
3. Cada detección se somete a validación astrométrica cruzada en vivo contra el catálogo óptico **ESA Gaia DR3** para clasificar estrellas conocidas o disparar la bandera de **Candidato a Planeta X / Anomalía Subestelar** ante la ausencia de contraparte óptica.

---

## 🏛️ Arquitectura del Sistema y Flujo de Datos

El sistema sigue una arquitectura desacoplada y orientada a servicios de alto rendimiento científico:

```mermaid
flowchart TD
    subgraph UI["Frontend Layer (React 18 + Vite)"]
        AL["Aladin Lite v3\n(WebGL Gnomonic TAN)"]
        FB["Time-Travel Flipbook\n(ZScale / WiseView / MP4)"]
        SC["102-Channel Spectrometer\n(Recharts SVG Gradient B1-B6)"]
        GP["Gaia DR3 Validator\n(Planet X Anomaly Alert)"]
    end

    subgraph API["Backend Core (FastAPI @ localhost:8000)"]
        ROUTER["FastAPI REST Router\n(/diff, /spectrum, /api/explorar)"]
        FITS["Astropy FITS Engine\n(memmap=True, Cutout2D, WCS)"]
        DIFF["NumPy Difference Engine\n(Sigma-Clipping MAD Threshold)"]
        SPEC["102-Channel Spectral Integrator\n(3x3 Aperture Extraction)"]
        VID["FFmpeg Video Renderer\n(Scientific MP4 Export)"]
    end

    subgraph EXT["External Astronomical Archives"]
        IRSA["NASA/IPAC IRSA\n(SPHEREx DR1 & SIA Archive)"]
        GAIA["ESA Gaia DR3\n(VizieR TAP / Cone Search)"]
        CDS["CDS Strasbourg\n(2MASS & AllWISE HiPS)"]
    end

    AL -- "Point & Click (pix2world ICRSd)" --> ROUTER
    FB -- "Epoch Subtraction Request" --> ROUTER
    SC -- "Aperture / Pixel Inspection" --> ROUTER
    GP -- "Cross-Validation Query" --> ROUTER

    ROUTER --> FITS
    ROUTER --> DIFF
    ROUTER --> SPEC
    ROUTER --> VID

    FITS <--> IRSA
    DIFF <--> FITS
    SPEC <--> FITS
    ROUTER <--> GAIA
    AL <--> CDS
```

---

## 📂 Estructura Global del Repositorio

```bash
LSAF-NASA/
├── .gitignore                    # Reglas globales de exclusión Git (node_modules, venv, cache)
├── README.md                     # Documentación principal del ecosistema (este archivo)
├── backend/                      # Motor astrofísico en Python & FastAPI
│   ├── api_backend_buscador_din_mico.py  # Servidor Dynamic Sky Explorer v2.0
│   ├── app.py                   # API REST Core (SPHEREx Telemetry & Endpoints)
│   ├── config.py                # Configuración de rutas, detectores y canales
│   ├── diff.py                  # Algoritmo NumPy de sustracción y umbral MAD
│   ├── explorer_engine.py       # Motor dinámico de recortes Cutout2D y descargas en vivo
│   ├── fetchers.py              # Consultas astroquery a IRSA, Gaia y SkyView
│   ├── fits_engine.py           # Lectura FITS memmap y conversión de coordenadas WCS
│   ├── gaia_check.py            # Validación astrométrica en vivo contra ESA Gaia DR3
│   ├── requirements.txt         # Dependencias Python (astropy, fastapi, numpy, etc.)
│   ├── spectra.py               # Extracción e interpolación de los 102 canales
│   ├── spherex_real_loader.py   # Ingestor HTTP Range / SIA de FITS oficiales SPHEREx
│   ├── start.sh                 # Script Bash de arranque rápido de FastAPI
│   ├── targets.json             # Catálogo JSON de objetivos VIP precargados
│   ├── video.py                 # Renderizador de animación MP4 con FFmpeg
│   ├── README.md                # Documentación técnica detallada del Backend
│   └── data/                    # Almacén de matrices FITS (VIP y dinámicas)
│       ├── barnard/             # FITS multi-época de la Estrella de Barnard
│       ├── wise0855/            # FITS de la sub-enana marrón WISE 0855-0714
│       ├── epsilon_indi_b/      # FITS de la enana marrón Epsilon Indi B
│       ├── rwaur/               # FITS de la estrella variable T Tauri RW Aurigae
│       ├── rdra/                # FITS de la estrella gigante pulsante R Draconis
│       ├── plutino/             # FITS de objeto transneptuniano / Plutino
│       └── custom_*/            # Recortes astronómicos generados on-the-fly
└── frontend/                     # Aplicación Web React 18 + Vite + Tailwind CSS
    ├── index.html               # Entry point HTML con tipografías Inter y JetBrains Mono
    ├── package.json             # Dependencias (React, Vite, Recharts, Lucide, Tailwind)
    ├── package-lock.json        # Árbol exacto de dependencias de Node.js
    ├── postcss.config.js        # Configuración del pipeline PostCSS
    ├── tailwind.config.js       # Tokens de diseño cósmico y paleta espacial CSDS
    ├── vite.config.js           # Configuración del bundler Vite (puerto 5173)
    ├── DESIGN.md                # Cosmic Scientific Design System (CSDS Spec v3.0)
    ├── README.md                # Documentación técnica detallada del Frontend
    ├── public/                  # Activos estáticos
    │   └── aladin.js            # Librería Aladin Lite v3 optimizada
    └── src/                     # Código fuente de la interfaz
        ├── App.jsx              # Orquestador del Dashboard Científico y URL State Sync
        ├── index.css            # Estilos globales y personalización de scrollbars
        ├── main.jsx             # Punto de montaje React DOM
        ├── components/          # Componentes modulares de interfaz
        │   ├── ActiveMetadataCard.jsx        # Telemetría de coordenadas y conversiones HMS/DMS
        │   ├── AladinLiteMap.jsx             # Planetario interactivo Aladin Lite WebGL
        │   ├── BackendConnectionBoundary.jsx # Verificador de conexión viva con FastAPI
        │   ├── CornerReticle.jsx             # Retícula HUD científica espacial
        │   ├── DeepLoadingOverlay.jsx        # Pantalla de carga para ingestas profundas IRSA
        │   ├── FlipbookViewer.jsx            # Visor multi-época, WiseView, Diff y MP4
        │   ├── GaiaValidationPanel.jsx       # Panel de validación cruzada con Gaia DR3
        │   ├── Header.jsx                    # Barra superior, selector VIP y conmutador de modo
        │   └── SpectrumChart.jsx             # Espectrofotómetro de 102 canales Recharts
        └── services/
            └── api.js           # Capa de consumo HTTP estricta a http://localhost:8000
```

---

## 🎯 Objetivos Científicos VIP y Exploración Libre

El sistema cuenta con un catálogo precargado de objetivos de referencia seleccionados estratégicamente para validar cada capacidad del instrumental de SPHEREx:

| ID Objetivo | Nombre Común | Tipo Astrofísico | RA (J2000) | DEC (J2000) | Fenómeno Clave a Estudiar |
|---|---|---|---|---|---|
| `barnard` | **Estrella de Barnard** | Enana Roja ($M4.0V$) | `269.4521°` | `+4.6933°` | Mayor movimiento propio conocido ($10.3\,\text{arcsec/año}$). Prueba reina para el algoritmo de sustracción temporal. |
| `wise0855` | **WISE 0855-0714** | Sub-enana marrón ($Y$) | `133.7951°` | `-7.2451°` | Uno de los cuerpos subestelares más fríos fuera del sistema solar ($T \sim 250\,\text{K}$). Detección infrarroja pura. |
| `epsilon_indi_b` | **Epsilon Indi B** | Enana marrón binaria ($T$) | `331.0438°` | `-56.7828°` | Brillo infrarrojo ideal para calibración de bandas $B1-B6$ y absorción de metano ($CH_4$). |
| `rwaur` | **RW Aurigae** | Estrella joven ($T\text{ Tauri}$) | `76.9563°` | `+30.4014°` | Variaciones drásticas de brillo inducidas por polvo y gas en su disco protoplanetario. |
| `rdra` | **R Draconis** | Variable tipo Mira | `248.1675°` | `+66.7453°` | Gigante roja pulsante de largo período con enormes variaciones de radio y flujo térmico. |
| `plutino` | **Plutino / TNO** | Objeto Transneptuniano | `194.2200°` | `-11.4800°` | Detección de cuerpos helados en los confines del sistema solar con desplazamiento orbital observable. |

> **Exploración Libre (Deep Dynamic Search):** Al hacer clic en cualquier sector celeste dentro del mapa Aladin, el backend realiza una búsqueda de recortes locales o consulta en vivo a NASA IRSA, descargando los `.fits` de esa región y computando el espectro y animación multiepocales al vuelo.

---

## 🚀 Guía Rápida de Ejecución (Full-Stack Quick Start)

Para ejecutar la plataforma completa en tu entorno local, requiere **Python 3.10+**, **Node.js 18+** y **FFmpeg**.

### Terminal 1: Backend (FastAPI @ Puerto 8000)
```bash
# 1. Clonar el repositorio
git clone https://github.com/Yishaq02/LSAF-NASA.git
cd LSAF-NASA/backend

# 2. Crear y activar entorno virtual
python3 -m venv venv
source venv/bin/activate    # En Windows: venv\Scripts\activate

# 3. Instalar dependencias científicas
pip install -r requirements.txt

# 4. Iniciar el servidor Uvicorn
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```
*El backend quedará escuchando en `http://localhost:8000` con documentación interactiva en `http://localhost:8000/docs`.*

---

### Terminal 2: Frontend (React + Vite @ Puerto 5173)
```bash
# 1. Acceder al directorio del frontend
cd LSAF-NASA/frontend

# 2. Instalar paquetes de Node.js
npm install

# 3. Lanzar servidor de desarrollo Vite
npm run dev
```
*Abre tu navegador en `http://localhost:5173` para acceder a la experiencia cósmica interactiva.*

---

## 👥 Equipo de Desarrollo y Créditos

Proyecto desarrollado con pasión por la astrofísica y la ingeniería de software para el **NASA International Space Apps Challenge**:

- **Isaac Atilano Tobón ([@Yishaq02](https://github.com/Yishaq02))** — *Project Lead & Full-Stack / Frontend Architecture*
- **Alo** — *Frontend Co-Developer & UI/UX Implementation*
- **Diosdado** — *Backend & Astrophysics Data Engineering*
- **Rafa** — *Backend & API Integration*
- **Chávez** — *Scientific Research & Presentation Lead*

---

## 📜 Licencia y Agradecimientos

Este proyecto está bajo la licencia **MIT Open Source License**. Consulta el archivo `LICENSE` para mayores detalles.

### Agradecimientos Científicos e Institucionales
- **NASA Space Apps Challenge**: Por inspirar a las nuevas generaciones a crear soluciones innovadoras con datos abiertos.
- **NASA Jet Propulsion Laboratory (JPL) & Caltech**: Por los datos y especificaciones públicas del telescopio espacial **SPHEREx**.
- **NASA/IPAC Infrared Science Archive (IRSA)**: Por el servicio de acceso a imágenes (SIA) y catálogos de corte astronómico.
- **European Space Agency (ESA)**: Por el catálogo de alta precisión astrométrica **Gaia Data Release 3 (DR3)**.
- **Centre de Données astronomiques de Strasbourg (CDS)**: Por **Aladin Lite v3** y los mosaicos jerárquicos progresivos HiPS (2MASS y AllWISE).
