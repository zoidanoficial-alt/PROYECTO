"""analista_financiero: un analista financiero guiado para pequeñas y medianas empresas.

Convierte un Excel/CSV de ventas, costos y gastos en un diagnóstico que una
persona sin formación financiera puede entender, comprobar y presentar.

Regla de diseño central: los cálculos los hace código determinista
(`calculos`, `diagnostico`, `escenarios`); la capa de lenguaje
(`explicar`, `asistente`) solo traduce y explica cifras ya calculadas.
"""

__version__ = "1.0.0"

from .sesion import Sesion  # noqa: E402,F401  (API pública)
