"""ENTERGALACTIC: motor de efectos fotográficos."""
from . import core, registry  # noqa: F401
from . import filters_chroma, filters_plata, filters_analog, filters_clean, filters_realce, filters_cine, filters_pop  # noqa: F401
from .registry import FILTERS, run_stack, schema  # noqa: F401

# Filtros de otros módulos que también forman parte de la caja de herramientas de Cine.
for _fid in ("tonal_contrast", "brilliance", "shadows_highlights", "curves", "glow", "light_beam", "sunlight",
             "photo_filter", "cinematic", "split_tone", "bleach_bypass", "selective_hsl", "white_balance",
             "atmosphere", "vignette", "grain", "bw_convert", "lens_blur", "burn_edges", "dodge_center"):
    if "cine" not in FILTERS[_fid].modules:
        FILTERS[_fid].modules.append("cine")

__version__ = "1.2.0"
