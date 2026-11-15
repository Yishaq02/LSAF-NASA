import base64
import io
import numpy as np
from PIL import Image


def _alinear(a, b):
    h, w = min(a.shape[0], b.shape[0]), min(a.shape[1], b.shape[1])
    return a[:h, :w], b[:h, :w]


def diferencia(nueva, vieja, sigma=3.0):
    """Nueva - Vieja; todo lo estatico (|d| < sigma*MAD) -> 0. Devuelve float32."""
    n, v = _alinear(np.nan_to_num(nueva), np.nan_to_num(vieja))
    d = n.astype(np.float32) - v.astype(np.float32)
    mad = np.median(np.abs(d - np.median(d))) * 1.4826
    umbral = sigma * (mad if mad > 0 else 1e-12)
    d[np.abs(d) < umbral] = 0.0
    return d


def a_uint8(m):
    """Normaliza a 0-255; el cero queda en negro (usa |m|)."""
    a = np.abs(m)
    mx = float(a.max())
    return (a / mx * 255).astype(np.uint8) if mx > 0 else np.zeros(a.shape, np.uint8)


def a_png(m8):
    buf = io.BytesIO()
    Image.fromarray(m8, "L").save(buf, "PNG")
    return buf.getvalue()


def a_base64(m8):
    return base64.b64encode(a_png(m8)).decode()
