import json
import os
from pathlib import Path

BASE = Path(__file__).resolve().parent
# Carpeta con los FITS: data/<id_objetivo>/*.fits  (ajustable)
default_data = (BASE / "data") if (BASE / "data").is_dir() else (BASE.parent / "data")
DATA_DIR = Path(os.environ.get("FITS_DIR", default_data))
FPS_VALIDOS = (1, 2, 5, 10, 15, 20, 24, 30)
N_DETECTORES = 6
N_CANALES = 17  # 6 x 17 = 102


def cargar_targets():
    return json.loads((BASE / "targets.json").read_text(encoding="utf-8"))


def get_target(tid):
    for t in cargar_targets():
        if t["id"] == tid:
            return t
    return None
