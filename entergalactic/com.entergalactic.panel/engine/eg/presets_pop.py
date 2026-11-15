"""Recetas del módulo Pop, inspiradas en la técnica serigráfica de Andy Warhol.

Interpretaciones de una técnica documentada (color plano pintado + foto serigrafiada
en negro con desajuste, repetición en cuadrícula); no reproducen obras concretas ni
están afiliadas a la Fundación Andy Warhol.
"""
from .presets import f, preset

_W = ("Inspirada en la técnica serigráfica de Andy Warhol (años 60): el lienzo se pintaba primero con zonas "
      "planas de color y la foto se imprimía encima en tinta negra, con un pequeño desajuste entre capas.")

POP_PRESETS = [
    preset("pop", "Pop · Rosa y turquesa",
           f("pop_silkscreen", palette="pink_turq", ink=22, highlights=85, simplify=2, offset=8, detail=15, texture=30),
           desc=_W + " Retrato con piel rosa, luces amarillas y fondo turquesa."),
    preset("pop", "Pop · Amarillo eléctrico",
           f("pop_silkscreen", palette="yellow", ink=24, highlights=88, simplify=2, offset=10, detail=10, texture=30), desc=_W),
    preset("pop", "Pop · Violeta y naranja",
           f("pop_silkscreen", palette="violet_orange", ink=22, highlights=85, simplify=2.5, offset=8, detail=10, texture=30), desc=_W),
    preset("pop", "Pop · Rojo y plata",
           f("pop_silkscreen", palette="red_silver", ink=28, highlights=80, simplify=1.5, offset=4, detail=25, texture=40),
           desc=_W + " Plata y rojo, en la línea de sus obras sobre fondo plateado."),
    preset("pop", "Pop · Serie 2 × 2",
           f("pop_grid", grid="2x2", palette="pink_turq", rotate=True, diptych_bw=False, gap=6, ink=22, highlights=85,
             simplify=2, offset=8, detail=10, texture=25),
           desc="Inspirada en las repeticiones de Warhol: la misma imagen serigrafiada varias veces, cada copia con otra paleta."),
    preset("pop", "Pop · Serie 3 × 3",
           f("pop_grid", grid="3x3", palette="yellow", rotate=True, diptych_bw=False, gap=5, ink=22, highlights=85,
             simplify=1.5, offset=6, detail=5, texture=20),
           desc="Repetición en cuadrícula de 3 × 3 con paletas que cambian en cada copia."),
    preset("pop", "Pop · Díptico color y B/N",
           f("pop_grid", grid="1x2", palette="pink_turq", rotate=False, diptych_bw=True, gap=4, ink=22, highlights=85,
             simplify=2, offset=8, detail=15, texture=30),
           desc="Inspirada en el «Marilyn Diptych» (1962), con una mitad en color y otra en blanco y negro."),
    preset("pop", "Pop · Trama de cómic",
           f("brilliance", brightness=5, contrast=30, saturation=60, vibrance=20, warmth=0),
           f("halftone", size=9, angle=45, mode="ink", contrast=50),
           desc="Colores saturados con trama de puntos de imprenta, la estética del cartel y el cómic pop."),
    preset("pop", "Pop · Cuatricromía",
           f("halftone", size=8, angle=15, mode="cmy", contrast=40),
           desc="Puntos de color como en la impresión offset vista de cerca."),
]
