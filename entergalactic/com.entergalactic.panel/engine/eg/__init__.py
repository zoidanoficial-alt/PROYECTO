"""ENTERGALACTIC: motor de efectos fotográficos."""
from . import core, registry  # noqa: F401
from . import filters_chroma, filters_plata, filters_analog, filters_clean, filters_realce  # noqa: F401
from .registry import FILTERS, run_stack, schema  # noqa: F401

__version__ = "1.0.0"
