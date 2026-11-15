#!/usr/bin/env python3
import astropy.units as u

COLECCIONES_SPHEREX = ['spherex_dr1', 'spherex_qr3']


def spherex(coord, radio=10):
    """Consulta imágenes de SPHEREx; prueba cada colección hasta hallar resultados.

    Devuelve (tabla, nombre_coleccion). Si no hay resultados, tabla vacía y None.
    """
    from astroquery.ipac.irsa import Irsa
    tabla = None
    for coleccion in COLECCIONES_SPHEREX:
        try:
            tabla = Irsa.query_sia(pos=(coord, radio * u.arcsec), collection=coleccion)
        except Exception as e:
            print(f"[spherex] fallo consultando {coleccion}: {e}")
            continue
        if len(tabla) > 0:
            return tabla, coleccion
    return tabla, None


def gaia(coord, radio=30):
    """Descarga el catálogo astrométrico de Gaia DR3."""
    from astroquery.gaia import Gaia
    return Gaia.cone_search_async(coordinate=coord, radius=radio * u.arcsec).get_results()


def wise(coord, fov=176):
    """Descarga recortes FITS de WISE (bandas W1 y W2)."""
    from astroquery.skyview import SkyView
    return SkyView.get_images(position=coord, survey=['WISE 3.4', 'WISE 4.6'], radius=fov * u.arcsec)
