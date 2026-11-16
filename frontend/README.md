# SPHEREx Time-Domain Explorer (NASA Space Apps Challenge)
## Frontend de Producción Científica: React + Vite + Tailwind CSS + Lucide React + Recharts

Construido como **Principal Frontend Engineer** para el desafío de detección y análisis de fuentes infrarrojas variables, movimiento propio extremo y búsqueda de objetos ultrafríos (Candidatos a Planeta X / Enanas Marrones Subestelares) utilizando datos de la misión espacial **SPHEREx** y catálogos de **Gaia DR3** y **NASA IRSA**.

---

### Regla Estricta de Arquitectura (Cero Mocks / Cero Simulaciones)
- **100% Backend Real**: La aplicación se conecta exclusivamente a `http://localhost:8000`. No existen mocks, arrays sintéticos, llamadas falsas con `setTimeout` ni canvas simulados.
- **Connection Boundary & Health Check**: Al arrancar, verifica `GET http://localhost:8000/health`. Si el backend está apagado o no responde `{"status":"ok"}`, se presenta una pantalla de bloqueo con diagnóstico del error y botón para reintentar la conexión.

---

### Módulos y Arquitectura del Sistema

```
FrontLFS/
├── index.html                     # Entrada HTML con fuentes Inter y JetBrains Mono
├── package.json                   # Dependencias oficiales (Vite, React, Tailwind, Recharts, Lucide)
├── postcss.config.js              # Configuración PostCSS
├── tailwind.config.js             # Configuración de tema Dark Espacial (slate-950, acentos cyan y amber)
├── vite.config.js                 # Servidor de desarrollo en puerto 5173
├── src/
│   ├── App.jsx                    # Orquestador del Dashboard Científico y sincronización en URL
│   ├── index.css                  # Estilos globales, animaciones y scrollbar personalizada
│   ├── main.jsx                   # Punto de montaje de React
│   ├── components/
│   │   ├── BackendConnectionBoundary.jsx  # Bloqueo y verificación de salud de FastAPI
│   │   ├── Header.jsx                     # Barra superior, selector VIP, ingesta IRSA y enlace compartible
│   │   ├── AladinLiteMap.jsx              # Integración Aladin Lite v3 (CDS Unistra) con Point & Click
│   │   ├── FlipbookViewer.jsx             # Visor temporal, Modo Diferencia NumPy, WiseView y MP4
│   │   ├── SpectrumChart.jsx              # Gráfica de 102 canales IR (0.75-5.00 μm) en Recharts
│   │   ├── GaiaValidationPanel.jsx        # Validación cruzada astrométrica Gaia DR3 (Alerta Planeta X)
│   │   ├── ActiveMetadataCard.jsx         # Conversión de coordenadas RA/DEC a HMS/DMS y metadatos
│   │   └── DeepLoadingOverlay.jsx         # Indicador de estado para descargas profundas en IRSA
│   └── services/
│       └── api.js                 # Capa HTTP estricta con todos los contratos de endpoints
```

---

### Contrato de Endpoints Consumidos (FastAPI en `http://localhost:8000`)

| Endpoint | Método | Descripción |
|---|---|---|
| `/health` | `GET` | Health check (`{"status":"ok"}`) |
| `/api/targets` o `/targets` | `GET` | Catálogo de 5 objetivos VIP (`barnard`, `epsilon_indi_b`, `wise_0855`, `rw_aurigae`, `r_draconis`) |
| `/fits/{tid}` | `GET` | Manifiesto de épocas FITS disponibles para el objetivo |
| `/fits/{tid}/{index}?format=png` | `GET` | Fotograma PNG real de la época seleccionada para el Flipbook |
| `/ingest/{tid}` | `POST` | Dispara la descarga de recortes IRSA (`detector`, `max_epocas`) |
| `/diff/{tid}?a={a}&b={b}&detector={det}&sigma={sig}` | `GET` | Sustracción matemática NumPy de épocas |
| `/spectrum/{tid}?x={x}&y={y}&index={idx}&ra={ra}&dec={dec}` | `GET` | Espectro infrarrojo de 102 canales (centro o píxel inspeccionado) |
| `/api/explorar` | `POST` | Motor híbrido dinámico `{ ra, dec, target_id, mode }` con fotogramas Base64 y espectro |
| `/gaia-check` | `GET` | Validación cruzada con Gaia DR3 para corroborar movimiento propio o emitir alerta Planeta X |
| `/export-mp4?target={tid}&mode={mode}&fps={fps}` | `GET` | Generación y descarga binaria de animación de descubrimiento en `.mp4` |

---

### Ejecución y Compilación

1. **Instalación de Dependencias**:
   ```bash
   cd /home/sti/Desktop/FrontLFS
   npm install
   ```

2. **Iniciar Entorno de Desarrollo**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:5173](http://localhost:5173).

3. **Construir para Producción**:
   ```bash
   npm run build
   ```
   Los artefactos optimizados se generan en el directorio `dist/`.
