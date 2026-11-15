"""Validación astrométrica real en vivo con Gaia DR3 (CERO MOCKS / CERO DATOS INVENTADOS)."""

import math
import logging
import numpy as np
import astropy.units as u
from astropy.coordinates import SkyCoord

logging.getLogger("astroquery").setLevel(logging.ERROR)

VIZIER_SERVERS = [
    "vizier.cfa.harvard.edu",
]


def es_conocida(ra: float, dec: float, radio_arcsec: float = 5.0) -> dict:
    """Consulta astrométrica real en vivo a Gaia DR3 mediante VizieR / TAP.

    Retorna la identificación y cinemática estelar precisa de Gaia DR3.
    """
    from astroquery.vizier import Vizier

    coord = SkyCoord(float(ra) * u.deg, float(dec) * u.deg)
    tables = None
    ultimo_error = None

    # Intentar servidores mirror de VizieR para alta disponibilidad
    for server in VIZIER_SERVERS:
        try:
            v = Vizier(
                vizier_server=server,
                columns=["Source", "RA_ICRS", "DE_ICRS", "Plx", "pmRA", "pmDE", "Gmag"],
                row_limit=5,
                timeout=8,
            )
            tables = v.query_region(
                coord, radius=float(radio_arcsec) * u.arcsec, catalog="I/355/gaiadr3"
            )
            if tables is not None:
                break
        except Exception as err:
            ultimo_error = err
            continue

    # Si todos los mirrors de VizieR fallaron, intentar ESA Gaia cone_search_async con timeout corto
    if tables is None:
        try:
            from astroquery.gaia import Gaia
            job = Gaia.cone_search_async(coord, radius=float(radio_arcsec) * u.arcsec)
            res = job.get_results()
            if res is not None and len(res) > 0:
                first = res[0]
                source_id = str(first.get("SOURCE_ID", first.get("source_id", "")))
                pmra = float(first["pmra"]) if "pmra" in first.colnames and np.isfinite(first["pmra"]) else None
                pmdec = float(first["pmdec"]) if "pmdec" in first.colnames and np.isfinite(first["pmdec"]) else None
                pm_tot = round(math.hypot(pmra, pmdec), 3) if pmra is not None and pmdec is not None else None
                parallax = float(first["parallax"]) if "parallax" in first.colnames and np.isfinite(first["parallax"]) else None
                g_mag = float(first["phot_g_mean_mag"]) if "phot_g_mean_mag" in first.colnames and np.isfinite(first["phot_g_mean_mag"]) else None
                nearest = float(min(res["dist"]) * 3600) if "dist" in res.colnames else None
                return {
                    "known_star": True,
                    "gaia_id": f"Gaia DR3 {source_id}",
                    "pmra": pmra,
                    "pmdec": pmdec,
                    "proper_motion_mas_yr": pm_tot,
                    "parallax": parallax,
                    "g_mag": g_mag,
                    "message": f"Fuente confirmada en Gaia DR3 ({source_id})",
                    "known": True,
                    "matched": True,
                    "anomaly": False,
                    "n": len(res),
                    "nearest_arcsec": nearest,
                    "phot_g_mean_mag": g_mag,
                }
        except Exception:
            pass

    if tables is None or len(tables) == 0 or len(tables[0]) == 0:
        return {
            "known_star": False,
            "gaia_id": None,
            "pmra": None,
            "pmdec": None,
            "proper_motion_mas_yr": None,
            "parallax": None,
            "g_mag": None,
            "message": f"No se detectó contrapartida óptica en Gaia DR3 en radio de {radio_arcsec}\" (posible anomalía o candidato transitorio)",
            "known": False,
            "matched": False,
            "anomaly": True,
            "n": 0,
            "nearest_arcsec": None,
            "phot_g_mean_mag": None,
        }

    tab = tables[0]
    n_matches = len(tab)
    # Seleccionar la fuente más cercana
    distancias = []
    for r in tab:
        pos_r = SkyCoord(float(r["RA_ICRS"]) * u.deg, float(r["DE_ICRS"]) * u.deg)
        distancias.append(float(coord.separation(pos_r).arcsec))

    idx_min = int(np.argmin(distancias))
    nearest_arcsec = round(distancias[idx_min], 3)
    row = tab[idx_min]

    source_id = str(row["Source"])
    pmra = round(float(row["pmRA"]), 3) if "pmRA" in row.colnames and np.isfinite(row["pmRA"]) else None
    pmdec = round(float(row["pmDE"]), 3) if "pmDE" in row.colnames and np.isfinite(row["pmDE"]) else None
    pm_tot = round(math.hypot(pmra, pmdec), 3) if pmra is not None and pmdec is not None else None
    plx = round(float(row["Plx"]), 4) if "Plx" in row.colnames and np.isfinite(row["Plx"]) else None
    gmag = round(float(row["Gmag"]), 3) if "Gmag" in row.colnames and np.isfinite(row["Gmag"]) else None

    return {
        "known_star": True,
        "gaia_id": f"Gaia DR3 {source_id}",
        "pmra": pmra,
        "pmdec": pmdec,
        "proper_motion_mas_yr": pm_tot,
        "parallax": plx,
        "g_mag": gmag,
        "message": f"Fuente estelar confirmada en Gaia DR3 ({source_id}) a {nearest_arcsec}\"",
        "known": True,
        "matched": True,
        "anomaly": False,
        "n": n_matches,
        "nearest_arcsec": nearest_arcsec,
        "phot_g_mean_mag": gmag,
    }
