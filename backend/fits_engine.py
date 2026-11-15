"""Lectura de FITS locales con astropy. Un archivo = una exposicion de un detector."""

import warnings
import numpy as np
from functools import lru_cache
from astropy.io import fits
from astropy.wcs import WCS, FITSFixedWarning
from astropy.coordinates import SkyCoord
import astropy.units as u

from config import DATA_DIR


def wcs_de(header):
    """WCS celeste de una cabecera SPHEREx. Silencia el datfix benigno de DATE-OBS."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FITSFixedWarning)
        return WCS(header).celestial


def _leer(path):
    """Lee un FITS local. memmap=True evita cargarlo entero en memoria de golpe."""
    with fits.open(path, memmap=True) as hdul:
        ext = (
            "IMAGE"
            if "IMAGE" in hdul
            else next(
                i for i, h in enumerate(hdul) if h.data is not None and h.data.ndim == 2
            )
        )
        hdr = hdul[ext].header.copy()
        datos = np.array(hdul[ext].data, dtype=np.float32)
    return datos, hdr


def _extraer_mjd(hdr):
    """Extrae la fecha MJD de observacion desde MJD-OBS o DATE-OBS."""
    if "MJD-OBS" in hdr:
        try:
            return float(hdr["MJD-OBS"])
        except (ValueError, TypeError):
            pass
    if "DATE-OBS" in hdr:
        try:
            from astropy.time import Time
            return float(Time(str(hdr["DATE-OBS"])).mjd)
        except Exception:
            pass
    return 0.0


@lru_cache(maxsize=32)
def cargar_objetivo(tid):
    """Devuelve lista de epocas ordenadas por MJD, leidas de data/<tid>/.

    Es la unica fuente de verdad sobre los FITS locales: si no hay ficheros,
    lanza FileNotFoundError y quien llama decide (descargar de IRSA, error 404...).
    """
    carpeta = DATA_DIR / tid
    archivos = sorted(list(carpeta.glob("*.fits")) + list(carpeta.glob("*.fit")))
    if not archivos:
        raise FileNotFoundError(f"No hay FITS en {carpeta}")
    epocas = []
    for p in archivos:
        datos, hdr = _leer(p)
        mjd_val = _extraer_mjd(hdr)
        det_val = int(hdr.get("DETECTOR", 1))
        wl_val = float(hdr.get("WAVELEN", hdr.get("LAMBDA", np.nan)))
        epocas.append(
            {
                "archivo": p.name,
                "mjd": mjd_val,
                "detector": det_val,
                "wavelength": wl_val,
                "imagen": datos,
                "header": hdr,
                "wcs": wcs_de(hdr),
            }
        )
    epocas.sort(key=lambda e: e["mjd"])
    return epocas


def flujo_en(epoca, ra=None, dec=None, x=None, y=None, medio_lado=1):
    """Flujo real en una apertura de 3x3 (o medio_lado) ignorando NaNs."""
    img = epoca["imagen"]
    alto, ancho = img.shape[:2]

    if x is not None and y is not None:
        px, py = int(round(float(x))), int(round(float(y)))
    elif ra is not None and dec is not None:
        try:
            wcs = epoca.get("wcs") or wcs_de(epoca["header"])
            world = SkyCoord(float(ra) * u.deg, float(dec) * u.deg)
            px_f, py_f = wcs.world_to_pixel(world)
            px, py = int(round(float(px_f))), int(round(float(py_f)))
        except Exception:
            px, py = ancho // 2, alto // 2
    else:
        px, py = ancho // 2, alto // 2

    if not (0 <= py < alto and 0 <= px < ancho):
        return float("nan")

    # Apertura 3x3 ignorando NaNs
    sub = img[
        max(0, py - medio_lado) : min(alto, py + medio_lado + 1),
        max(0, px - medio_lado) : min(ancho, px + medio_lado + 1),
    ]
    if sub.size == 0 or not np.isfinite(sub).any():
        return float("nan")

    val = float(np.nanmean(sub))
    return val if np.isfinite(val) else float("nan")
