"""Recetas del módulo Cine, inspiradas en el trabajo de cinco directores de fotografía.

Son interpretaciones fotográficas de rasgos visuales documentados de sus películas
(ver entergalactic/ESTILOS.md). No están afiliadas ni respaldadas por ellos.
Cada receta termina con «Formato de pantalla» desactivado: actívalo para ver la
proporción de cine de la película de referencia.
"""
from .presets import f, preset


def lb(ratio):
    return f("letterbox", enabled=False, ratio=ratio, opacity=100)


CINE_PRESETS = [
    # ------------------------------------------------------------------ Roger Deakins
    preset("cine", "Deakins · Niebla naranja",
           f("atmosphere", amount=55, mood="warm", direction="depth"),
           f("limited_palette", target=28, strength=70, desaturate=50, skin=False),
           f("curves", black=4, white=92, gamma=0, contrast=15, fade=0),
           f("print_film", strength=70, contrast=25, toe=60, shoulder=80, density=30, tint="warm"),
           lb("2.39"),
           desc="Inspirada en Roger Deakins («Blade Runner 2049»): bruma naranja muy densa, siluetas y luces sin "
                "detalle que separan los planos por la atmósfera."),
    preset("cine", "Deakins · Frontera nocturna",
           f("white_balance", temperature=-30, tint=-5),
           f("curves", black=8, white=100, gamma=-15, contrast=30, fade=0),
           f("brilliance", brightness=0, contrast=0, saturation=-35, vibrance=0, warmth=0),
           f("vignette", amount=-35, size=50, roundness=60, softness=70, x=50, y=50),
           lb("2.39"),
           desc="Inspirada en el naturalismo nocturno de Deakins con Denis Villeneuve («Sicario», «Prisoners»): "
                "fuentes únicas, negros profundos, siluetas frías y poco color."),

    # ------------------------------------------------------------------ Christopher Doyle
    preset("cine", "Doyle · Neón de Hong Kong",
           f("cinematic", shadow_hue=150, highlight_hue=15, strength=65, balance=-10, skin=True, contrast=30),
           f("brilliance", brightness=5, contrast=15, saturation=40, vibrance=20, warmth=0),
           f("lens_blur", type="motion", amount=25, focus_x=50, focus_y=50, focus_size=35, angle=0),
           f("glow", amount=35, radius=20, threshold=65, warmth=0, style="bloom"),
           f("grain", amount=35, size=1.6, roughness=60, response="film", color=True),
           desc="Inspirada en Christopher Doyle («Chungking Express»): neones verdes y rojos, color saturado, luces que "
                "estallan y movimiento borroso que evoca el «step-printing»."),
    preset("cine", "Doyle · Pasillo de amor",
           f("limited_palette", target=8, strength=40, desaturate=20, skin=True),
           f("white_balance", temperature=25, tint=8),
           f("print_film", strength=85, contrast=40, toe=60, shoulder=60, density=55, tint="warm"),
           f("vignette", amount=-40, size=45, roundness=60, softness=75, x=50, y=50),
           f("grain", amount=18, size=1.2, roughness=40, response="film", color=True),
           desc="Inspirada en «In the Mood for Love» (Doyle y Mark Lee Ping-bin): rojos y ámbar densos, encuadres "
                "pictóricos, pasillos en penumbra y textura de película."),

    # ------------------------------------------------------------------ Vittorio Storaro
    preset("cine", "Storaro · Naranja de pasión",
           f("white_balance", temperature=45, tint=5),
           f("limited_palette", target=25, strength=50, desaturate=25, skin=True),
           f("light_beam", x=85, y=35, size=80, intensity=45, warmth=90, type="sun"),
           f("print_film", strength=80, contrast=40, toe=55, shoulder=65, density=50, tint="warm"),
           lb("2.39"),
           desc="Inspirada en Vittorio Storaro, para quien cada color tiene un significado: la luz naranja de la "
                "pasión y el atardecer de «Last Tango in Paris» y «1900»."),

    # ------------------------------------------------------------------ Gordon Willis
    preset("cine", "Willis · Luz cenital",
           f("curves", black=6, white=100, gamma=-25, contrast=20, fade=0),
           f("graduated", color="nd", density=55, position=55, softness=60, angle=0, invert=True),
           f("dodge_center", amount=25, x=50, y=30, size=35),
           f("photo_filter", type="warm_85", density=40, preserve=True),
           f("vignette", amount=-50, size=40, roundness=60, softness=70, x=50, y=40),
           f("grain", amount=15, size=1.1, roughness=30, response="film", color=True),
           lb("1.85"),
           desc="Inspirada en Gordon Willis («The Godfather»): luz cenital que hunde los ojos en sombra, "
                "subexposición deliberada y pátina ámbar. Lo apodaron «el Príncipe de las Tinieblas»."),

    # ------------------------------------------------------------------ Janusz Kamiński
    preset("cine", "Kamiński · Desembarco",
           f("brilliance", brightness=0, contrast=25, saturation=-60, vibrance=0, warmth=0),
           f("bleach_bypass", strength=60, contrast=60, saturation=40),
           f("white_balance", temperature=-10, tint=-5),
           f("grain", amount=30, size=1.3, roughness=50, response="film", color=False),
           lb("1.85"),
           desc="Inspirada en «Saving Private Ryan» (Kamiński): color muy desaturado y alto contraste, logrados en "
                "laboratorio con un proceso de retención de plata (ENR) en niveles muy altos."),

    # ------------------------------------------------------------------ Darius Khondji
    preset("cine", "Khondji · Ciudad en lluvia",
           f("bleach_bypass", strength=70, contrast=55, saturation=35),
           f("white_balance", temperature=-5, tint=-20),
           f("curves", black=5, white=100, gamma=-15, contrast=25, fade=0),
           f("vignette", amount=-40, size=45, roundness=60, softness=70, x=50, y=50),
           f("grain", amount=35, size=1.4, roughness=60, response="shadows", color=True),
           lb("2.39"),
           desc="Inspirada en «Se7en» (Khondji): retención de plata (proceso CCE), negros densos, verdes enfermizos "
                "y una textura áspera de película forzada."),

    # ------------------------------------------------------------------ Bradford Young
    preset("cine", "Young · Penumbra suave",
           f("curves", black=0, white=88, gamma=-20, contrast=-20, fade=12),
           f("brilliance", brightness=0, contrast=0, saturation=-30, vibrance=0, warmth=-5),
           f("shadows_highlights", shadows=20, highlights=50, radius=40, color=0),
           f("selective_hsl", target=25, range=35, hue_shift=0, saturation=10, lightness=5),
           lb("2.39"),
           desc="Inspirada en Bradford Young («Arrival»): exposición baja y suave, contraste blando, colores apagados "
                "y pieles cálidas que no se pierden en la penumbra."),

    # ------------------------------------------------------------------ Gabriel Figueroa
    preset("cine", "Figueroa · Cielo mexicano",
           f("bw_convert", film="infrared", filter="red", brightness=0, contrast=30, structure=25, whites=20, blacks=40),
           f("graduated", color="nd", density=40, position=40, softness=55, angle=0, invert=False),
           f("tonal_contrast", strength=50, radius=60, fine=30, saturation=0),
           f("grain", amount=15, size=1.1, roughness=30, response="film", color=False),
           lb("1.85"),
           desc="Inspirada en Gabriel Figueroa («María Candelaria», «Enamorada»): los «cielos de Figueroa», nubes con "
                "volumen sobre cielos oscuros logrados con filtros infrarrojos, y un claroscuro intenso."),
    preset("cine", "Figueroa · Claroscuro",
           f("bw_convert", film="pan100", filter="orange", brightness=0, contrast=35, structure=25, whites=15, blacks=50),
           f("dodge_center", amount=30, x=50, y=40, size=40),
           f("burn_edges", amount=55, size=25, top=100, bottom=100, left=100, right=100),
           desc="Inspirada en el claroscuro de Figueroa en el cine de la Época de Oro mexicana: rostros iluminados "
                "contra fondos densos y turbulentos."),

    # ------------------------------------------------------------------ Linus Sandgren
    preset("cine", "Sandgren · Hora mágica musical",
           f("split_tone", shadow_hue=250, shadow_sat=45, highlight_hue=20, highlight_sat=35, balance=0),
           f("selective_hsl", target=230, range=45, hue_shift=25, saturation=10, lightness=-5),
           f("brilliance", brightness=5, contrast=10, saturation=15, vibrance=20, warmth=0),
           f("glow", amount=30, radius=30, threshold=60, warmth=20, style="soft"),
           f("grain", amount=15, size=1.2, roughness=30, response="film", color=True),
           lb("2.39"),
           desc="Inspirada en Linus Sandgren («La La Land», rodada en película al estilo del Hollywood de los 50): "
                "cielos violeta de hora mágica, colores primarios saturados y un resplandor romántico."),

    # ------------------------------------------------------------------ Autumn Durald Arkapaw
    preset("cine", "Arkapaw · Juke joint (luz práctica cálida)",
           f("white_balance", temperature=22, tint=4),
           f("print_film", strength=85, contrast=40, toe=65, shoulder=65, density=45, tint="warm"),
           f("selective_hsl", target=25, range=35, hue_shift=0, saturation=12, lightness=6),
           f("glow", amount=25, radius=14, threshold=72, warmth=0, style="halation"),
           f("vignette", amount=-30, size=50, roundness=60, softness=70, x=50, y=50),
           f("grain", amount=14, size=1.0, roughness=30, response="film", color=True),
           lb("2.76"),
           desc="Inspirada en Autumn Durald Arkapaw («Sinners», 2025): negativo de 65 mm de alta sensibilidad, "
                "luz práctica cálida de tungsteno, pieles ricas y luminosas, negros profundos y halación suave. "
                "Formato de referencia 2.76:1 / 1.43:1."),
    preset("cine", "Arkapaw · Ámbar retrofuturista",
           f("limited_palette", target=32, strength=45, desaturate=30, skin=True),
           f("cinematic", shadow_hue=185, highlight_hue=35, strength=45, balance=0, skin=True, contrast=25),
           f("print_film", strength=75, contrast=30, toe=45, shoulder=60, density=35, tint="warm"),
           f("anamorphic_flare", intensity=40, threshold=78, length=35, color="amber"),
           f("grain", amount=18, size=1.2, roughness=40, response="film", color=True),
           lb("2.39"),
           desc="Inspirada en el trabajo de Arkapaw en «Loki» (temporada 1): interiores ámbar y anaranjados de aire "
                "retro, acentos verde azulado en sombras, destellos anamórficos."),
    preset("cine", "Arkapaw · Azul abisal",
           f("white_balance", temperature=-45, tint=-8),
           f("selective_hsl", target=200, range=60, hue_shift=0, saturation=40, lightness=-10),
           f("atmosphere", amount=25, mood="cold", direction="depth"),
           f("glow", amount=25, radius=30, threshold=55, warmth=-30, style="soft"),
           f("print_film", strength=70, contrast=30, toe=55, shoulder=60, density=35, tint="teal"),
           desc="Inspirada en las secuencias submarinas de «Black Panther: Wakanda Forever» (Arkapaw): azules y cianes "
                "profundos y saturados, luz difusa que se pierde en la distancia."),

    # ------------------------------------------------------------------ Lol Crawley
    preset("cine", "Crawley · Hormigón monumental",
           f("brilliance", brightness=0, contrast=20, saturation=-35, vibrance=0, warmth=0),
           f("split_tone", shadow_hue=210, shadow_sat=20, highlight_hue=40, highlight_sat=15, balance=0),
           f("tonal_contrast", strength=45, radius=60, fine=25, saturation=0),
           f("print_film", strength=85, contrast=45, toe=55, shoulder=50, density=30, tint="neutral"),
           f("grain", amount=28, size=1.3, roughness=55, response="film", color=False),
           lb("1.66"),
           desc="Inspirada en Lol Crawley («The Brutalist», 2024, rodada principalmente en VistaVision): tonos apagados, "
                "contraste marcado, piedra y hormigón fríos, bolsas de luz cálida y textura de película forzada en revelado."),
    preset("cine", "Crawley · Delta naturalista",
           f("curves", black=0, white=100, gamma=5, contrast=-10, fade=20),
           f("brilliance", brightness=0, contrast=0, saturation=-25, vibrance=0, warmth=6),
           f("selective_hsl", target=100, range=50, hue_shift=-10, saturation=-30, lightness=0),
           f("grain", amount=30, size=1.5, roughness=55, response="film", color=True),
           desc="Inspirada en «Ballast» (Crawley, 2008): luz natural de cielo cubierto, verdes y marrones apagados, "
                "contraste suave y grano de 35 mm."),

    # ------------------------------------------------------------------ Hoyte van Hoytema
    preset("cine", "Hoytema · Gran formato cálido",
           f("white_balance", temperature=15, tint=0),
           f("print_film", strength=90, contrast=50, toe=55, shoulder=70, density=45, tint="warm"),
           f("tonal_contrast", strength=25, radius=50, fine=15, saturation=0),
           f("vignette", amount=-25, size=55, roundness=60, softness=75, x=50, y=50),
           f("grain", amount=12, size=0.9, roughness=25, response="film", color=True),
           lb("1.43"),
           desc="Inspirada en Hoyte van Hoytema («Oppenheimer», partes en color, IMAX 65 mm): color cálido y "
                "denso, pieles saturadas, luces que ruedan suavemente y grano muy fino de gran formato."),
    preset("cine", "Hoytema · Plata IMAX",
           f("bw_convert", film="document", filter="none", brightness=0, contrast=35, structure=25, whites=20, blacks=45),
           f("print_film", strength=60, contrast=20, toe=60, shoulder=70, density=0, tint="neutral"),
           f("grain", amount=25, size=1.1, roughness=35, response="film", color=False),
           f("burn_edges", amount=25, size=22, top=100, bottom=100, left=100, right=100),
           lb("1.43"),
           desc="Inspirada en las secuencias en blanco y negro de «Oppenheimer», rodadas en una película B/N de 65 mm "
                "fabricada para IMAX: alto contraste, negros profundos y una gama de grises amplia."),
    preset("cine", "Hoytema · Mar del Norte",
           f("white_balance", temperature=-20, tint=-10),
           f("brilliance", brightness=0, contrast=10, saturation=-30, vibrance=0, warmth=0),
           f("split_tone", shadow_hue=190, shadow_sat=25, highlight_hue=200, highlight_sat=10, balance=0),
           f("print_film", strength=75, contrast=35, toe=50, shoulder=65, density=30, tint="teal"),
           f("grain", amount=15, size=1.0, roughness=30, response="film", color=True),
           lb("1.43"),
           desc="Inspirada en «Dunkirk» (van Hoytema): realismo frío, cielos grises, mar verde azulado y colores "
                "contenidos, sin aplastar las sombras."),
    preset("cine", "Hoytema · Pastel cálido",
           f("selective_hsl", target=215, range=60, hue_shift=0, saturation=-70, lightness=12),
           f("selective_hsl", target=5, range=40, hue_shift=0, saturation=25, lightness=5),
           f("white_balance", temperature=20, tint=10),
           f("curves", black=0, white=100, gamma=8, contrast=-15, fade=15),
           f("glow", amount=25, radius=30, threshold=50, warmth=20, style="soft"),
           desc="Interpretación del color de «Her» (van Hoytema, 2013): rojos, corales y melocotones suaves, azules "
                "atenuados, contraste bajo y luz difusa."),
    preset("cine", "Hoytema · Polvo ámbar",
           f("atmosphere", amount=40, mood="warm", direction="uniform"),
           f("limited_palette", target=38, strength=35, desaturate=25, skin=True),
           f("print_film", strength=80, contrast=30, toe=45, shoulder=60, density=30, tint="warm"),
           f("grain", amount=20, size=1.2, roughness=40, response="film", color=True),
           desc="Inspirada en las escenas de la Tierra de «Interstellar»: aire cargado de polvo, luz ámbar y "
                "contraste bajo."),

    # ------------------------------------------------------------------ Greig Fraser
    preset("cine", "Fraser · Arena monocroma",
           f("limited_palette", target=35, strength=65, desaturate=45, skin=False),
           f("brilliance", brightness=0, contrast=10, saturation=-20, vibrance=0, warmth=0),
           f("print_film", strength=90, contrast=40, toe=60, shoulder=60, density=35, tint="filmout"),
           f("atmosphere", amount=20, mood="warm", direction="depth"),
           f("grain", amount=15, size=1.2, roughness=35, response="film", color=True),
           lb("2.39"),
           desc="Inspirada en Greig Fraser («Dune»): paleta casi monocroma de arena, sombras profundas y un acabado "
                "«ida y vuelta a película» (film-out) que trata el pie y el hombro de la imagen."),
    preset("cine", "Fraser · Ciudad nocturna",
           f("curves", black=6, white=100, gamma=-5, contrast=25, fade=0),
           f("limited_palette", target=22, strength=45, desaturate=40, skin=True),
           f("split_tone", shadow_hue=0, shadow_sat=12, highlight_hue=30, highlight_sat=35, balance=-10),
           f("vignette", amount=-60, size=35, roundness=60, softness=70, x=50, y=50),
           f("lens_blur", type="soft_edges", amount=25, focus_x=50, focus_y=50, focus_size=45, angle=0),
           f("glow", amount=20, radius=12, threshold=75, warmth=0, style="halation"),
           f("grain", amount=25, size=1.3, roughness=45, response="shadows", color=True),
           lb("2.39"),
           desc="Inspirada en «The Batman» (Fraser): negros muy densos, luces urbanas anaranjadas y rojizas, bordes "
                "que se oscurecen y se desenfocan como con ópticas antiguas, y acabado film-out."),
    preset("cine", "Fraser · Infrarrojo solar",
           f("bw_convert", film="infrared", filter="red", brightness=5, contrast=30, structure=15, whites=30, blacks=40),
           f("glow", amount=25, radius=25, threshold=60, warmth=0, style="soft"),
           f("print_film", strength=50, contrast=20, toe=55, shoulder=60, density=0, tint="neutral"),
           f("grain", amount=10, size=1.0, roughness=30, response="film", color=False),
           lb("1.43"),
           desc="Inspirada en las escenas de Giedi Prime de «Dune: Parte dos»: blanco y negro infrarrojo con pieles "
                "lechosas, cielos negros y luz solar que brilla."),

    # ------------------------------------------------------------------ Emmanuel Lubezki
    preset("cine", "Lubezki · Luz natural fría",
           f("white_balance", temperature=-30, tint=-5),
           f("brilliance", brightness=0, contrast=5, saturation=-25, vibrance=0, warmth=0),
           f("shadows_highlights", shadows=30, highlights=40, radius=30, color=0),
           f("selective_hsl", target=25, range=30, hue_shift=0, saturation=15, lightness=0),
           f("print_film", strength=60, contrast=25, toe=40, shoulder=75, density=20, tint="cold"),
           lb("2.39"),
           desc="Inspirada en Emmanuel Lubezki («The Revenant», rodada sin luz eléctrica): luz de día fría y "
                "desaturada, mucho rango dinámico y piel que conserva algo de calidez."),
    preset("cine", "Lubezki · Contraluz dorado",
           f("light_beam", x=80, y=15, size=70, intensity=55, warmth=70, type="sun"),
           f("glow", amount=30, radius=35, threshold=50, warmth=30, style="soft"),
           f("sunlight", strength=50, temperature=60, lift=10),
           f("curves", black=0, white=100, gamma=10, contrast=0, fade=10),
           f("brilliance", brightness=0, contrast=0, saturation=0, vibrance=15, warmth=0),
           desc="Inspirada en «The Tree of Life» (Lubezki): sol directo usado como contraluz, aire luminoso, "
                "sombras abiertas y calidez de hora dorada."),
    preset("cine", "Lubezki · Distopía gris",
           f("brilliance", brightness=0, contrast=10, saturation=-55, vibrance=0, warmth=0),
           f("white_balance", temperature=-10, tint=-15),
           f("bleach_bypass", strength=35, contrast=40, saturation=40),
           f("grain", amount=30, size=1.4, roughness=55, response="film", color=True),
           lb("1.85"),
           desc="Inspirada en «Children of Men» (Lubezki): mundo gris verdoso casi sin color, contraste áspero y grano."),
    preset("cine", "Lubezki · Fuego y nieve",
           f("cinematic", shadow_hue=215, highlight_hue=28, strength=70, balance=20, skin=True, contrast=30),
           f("white_balance", temperature=-15, tint=0),
           f("vignette", amount=-35, size=45, roundness=60, softness=70, x=50, y=50),
           f("grain", amount=15, size=1.0, roughness=30, response="film", color=True),
           lb("2.39"),
           desc="Inspirada en las noches de «The Revenant»: sombras azules del entorno nevado contra el calor de "
                "una hoguera."),
]
