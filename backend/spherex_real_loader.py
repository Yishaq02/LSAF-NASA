#!/usr/bin/env python3
import io
import urllib.request
from pathlib import Path
import tempfile

import numpy as np
import astropy.units as u
from astropy.coordinates import SkyCoord
from astropy.io import fits

import fetchers


def _detector(nombre):
    """'SPHEREx-D6' -> 6; sin banda reconocible -> 1."""
    cola = str(nombre).rsplit("D", 1)[-1]
    return int(cola) if cola.isdigit() else 1


def _numero(valor, defecto=float("nan")):
    try:
        return float(valor)
    except (TypeError, ValueError):
        return defecto


def _seleccion_por_detector(resultados, max_epocas):
    """Reparte max_epocas entre detectores, muestreando todo el barrido."""
    indices = {}
    for i, fila in enumerate(resultados):
        indices.setdefault(_detector(fila["energy_bandpassname"]), []).append(i)
    cuota = max(1, max_epocas // len(indices))
    elegidos = []
    for idx in indices.values():
        if len(idx) > cuota:
            pos = np.linspace(0, len(idx) - 1, cuota).round().astype(int)
            elegidos.extend(idx[p] for p in dict.fromkeys(pos))
        else:
            elegidos.extend(idx)
    return resultados[sorted(elegidos)]


def _rango(url, inicio, fin):
    """Lee solo esos bytes con HTTP Range (IRSA lo soporta: 206)."""
    req = urllib.request.Request(url, headers={"Range": f"bytes={inicio}-{fin}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _cabecera(url, offset):
    h = fits.Header()
    for n in range(40):
        bloque = _rango(url, offset + n * 2880, offset + (n + 1) * 2880 - 1)
        for i in range(0, 2880, 80):
            card = bloque[i : i + 80].decode("ascii", "replace")
            if card[:3] == "END":
                return h, (n + 1) * 2880
            if card[8:10] == "= ":
                try:
                    h.append(fits.Card.fromstring(card))
                except Exception:
                    pass
    raise ValueError("cabecera FITS sin END")


def _tamano_datos(h):
    naxis = int(h.get("NAXIS", 0))
    if not naxis:
        return 0
    prod = 1
    for i in range(1, naxis + 1):
        prod *= int(h.get(f"NAXIS{i}", 0))
    return (
        abs(int(h.get("BITPIX", 8)))
        // 8
        * int(h.get("GCOUNT", 1))
        * (int(h.get("PCOUNT", 0)) + prod)
    )


_CALIB = {}


def _tabla_onda(url, detector):
    """Extensión WCS-WAVE (~3.6 KB) del L2 completo, sin bajar los ~66 MB."""
    if detector in _CALIB:
        return _CALIB[detector]
    offset = 0
    for _ in range(20):
        h, hlen = _cabecera(url, offset)
        fin = offset + hlen + ((_tamano_datos(h) + 2879) // 2880) * 2880
        if h.get("EXTNAME") == "WCS-WAVE":
            trozo = _rango(url, offset, fin - 1)
            prim = fits.PrimaryHDU().header.tostring().encode()
            with fits.open(io.BytesIO(prim + trozo)) as hdul:
                t = hdul[1].data
                _CALIB[detector] = (t["X"][0], t["Y"][0], t["VALUES"][0][:, :, 0])
                return _CALIB[detector]
        offset = fin
    raise ValueError("sin extensión WCS-WAVE")


def _onda_en_pixel(calib, x, y):
    """Interpola la longitud de onda (µm) en el grid 9x9 del detector."""
    X, Y, V = calib
    x = float(np.clip(x, X[0], X[-1]))
    y = float(np.clip(y, Y[0], Y[-1]))
    i = max(0, min(int(np.searchsorted(X, x)) - 1, len(X) - 2))
    j = max(0, min(int(np.searchsorted(Y, y)) - 1, len(Y) - 2))
    tx = (x - X[i]) / (X[i + 1] - X[i])
    ty = (y - Y[j]) / (Y[j + 1] - Y[j])
    return float(
        V[j, i] * (1 - tx) * (1 - ty)
        + V[j, i + 1] * tx * (1 - ty)
        + V[j + 1, i] * (1 - tx) * ty
        + V[j + 1, i + 1] * tx * ty
    )


def _pixel_plano(header):
    """Centro del recorte en coordenadas del detector completo (WCS 'A')."""
    x = (
        header["CRVAL1A"]
        + ((header["NAXIS1"] + 1) / 2 - header["CRPIX1A"]) * header["CDELT1A"]
    )
    y = (
        header["CRVAL2A"]
        + ((header["NAXIS2"] + 1) / 2 - header["CRPIX2A"]) * header["CDELT2A"]
    )
    return float(x), float(y)


def obtener_recortes_reales_spherex(
    ra_str, dec_str, fov_arcsec=90, max_epocas=102, detector=None, timeout_seg=None, **kwargs
):
    """Busca y descarga recortes de SPHEREx en IRSA para una coordenada.

    Devuelve (lista_de_recortes, mensaje). Cada recorte incluye su DETECTOR.
    """
    coord = SkyCoord(ra_str, dec_str, frame="icrs")

    try:
        resultados, coleccion = fetchers.spherex(coord, radio=fov_arcsec)
    except Exception as e:
        return [], f"Error conectando a IRSA: {e}"

    if resultados is None:
        return [], "Error conectando a IRSA (sin respuesta)."

    if not coleccion:
        return [], "No se encontraron observaciones de SPHEREx en estas coordenadas."

    tiene_banda = "energy_bandpassname" in resultados.colnames
    if detector is not None and tiene_banda:
        resultados = resultados[
            [_detector(f["energy_bandpassname"]) == detector for f in resultados]
        ]

    # Ordenar por fecha para crear la línea temporal
    for col in ("t_min", "mjd_obs"):
        if col in resultados.colnames:
            resultados.sort(col)
            break
    else:
        print("[spherex] aviso: sin columna de fecha; no se ordena cronológicamente.")

    if detector is None and tiene_banda:
        resultados = _seleccion_por_detector(resultados, max_epocas)

    # Recorte en servidor (con unidades explícitas) para evitar bajar ~100 MB por archivo
    tamano = f"{fov_arcsec / 3600.0}deg"
    centro = f"{coord.ra.deg},{coord.dec.deg}deg"

    recortes = []
    for fila in resultados[:max_epocas]:
        url = f"{fila['access_url']}?center={centro}&size={tamano}"
        det = _detector(fila["energy_bandpassname"]) if tiene_banda else 1
        try:
            with fits.open(url, cache=True) as hdul:
                ext = "IMAGE" if "IMAGE" in hdul else 1
                datos = hdul[ext].data
                header = hdul[ext].header
                # La λ real del objetivo sale del WCS-WAVE, según su píxel
                # en el detector (cambia con cada barrido).
                try:
                    x, y = _pixel_plano(header)
                    wl = _onda_en_pixel(_tabla_onda(str(fila["access_url"]), det), x, y)
                except Exception:
                    wl = None
                if wl is None:
                    wl = header.get("WAVELEN", header.get("LAMBDA"))
                if wl in (None, "N/A"):
                    # Respaldo: banda nominal de la tabla SIA (metros).
                    try:
                        wl = float((fila["em_min"] + fila["em_max"]) / 2) * 1e6
                    except Exception:
                        wl = "N/A"
                recortes.append(
                    {
                        "imagen": np.nan_to_num(datos, nan=0.0),
                        "mjd": header.get("MJD-OBS", "Desconocida"),
                        "wavelength": wl,
                        "detector": det,
                        "header": header,
                    }
                )
        except Exception as e:
            print(f"[spherex] no se pudo leer {url}: {e}")

    return recortes, f"Se cargaron {len(recortes)} épocas de SPHEREx ({coleccion})."


def descargar_a_disco(
    ra_str, dec_str, destino, fov_arcsec=90, max_epocas=102, detector=None, timeout_seg=None, **kwargs
):
    """Descarga recortes oficiales de IRSA y los guarda como FITS en destino.

    Devuelve (n_escritos, mensaje). Los headers quedan con DETECTOR, MJD-OBS y
    WAVELEN para que fits_engine los agrupe como el resto del backend.
    """
    recortes, mensaje = obtener_recortes_reales_spherex(
        ra_str, dec_str, fov_arcsec, max_epocas, detector, timeout_seg=timeout_seg, **kwargs
    )
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    for r in recortes:
        header = r["header"].copy()
        mjd = _numero(r["mjd"])
        wl = _numero(r["wavelength"])
        header["DETECTOR"] = r["detector"]
        header["MJD-OBS"] = mjd if np.isfinite(mjd) else 0.0
        if np.isfinite(wl):
            header["WAVELEN"] = wl
        nombre = f"d{r['detector']}_{mjd if np.isfinite(mjd) else 0.0:.5f}.fits"
        with tempfile.NamedTemporaryFile(dir=destino, suffix=".fits", delete=False) as tmp:
            temporal = Path(tmp.name)
        try:
            fits.PrimaryHDU(r["imagen"].astype("float32"), header).writeto(
                temporal, overwrite=True
            )
            temporal.replace(destino / nombre)
        finally:
            temporal.unlink(missing_ok=True)
    return len(recortes), mensaje
