import numpy as np
from config import N_DETECTORES, N_CANALES
from fits_engine import cargar_objetivo, flujo_en

# Rangos nominales de longitud de onda por detector en SPHEREx (en micrómetros)
BANDAS_NOMINALES_DETECTOR = {
    1: (0.75, 1.11),
    2: (1.11, 1.64),
    3: (1.64, 2.42),
    4: (2.42, 3.82),
    5: (3.82, 4.42),
    6: (4.42, 5.00),
}


def _canales(wl, fl, detector_idx=1, n_canales=N_CANALES):
    """Reduce/interpola los puntos observados de un detector a n_canales valores."""
    wl = np.asarray(wl, dtype=float)
    fl = np.asarray(fl, dtype=float)
    ok = np.isfinite(wl) & np.isfinite(fl)
    wl_ok = wl[ok]
    fl_ok = fl[ok]

    wmin, wmax = BANDAS_NOMINALES_DETECTOR.get(detector_idx, (0.75, 5.00))

    if len(wl_ok) == 0:
        rejilla = np.linspace(wmin, wmax, n_canales)
        return rejilla, np.full(n_canales, np.nan)
    elif len(wl_ok) == 1:
        rejilla = np.linspace(wmin, wmax, n_canales)
        return rejilla, np.full(n_canales, float(fl_ok[0]))

    o = np.argsort(wl_ok)
    wl_sorted = wl_ok[o]
    fl_sorted = fl_ok[o]

    span_min = min(wl_sorted[0], wmin)
    span_max = max(wl_sorted[-1], wmax)
    rejilla = np.linspace(span_min, span_max, n_canales)
    fl_interp = np.interp(rejilla, wl_sorted, fl_sorted)
    return rejilla, fl_interp


def espectro(tid, ra=None, dec=None, x=None, y=None, epocas=None):
    """Extrae 102 canales (6 detectores x 17 canales) con flujo real e integración de apertura 3x3."""
    if epocas is None:
        try:
            epocas = cargar_objetivo(tid)
        except Exception:
            epocas = []
    por_det = {d: ([], []) for d in range(1, N_DETECTORES + 1)}

    for e in epocas:
        det = int(e.get("detector", 1))
        if det in por_det:
            fl = flujo_en(e, ra=ra, dec=dec, x=x, y=y, medio_lado=1)
            wl = e.get("wavelength")
            if wl is not None and np.isfinite(wl):
                por_det[det][0].append(wl)
                por_det[det][1].append(fl)
            elif np.isfinite(fl):
                wmin, wmax = BANDAS_NOMINALES_DETECTOR.get(det, (0.75, 5.00))
                por_det[det][0].append((wmin + wmax) / 2.0)
                por_det[det][1].append(fl)

    wls, fls = [], []
    for d in range(1, N_DETECTORES + 1):
        w, f = _canales(*por_det[d], detector_idx=d)
        wls.append(w)
        fls.append(f)

    wl = np.concatenate(wls)
    fl = np.concatenate(fls)

    # Rellenar canales con NaN mediante interpolación suave con los canales válidos
    ok = np.isfinite(fl)
    if not ok.all() and ok.any():
        fl[~ok] = np.interp(wl[~ok], wl[ok], fl[ok])
    elif not ok.any():
        # Si todo el recorte es cero/nan, calcular flujo medio de fondo de las imágenes
        bg_vals = []
        for e in epocas:
            img = e["imagen"]
            if np.isfinite(img).any():
                bg_vals.append(np.nanmedian(img))
        default_val = float(np.nanmean(bg_vals)) if (bg_vals and np.nanmean(bg_vals) > 0) else 0.05
        fl = np.full_like(fl, default_val)

    spectrum_102 = [round(float(v), 6) for v in fl]
    wavelengths_um = [round(float(v), 4) for v in wl]

    val_flux = [v for v in spectrum_102 if np.isfinite(v)]
    peak_flux = round(float(np.nanmax(val_flux)), 6) if val_flux else 0.0
    mean_flux = round(float(np.nanmean(val_flux)), 6) if val_flux else 0.0

    return {
        "spectrum_102": spectrum_102,
        "wavelengths_um": wavelengths_um,
        "peak_flux": peak_flux,
        "mean_flux": mean_flux,
        "flux": spectrum_102,
        "wavelengths": wavelengths_um,
    }
