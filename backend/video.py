import shutil
import subprocess
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image

from diff import diferencia, a_uint8
from fits_engine import cargar_objetivo


def normalizar(im):
    """Estira el contraste con ZScale robusto + asinh para realzar detalles tenues."""
    im = np.nan_to_num(im)
    med = float(np.median(im))
    mad = float(np.median(np.abs(im - med)))
    sigma = mad * 1.4826 if mad > 0 else float(im.std() or 1.0)
    lo = med - 2.0 * sigma
    hi = med + 8.0 * sigma
    lo = max(lo, float(np.percentile(im, 0.1)))
    hi = min(hi, float(np.percentile(im, 99.9)))
    if hi <= lo:
        lo, hi = float(im.min()), float(im.max()) or (lo + 1.0)
    x = np.clip((im - lo) / (hi - lo + 1e-12), 0.0, 1.0)
    a = 0.1
    out = np.arcsinh(x / a) / np.arcsinh(1.0 / a)
    return np.clip(out * 255.0, 0, 255).astype(np.uint8)


def frames(tid, modo, sigma=3.0, detector=1, epocas=None):
    if epocas is None:
        try:
            epocas = cargar_objetivo(tid)
        except Exception:
            epocas = []

    if not epocas:
        raise ValueError(f"No hay epocas disponibles para generar video de {tid}")

    imgs = [e["imagen"] for e in epocas if (e.get("detector") == detector or detector is None)]
    if not imgs:
        imgs = [e["imagen"] for e in epocas]

    if len(imgs) < 2 and modo == "diff":
        raise ValueError("Se necesitan al menos 2 epocas para diferencia")
    if modo == "diff":
        return [
            a_uint8(diferencia(imgs[i], imgs[i - 1], sigma))
            for i in range(1, len(imgs))
        ]
    return [normalizar(im) for im in imgs]


def generar_mp4(tid, modo, fps, epocas=None):
    """Devuelve (ruta_mp4, carpeta_temporal). El llamador debe borrar la carpeta."""
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg no esta instalado o no esta en el PATH")
    tmp = Path(tempfile.mkdtemp(prefix="mp4_"))
    try:
        fs = frames(tid, modo, epocas=epocas)
        h = min(f.shape[0] for f in fs) // 2 * 2
        w = min(f.shape[1] for f in fs) // 2 * 2
        for i, f in enumerate(fs):
            Image.fromarray(f[:h, :w], "L").save(tmp / f"frame_{i:03d}.png")
        salida = tmp / "salida.mp4"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-framerate",
                str(fps),
                "-i",
                str(tmp / "frame_%03d.png"),
                "-pix_fmt",
                "yuv420p",
                str(salida),
            ],
            check=True,
            capture_output=True,
        )
        return salida, tmp
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
