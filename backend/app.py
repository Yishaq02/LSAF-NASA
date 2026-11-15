import base64
from io import BytesIO
import shutil
import sys
import time
from pathlib import Path
from typing import Literal

import numpy as np
from PIL import Image
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask

import config
import fits_engine
import spectra
import diff as dif
import video
import gaia_check
import explorer_engine
from explorer_engine import matrix_to_base64_png
from fits_engine import cargar_objetivo

sys.path.append(str(Path(__file__).resolve().parent.parent))
sys.path.append(str(Path(__file__).resolve().parent))
import spherex_real_loader  # noqa: E402

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"

EPOCAS_AUTOMATICAS = 12
TIMEOUT_DESCARGA_SEG = 15

ALIAS_MAP = {
    "wise_0855": "wise0855",
    "rw_aurigae": "rwaur",
    "r_draconis": "rdra",
}

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
    "wise0855": {
        "name": "WISE 0855-0714",
        "type": "Sub-enana Marron (Y)",
        "distance_ly": 7.27,
        "description": "Uno de los objetos mas frios conocidos fuera del sistema solar.",
    },
    "wise_0855": {
        "name": "WISE 0855-0714",
        "type": "Sub-enana Marron (Y)",
        "distance_ly": 7.27,
        "description": "Uno de los objetos mas frios conocidos fuera del sistema solar.",
    },
    "rwaur": {
        "name": "RW Aurigae",
        "type": "Estrella Variable (T Tauri)",
        "distance_ly": 450.0,
        "description": "Estrella joven con variaciones de brillo drastica causadas por interacciones con su disco protoplanetario.",
    },
    "rw_aurigae": {
        "name": "RW Aurigae",
        "type": "Estrella Variable (T Tauri)",
        "distance_ly": 450.0,
        "description": "Estrella joven con variaciones de brillo drastica causadas por interacciones con su disco protoplanetario.",
    },
    "rdra": {
        "name": "R Draconis",
        "type": "Estrella Variable tipo Mira",
        "distance_ly": 2500.0,
        "description": "Estrella gigante roja pulsante. Su radio y luminosidad cambian radicalmente en periodos de meses.",
    },
    "r_draconis": {
        "name": "R Draconis",
        "type": "Estrella Variable tipo Mira",
        "distance_ly": 2500.0,
        "description": "Estrella gigante roja pulsante. Su radio y luminosidad cambian radicalmente en periodos de meses.",
    },
}

app = FastAPI(title="SPHEREx backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if FRONTEND.is_dir():
    app.mount("/ui", StaticFiles(directory=FRONTEND), name="ui")

    if (FRONTEND / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")

    @app.get("/aladin.js")
    def aladin_script():
        return FileResponse(FRONTEND / "aladin.js")

    @app.get("/")
    def home():
        return FileResponse(FRONTEND / "index.html")


def _norm_tid(tid: str) -> str:
    return ALIAS_MAP.get(tid, tid) if tid else tid


def _target(tid, ra: float | None = None, dec: float | None = None):
    tid = _norm_tid(tid)
    t = config.get_target(tid)
    if not t:
        if tid and any(tid.startswith(p) for p in ("click_", "custom_", "cutout_")):
            # Extraer RA y DEC de ID dinámico
            clean = tid.replace("click_", "").replace("custom_", "").replace("cutout_", "")
            parts = clean.split("_")
            try:
                ra_f = float(parts[0].replace("m", "-"))
                dec_f = float(parts[1].replace("m", "-"))
            except Exception:
                ra_f = ra or 0.0
                dec_f = dec or 0.0
            return {"id": tid, "nombre": tid, "ra": ra_f, "dec": dec_f}
        elif tid in ("sky", "free", "dynamic", None, ""):
            return {"id": "sky", "nombre": "Exploración Libre", "ra": ra or 0.0, "dec": dec or 0.0}
        raise HTTPException(404, f"Objetivo desconocido: {tid}")
    return t


def _epocas(tid, ra: float | None = None, dec: float | None = None):
    tid = _norm_tid(tid)
    # Si tid corresponde a una carpeta en data/ con FITS, cargar directamente
    if tid:
        p = config.DATA_DIR / tid
        if p.exists() and list(p.glob("*.fits")):
            try:
                return cargar_objetivo(tid)
            except Exception:
                pass

    t = _target(tid, ra=ra, dec=dec)
    ra_val = ra if ra is not None else t.get("ra", 0.0)
    dec_val = dec if dec is not None else t.get("dec", 0.0)

    # 1. Comprobar si cae dentro de algún FITS local
    matched_tid, ep = explorer_engine.buscar_fits_local_para_coordenada(ra_val, dec_val, preferred_tid=tid)
    if matched_tid and ep:
        return ep

    # 2. Carpeta destino para descarga
    target_folder = (
        tid
        if (tid and not tid.startswith("click_") and tid != "sky")
        else f"custom_{ra_val:.4f}_{dec_val:.4f}".replace(".", "_").replace("-", "m")
    )
    dest_dir = config.DATA_DIR / target_folder

    if dest_dir.exists() and list(dest_dir.glob("*.fits")):
        return cargar_objetivo(target_folder)

    # 3. Descarga remota real (IRSA con fallback a NASA SkyView)
    n, msg = explorer_engine.descargar_recortes_remotos(ra_val, dec_val, dest_dir, max_epocas=20)
    if n == 0:
        raise HTTPException(
            404, f"NASA no devolvió observaciones para RA {ra_val}, DEC {dec_val}: {msg}"
        )

    cargar_objetivo.cache_clear()
    return cargar_objetivo(target_folder)


def _num(v):
    """NaN/inf no son JSON válido: se publican como null."""
    return float(v) if v == v and abs(v) != float("inf") else None


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


def _target_id_para_click(ra, dec):
    return f"click_{ra:.4f}_{dec:.4f}".replace(".", "_").replace("-", "m")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/targets")
def targets():
    return config.cargar_targets()


@app.get("/api/targets")
def api_targets():
    out = []
    for t in config.cargar_targets():
        tid = t["id"]
        meta = VIP_META.get(tid, {})
        out.append({
            "id": tid,
            "name": meta.get("name", t.get("nombre", tid)),
            "ra": t["ra"],
            "dec": t["dec"],
            **meta,
        })
    return out


@app.get("/fits/{tid}")
def fits_index(tid: str):
    """Manifiesto de épocas con URL para el FITS original y para su PNG."""
    tid = _norm_tid(tid)
    _target(tid)
    ep = _epocas(tid)
    return {
        "target": tid,
        "count": len(ep),
        "epochs": [
            {
                "index": i,
                "archivo": e["archivo"],
                "detector": e["detector"],
                "mjd": e["mjd"],
                "wavelength": _num(e["wavelength"]),
                "fits_url": f"/fits/{tid}/{i}",
                "png_url": f"/fits/{tid}/{i}?format=png",
            }
            for i, e in enumerate(ep)
        ],
    }


@app.get("/fits/{tid}/{index}")
def fits_file(tid: str, index: int, format: Literal["fits", "png"] = "fits"):
    """Devuelve una época como FITS (por defecto) o como PNG estirado para el visor."""
    tid = _norm_tid(tid)
    _target(tid)
    ep = _epocas(tid)
    if not 0 <= index < len(ep):
        raise HTTPException(400, f"index fuera de rango: hay {len(ep)} épocas")
    e = ep[index]
    if format == "png":
        return Response(
            dif.a_png(video.normalizar(e["imagen"])), media_type="image/png"
        )
    ruta = fits_engine.DATA_DIR / tid / e["archivo"]
    if not ruta.exists():
        raise HTTPException(404, f"No existe {ruta}")
    return FileResponse(ruta, media_type="image/fits", filename=e["archivo"])


@app.post("/ingest/{tid}")
def ingest(
    tid: str,
    detector: int | None = None,
    max_epocas: int = Query(20, ge=1, le=100),
    ra: float | None = None,
    dec: float | None = None,
):
    """Descarga cutouts oficiales de SPHEREx (IRSA) a data/<tid>/ o data/custom_<ra>_<dec>/."""
    tid = _norm_tid(tid)
    t = _target(tid, ra=ra, dec=dec)
    ra_val = ra if ra is not None else t.get("ra", 0.0)
    dec_val = dec if dec is not None else t.get("dec", 0.0)

    target_dir = (
        tid
        if (tid and not tid.startswith("click_") and tid != "sky")
        else f"custom_{ra_val:.4f}_{dec_val:.4f}".replace(".", "_").replace("-", "m")
    )
    dest_path = config.DATA_DIR / target_dir
    dest_path.mkdir(parents=True, exist_ok=True)

    try:
        n, mensaje = spherex_real_loader.descargar_a_disco(
            f"{ra_val}deg",
            f"{dec_val}deg",
            dest_path,
            fov_arcsec=600,
            max_epocas=max_epocas,
            detector=detector if detector and detector > 0 else None,
        )
    except Exception as e:
        raise HTTPException(503, f"No se pudo descargar de IRSA: {e}")
    cargar_objetivo.cache_clear()
    return {"target": target_dir, "escritos": n, "mensaje": mensaje, "ra": ra_val, "dec": dec_val}


@app.get("/spectrum/{tid}")
def spectrum(
    tid: str,
    x: int | None = Query(None, ge=0),
    y: int | None = Query(None, ge=0),
    index: int = Query(0, ge=0),
    ra: float | None = None,
    dec: float | None = None,
):
    """Espectro de 102 canales del objetivo o del píxel (x, y) de la época `index`."""
    tid = _norm_tid(tid)
    t = _target(tid, ra=ra, dec=dec)
    ep = _epocas(tid, ra=ra, dec=dec)

    if (x is None) != (y is None):
        raise HTTPException(400, "Indica x e y juntos (o ninguno) para el píxel")

    if x is not None and y is not None:
        idx = min(max(0, index), len(ep) - 1) if ep else 0
        e = ep[idx]
        alto, ancho = e["imagen"].shape[:2]
        x_clamped = max(0, min(int(x), ancho - 1))
        y_clamped = max(0, min(int(y), alto - 1))

        try:
            cielo = e["wcs"].pixel_to_world(x_clamped, alto - 1 - y_clamped)
            ra_calc, dec_calc = float(cielo.ra.deg), float(cielo.dec.deg)
        except Exception:
            ra_calc, dec_calc = ra or t.get("ra", 0.0), dec or t.get("dec", 0.0)

        resolved_tid = t.get("id") or tid
        res = spectra.espectro(resolved_tid, x=x_clamped, y=y_clamped, ra=ra_calc, dec=dec_calc, epocas=ep)
        res["ra"] = ra_calc
        res["dec"] = dec_calc
        res["pixel_x"] = x_clamped
        res["pixel_y"] = y_clamped
        return res
    else:
        ra_target = ra if ra is not None else t.get("ra", 0.0)
        dec_target = dec if dec is not None else t.get("dec", 0.0)
        resolved_tid = t.get("id") or tid
        res = spectra.espectro(resolved_tid, ra=ra_target, dec=dec_target, epocas=ep)
        res["ra"] = ra_target
        res["dec"] = dec_target
        return res


@app.get("/diff/{tid}")
def diff(
    tid: str,
    a: int = -1,
    b: int = -2,
    detector: int = 1,
    sigma: float = Query(3.0, gt=0),
    ra: float | None = None,
    dec: float | None = None,
):
    """Epoca a (nueva) - epoca b (vieja) del mismo detector. Indices como en una lista Python."""
    tid = _norm_tid(tid)
    _target(tid, ra=ra, dec=dec)
    todas = _epocas(tid, ra=ra, dec=dec)
    ep = [e for e in todas if e["detector"] == detector]
    if len(ep) < 2:
        # Fallback a todas las épocas si no hay suficientes en ese detector
        ep = todas
    if len(ep) < 2:
        raise HTTPException(400, f"Se requieren al menos 2 épocas para restar (hay {len(ep)})")

    # Ajustar índices si vienen positivos o negativos
    idx_a = a if a < len(ep) else -1
    idx_b = b if b < len(ep) else -2
    try:
        nueva, vieja = ep[idx_a]["imagen"], ep[idx_b]["imagen"]
    except IndexError:
        nueva, vieja = ep[-1]["imagen"], ep[-2]["imagen"]

    m8 = dif.a_uint8(dif.diferencia(nueva, vieja, sigma))
    base64_str = dif.a_base64(m8)
    return {
        "shape": list(m8.shape),
        "png_base64": base64_str,
        "frame": base64_str,
        "image_url": f"data:image/png;base64,{base64_str}",
        "mjd_nueva": ep[idx_a]["mjd"],
        "mjd_vieja": ep[idx_b]["mjd"],
    }


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


@app.get("/export-mp4")
def export_mp4(
    target: str,
    mode: str = "normal",
    fps: int = 5,
    ra: float | None = None,
    dec: float | None = None,
):
    target = _norm_tid(target)
    if mode not in ("normal", "diff"):
        raise HTTPException(400, "mode debe ser 'normal' o 'diff'")
    if fps not in config.FPS_VALIDOS:
        raise HTTPException(400, f"fps debe ser uno de {config.FPS_VALIDOS}")

    t = _target(target, ra=ra, dec=dec)
    ra_val = ra if ra is not None else t.get("ra")
    dec_val = dec if dec is not None else t.get("dec")

    ep = []
    try:
        ep = _epocas(target, ra=ra_val, dec=dec_val)
    except Exception:
        if ra_val is not None and dec_val is not None:
            _, ep = explorer_engine.buscar_fits_local_para_coordenada(ra_val, dec_val)

    if not ep:
        try:
            ep = cargar_objetivo(target)
        except Exception:
            pass

    if not ep:
        raise HTTPException(400, f"No hay imágenes FITS disponibles para exportar video de {target}")

    try:
        ruta, tmp = video.generar_mp4(target, mode, fps, epocas=ep)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error generando MP4: {e}")
    return FileResponse(
        ruta,
        media_type="video/mp4",
        filename=f"{target}_{mode}.mp4",
        background=BackgroundTask(shutil.rmtree, tmp, ignore_errors=True),
    )


@app.get("/gaia-check")
def gaia(
    ra: float | None = None,
    dec: float | None = None,
    radius: float = 5.0,
    target: str | None = None,
):
    """Validación astrométrica real en vivo con Gaia DR3 por coordenadas o target."""
    if ra is None or dec is None:
        if target:
            target = _norm_tid(target)
            t = _target(target, ra=ra, dec=dec)
            ra, dec = t.get("ra"), t.get("dec")
    if ra is None or dec is None:
        raise HTTPException(400, "Indica ra y dec (o target)")
    try:
        return gaia_check.es_conocida(ra, dec, radius)
    except Exception as e:
        return {
            "known_star": False,
            "gaia_id": None,
            "pmra": None,
            "pmdec": None,
            "proper_motion_mas_yr": None,
            "parallax": None,
            "g_mag": None,
            "message": f"Servicio Gaia DR3 temporalmente no disponible: {e}",
            "known": False,
            "matched": False,
            "anomaly": False,
            "n": 0,
            "nearest_arcsec": None,
            "phot_g_mean_mag": None,
        }
