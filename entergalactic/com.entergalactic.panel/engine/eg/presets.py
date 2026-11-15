"""Recetas predefinidas de cada módulo. Cada una es una pila de filtros."""


def f(fid, opacity=100, blend="normal", mask=None, enabled=True, **params):
    item = {"id": fid, "enabled": enabled, "opacity": opacity, "blend": blend, "params": params}
    if mask:
        item["mask"] = mask
    return item


def preset(module, name, *stack, desc=""):
    p = {"module": module, "name": name, "stack": list(stack)}
    if desc:
        p["desc"] = desc
    return p


PRESETS = [
    # ------------------------------------------------------------------ Chroma
    preset("chroma", "Cine verde azulado y naranja",
           f("tonal_contrast", strength=30, radius=40, fine=20, saturation=0),
           f("cinematic", shadow_hue=190, highlight_hue=32, strength=60, balance=0, skin=True, contrast=30),
           f("vignette", amount=-30, size=55, roundness=60, softness=70, x=50, y=50)),
    preset("chroma", "Hora dorada",
           f("sunlight", strength=70, temperature=70, lift=10),
           f("glow", amount=30, radius=40, threshold=60, warmth=40, style="bloom"),
           f("brilliance", brightness=5, contrast=10, saturation=15, vibrance=10, warmth=20)),
    preset("chroma", "Nórdico frío",
           f("white_balance", temperature=-35, tint=-5),
           f("brilliance", brightness=5, contrast=-10, saturation=-25, vibrance=0, warmth=0),
           f("curves", black=0, white=100, gamma=10, contrast=10, fade=25)),
    preset("chroma", "Dramático",
           f("dramatic", strength=70, saturation=-35, darken=40),
           f("shadows_highlights", shadows=30, highlights=40, radius=30, color=0)),
    preset("chroma", "Paisaje polarizado",
           f("polarizer", strength=70, rotation=0, reflections=40),
           f("graduated", color="nd", density=45, position=40, softness=50, angle=0, invert=False),
           f("foliage", mode="enhance", strength=50),
           f("detail_extractor", amount=35, size=6, protect=60)),
    preset("chroma", "Atardecer intenso",
           f("graduated", color="sunset", density=60, position=50, softness=60, angle=0, invert=False),
           f("light_beam", x=70, y=35, size=60, intensity=45, warmth=80, type="sun"),
           f("brilliance", brightness=0, contrast=15, saturation=20, vibrance=20, warmth=25)),
    preset("chroma", "Blanqueo de cine",
           f("bleach_bypass", strength=70, contrast=50, saturation=35),
           f("cinematic", shadow_hue=200, highlight_hue=40, strength=25, balance=0, skin=True, contrast=10)),
    preset("chroma", "Pastel soñador",
           f("pastel", strength=70, lift=45, tint=330, tint_amount=25),
           f("glow", amount=35, radius=30, threshold=50, warmth=0, style="soft")),
    preset("chroma", "Noche neón",
           f("cinematic", shadow_hue=240, highlight_hue=320, strength=70, balance=-20, skin=False, contrast=35),
           f("glow", amount=45, radius=25, threshold=70, warmth=-40, style="bloom"),
           f("brilliance", brightness=0, contrast=15, saturation=25, vibrance=15, warmth=-10)),
    preset("chroma", "Bosque de otoño",
           f("foliage", mode="autumn", strength=75),
           f("atmosphere", amount=25, mood="warm", direction="depth"),
           f("tonal_contrast", strength=35, radius=40, fine=25, saturation=10)),
    preset("chroma", "Retrato limpio",
           f("pro_contrast", cast=50, contrast=25, dynamic=15),
           f("selective_hsl", target=25, range=30, hue_shift=0, saturation=-10, lightness=10),
           f("glow", amount=20, radius=30, threshold=55, warmth=10, style="soft"),
           f("dodge_center", amount=20, x=50, y=40, size=45)),
    preset("chroma", "Tormenta",
           f("atmosphere", amount=35, mood="dramatic", direction="top"),
           f("dramatic", strength=60, saturation=-50, darken=50),
           f("white_balance", temperature=-20, tint=0)),

    # ------------------------------------------------------------------ Plata
    preset("plata", "Clásico 400",
           f("bw_convert", film="classic400", filter="yellow", brightness=0, contrast=10, structure=20, whites=0, blacks=20),
           f("grain", amount=35, size=1.4, roughness=50, response="film", color=False)),
    preset("plata", "Alto contraste",
           f("bw_convert", film="document", filter="red", brightness=0, contrast=40, structure=40, whites=30, blacks=50),
           f("burn_edges", amount=40, size=20, top=100, bottom=100, left=100, right=100),
           f("grain", amount=25, size=1.2, roughness=40, response="film", color=False)),
    preset("plata", "Bellas artes suave",
           f("bw_convert", film="pan100", filter="none", brightness=10, contrast=-15, structure=-10, whites=10, blacks=5),
           f("toning", type="platinum", strength=35, paper_white=True),
           f("dodge_center", amount=20, x=50, y=45, size=45)),
    preset("plata", "Selenio profundo",
           f("bw_convert", film="classic400", filter="orange", brightness=0, contrast=20, structure=25, whites=10, blacks=40),
           f("toning", type="selenium", strength=60, paper_white=True),
           f("paper_grade", grade=3, exposure=0)),
    preset("plata", "Lith cálido",
           f("bw_convert", film="pan100", filter="none", brightness=5, contrast=0, structure=10, whites=0, blacks=10),
           f("lith_print", strength=80, hardness=65, warmth=70, grain=45)),
    preset("plata", "Infrarrojo blanco y negro",
           f("bw_convert", film="infrared", filter="red", brightness=5, contrast=25, structure=10, whites=20, blacks=30),
           f("glow", amount=30, radius=25, threshold=60, warmth=0, style="soft"),
           f("grain", amount=30, size=1.6, roughness=60, response="film", color=False)),
    preset("plata", "Ortocromático antiguo",
           f("bw_convert", film="ortho", filter="none", brightness=0, contrast=20, structure=30, whites=10, blacks=25),
           f("toning", type="sepia", strength=30, paper_white=True),
           f("burn_edges", amount=50, size=22, top=100, bottom=100, left=100, right=100),
           f("dust_scratches", dust=20, scratches=10, hairs=5, tone="print", seed=4)),
    preset("plata", "Grano forzado 3200",
           f("bw_convert", film="high3200", filter="none", brightness=0, contrast=30, structure=30, whites=10, blacks=35),
           f("grain", amount=70, size=2.2, roughness=80, response="shadows", color=False)),
    preset("plata", "Cianotipia",
           f("bw_convert", film="pan100", filter="blue", brightness=5, contrast=10, structure=10, whites=0, blacks=10),
           f("toning", type="cyanotype", strength=85, paper_white=False),
           f("texture", type="paper", amount=40, scale=100, seed=11)),
    preset("plata", "Solarizado",
           f("bw_convert", film="classic400", filter="none", brightness=0, contrast=20, structure=20, whites=0, blacks=20),
           f("sabattier", strength=60, threshold=65, lines=True)),

    # ------------------------------------------------------------------ Analógico
    preset("analog", "Cámara de juguete",
           f("old_camera", camera="toy", strength=85, seed=5)),
    preset("analog", "Instantánea clásica",
           f("instant", look="classic", strength=85, frame="square", crop=True)),
    preset("analog", "Película caducada",
           f("vintage_film", look="expired", strength=90, fade=10),
           f("light_leak", style="amber", position="random", intensity=45, size=45, seed=12),
           f("grain", amount=35, size=1.6, roughness=60, response="film", color=True),
           f("dust_scratches", dust=30, scratches=15, hairs=10, tone="negative", seed=8)),
    preset("analog", "Verano de los 70",
           f("old_camera", camera="rangefinder70", strength=90, seed=3),
           f("light_leak", style="red", position="left", intensity=30, size=35, seed=21)),
    preset("analog", "Desechable de los 90",
           f("old_camera", camera="disposable90", strength=90, seed=9)),
    preset("analog", "Placa húmeda",
           f("old_camera", camera="wetplate", strength=95, seed=2)),
    preset("analog", "Cine 35 mm",
           f("vintage_film", look="cine35", strength=85, fade=0),
           f("glow", amount=25, radius=15, threshold=70, warmth=0, style="halation"),
           f("grain", amount=25, size=1.3, roughness=40, response="film", color=True),
           f("vignette", amount=-25, size=55, roundness=40, softness=70, x=50, y=50)),
    preset("analog", "Miniatura",
           f("lens_blur", type="tilt", amount=60, focus_x=50, focus_y=55, focus_size=25, angle=0),
           f("brilliance", brightness=5, contrast=20, saturation=40, vibrance=10, warmth=0)),
    preset("analog", "Estenopeica",
           f("old_camera", camera="pinhole", strength=90, seed=1),
           f("grain", amount=30, size=1.5, roughness=50, response="film", color=False)),
    preset("analog", "Negativo escaneado",
           f("vintage_film", look="neg80", strength=70, fade=0),
           f("instant", look="classic", strength=0, frame="film_border", crop=False),
           f("dust_scratches", dust=35, scratches=10, hairs=10, tone="negative", seed=14)),

    # ------------------------------------------------------------------ Clean
    preset("clean", "Suave (ISO bajo)",
           f("denoise", profile="auto", luma=30, chroma=60, detail=70, contrast=40, shadows=0, jpeg=False)),
    preset("clean", "Medio (ISO 1600-3200)",
           f("denoise", profile="auto", luma=55, chroma=80, detail=50, contrast=40, shadows=20, jpeg=False)),
    preset("clean", "Fuerte (ISO alto / nocturna)",
           f("denoise", profile="auto", luma=80, chroma=95, detail=35, contrast=50, shadows=50, jpeg=False),
           f("sharpen", amount=25, radius=1.0, threshold=40)),
    preset("clean", "Sólo color",
           f("color_noise_only", strength=85, radius=5)),
    preset("clean", "Sombras ruidosas",
           f("denoise", 100, "normal", {"type": "shadows", "softness": 60},
             profile="auto", luma=75, chroma=90, detail=40, contrast=40, shadows=60, jpeg=False)),
    preset("clean", "JPEG comprimido",
           f("denoise", profile="auto", luma=25, chroma=60, detail=60, contrast=30, shadows=0, jpeg=True)),

    # ------------------------------------------------------------------ Realce
    preset("realce", "Ampliar 2× rápido",
           f("denoise", profile="auto", luma=25, chroma=60, detail=60, contrast=30, shadows=0, jpeg=False),
           f("upscale", scale="2", model="fast"),
           f("sharpen", amount=30, radius=1.4, threshold=20)),
    preset("realce", "Ampliar 4× calidad",
           f("denoise", profile="auto", luma=30, chroma=70, detail=60, contrast=30, shadows=0, jpeg=False),
           f("upscale", scale="4", model="quality"),
           f("sharpen", amount=30, radius=2.0, threshold=25)),
    preset("realce", "Nitidez de salida",
           f("sharpen", amount=45, radius=1.0, threshold=20),
           f("detail_extractor", amount=25, size=4, protect=70)),
]


from .presets_cine import CINE_PRESETS  # noqa: E402

# Las recetas de Cine van justo después de las de Chroma.
_i = max(i for i, p in enumerate(PRESETS) if p["module"] == "chroma") + 1
PRESETS[_i:_i] = CINE_PRESETS

from .presets_pop import POP_PRESETS  # noqa: E402

# Las recetas Pop van después de las de Cine.
_j = max(i for i, p in enumerate(PRESETS) if p["module"] == "cine") + 1
PRESETS[_j:_j] = POP_PRESETS
