"""
Motor Backend de SPHEREx Time-Domain Explorer (datos reales).

Sirve los 5 objetivos VIP (FITS locales en data/<id>/) y descargas dinamicas
on-the-fly desde IRSA para clics en coordenadas arbitrarias.
"""

import sys
import time
import base64
from pathlib import Path

import numpy as np
from io import BytesIO
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# backend/ esta en sys.path al ejecutar desde backend/; la raiz para spherex_real_loader.
sys.path.append(str(Path(__file__).resolve().parent.parent))

import config
import fits_engine
import spectra
import spherex_real_loader
import explorer_engine
from explorer_engine import matrix_to_base64_png


app = FastAPI(title="SPHEREx Time-Domain API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Metadatos descriptivos de los 5 objetivos VIP (las coordenadas salen de config).
VIP_META = {
    "barnard": {
        "name": "Estrella de Barnard",
        "type": "Enana Roja (M4.0V)",
        "distance_ly": 5.96,
        "description": "Estrella con el mayor movimiento propio conocido. Ideal para probar algoritmos de deteccion de movimiento transversal en SPHEREx.",
    },
    "epsilon_indi_b": {
        "name": "Epsilon Indi B",
        "type": "Enana Marron Binaria",
        "distance_ly": 11.82,
        "description": "Sistema de dos enanas marrones. Su brillo infrarrojo es perfecto para analizar las 102 bandas del espectro de SPHEREx.",
    },
    "wise_0855": {
        "name": "WISE 0855-0714",
        "type": "Sub-enana Marron (Y)",
        "distance_ly": 7.27,
        "description": "Uno de los objetos mas frios conocidos fuera del sistema solar.",
    },
    "rw_aurigae": {
        "name": "RW Aurigae",
        "type": "Estrella Variable (T Tauri)",
        "distance_ly": 450.0,
        "description": "Estrella joven con variaciones de brillo drastica causadas por interacciones con su disco protoplanetario.",
    },
    "r_draconis": {
        "name": "R Draconis",
        "type": "Estrella Variable tipo Mira",
        "distance_ly": 2500.0,
        "description": "Estrella gigante roja pulsante. Su radio y luminosidad cambian radicalmente en periodos de meses.",
    },
}


class ExploreRequest(BaseModel):
    ra: float | None = None
    dec: float | None = None
    target_id: str | None = None
    mode: str = "normal"
    max_epocas: int = 20


def _frames_de_epocas(epocas, max_frames=20):
    out = []
    for e in epocas[:max_frames]:
        out.append(matrix_to_base64_png(e["imagen"]))
    return out


@app.get("/api/targets")
def get_vip_targets():
    """Objetivos VIP con coordenadas reales (config) + metadatos."""
    out = {}
    for t in config.cargar_targets():
        tid = t["id"]
        meta = VIP_META.get(tid, {})
        out[tid] = {
            "id": tid,
            "name": meta.get("name", t.get("nombre", tid)),
            "ra": t["ra"],
            "dec": t["dec"],
            **meta,
        }
    return out


@app.post("/api/explorar")
def explorar_coordenadas(req: ExploreRequest):
    """Motor dinámico de recortes WCS reales (Cutout2D) y descargas astronómicas en vivo."""
    try:
        return explorer_engine.explorar_coordenadas_core(
            ra=req.ra,
            dec=req.dec,
            target_id=req.target_id,
            mode=req.mode,
            max_epocas=req.max_epocas,
        )
    except FileNotFoundError as fnf:
        raise HTTPException(404, str(fnf))
    except ValueError as val:
        raise HTTPException(400, str(val))
    except Exception as e:
        raise HTTPException(500, f"Error en exploración dinámica: {e}")


# uvicorn api_backend_buscador_din_mico:app --reload
