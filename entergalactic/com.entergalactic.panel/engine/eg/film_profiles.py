"""Biblioteca de perfiles de película para ENTERGALACTIC.

Cada perfil describe la respuesta de una emulsión con unos pocos parámetros:

  kind      neg (negativo color), slide (diapositiva), bw (blanco y negro),
            print (copia de proyección), tech3 / tech2 (Technicolor), auto (autocromo)
  contrast  pendiente global de la curva característica
  toe       dureza del pie (sombras)            shoulder  dureza del hombro (luces)
  black     densidad mínima (negro de la copia)  white     blanco máximo
  bal       desplazamiento por canal en pasos (equilibrio de color de la emulsión)
  kmul      contraste relativo por canal (cruces de color en sombras/luces)
  sat       saturación                           sh / hi   tinte en sombras / luces
  twists    giros de tono localizados [(centro°, amplitud°, giro°, x saturación)]
  w         sensibilidad espectral (sólo B/N)    tone      virado (gradiente)
  grain     (cantidad, tamaño px)                hal       halación por defecto
  print     aplicar copia de proyección por defecto

Son aproximaciones artísticas basadas en las características publicadas y conocidas
de cada película (latitud, contraste, paleta, grano). No son mediciones de
laboratorio. Los nombres son descriptivos; la descripción indica la película
de referencia (marcas de sus respectivos fabricantes).
"""

_DEF = dict(kind="neg", contrast=1.0, toe=1.0, shoulder=1.0, black=0.02, white=0.98, bal=(0, 0, 0),
            kmul=(1, 1, 1), sat=1.0, sh=(0, 0, 0), hi=(0, 0, 0), twists=(), w=(0.3, 0.59, 0.11),
            tone=None, grain=(25, 1.3), hal=0, print=False)


def P(fid, name, family, desc, **kw):
    d = dict(_DEF)
    d.update(kw)
    d.update(id=fid, name=name, family=family, desc=desc)
    return d


FAMILIES = [
    ("cine", "Negativo de cine"), ("cinestill", "Cine sin capa antihalo"), ("portrait", "Negativo de retrato"),
    ("consumer", "Negativo de consumo"), ("fujicolor", "Negativo de paleta fría/verde"), ("vivid", "Negativo saturado"),
    ("slide", "Diapositiva"), ("instant", "Instantánea"), ("print", "Copia de proyección"),
    ("lab", "Procesos de laboratorio"), ("historic", "Color histórico"), ("bw", "Blanco y negro"),
    ("oldprocess", "Procesos antiguos"), ("creative", "Creativas y caducadas"),
]

PROFILES = [
    # ------------------------------------------------------------------ negativo de cine
    P("cine50d", "Cine 50D luz día", "cine", "Inspirado en Kodak Vision3 50D (5203): grano finísimo, colores limpios y mucha latitud en luces.",
      contrast=0.95, shoulder=0.8, bal=(0.02, 0, -0.02), sat=1.02, grain=(10, 0.9), hal=10),
    P("cine200t", "Cine 200T tungsteno", "cine", "Inspirado en Kodak Vision3 200T (5213): equilibrado para tungsteno, tonos de piel suaves.",
      contrast=0.95, shoulder=0.8, bal=(-0.04, 0, 0.06), sat=1.0, sh=(-0.01, 0, 0.01), grain=(16, 1.1), hal=15),
    P("cine250d", "Cine 250D luz día", "cine", "Inspirado en Kodak Vision3 250D (5207): versátil, ligeramente cálido, sombras limpias.",
      contrast=0.97, shoulder=0.82, bal=(0.03, 0.01, -0.03), sat=1.0, grain=(16, 1.1), hal=15),
    P("cine500t", "Cine 500T tungsteno", "cine", "Inspirado en Kodak Vision3 500T (5219): la película nocturna del cine actual; sombras verdeazuladas, grano visible y gran latitud.",
      contrast=0.92, toe=0.95, shoulder=0.75, bal=(-0.05, 0.01, 0.08), sat=0.97, sh=(-0.012, 0.004, 0.012),
      hi=(0.01, 0.004, -0.008), grain=(26, 1.4), hal=20),
    P("cine500t_p1", "Cine 500T forzada +1", "cine", "Vision3 500T revelada forzada un paso: más contraste y grano, negros más densos.",
      contrast=1.08, toe=1.15, shoulder=0.8, bal=(-0.05, 0.01, 0.08), sat=1.02, sh=(-0.015, 0.005, 0.015), grain=(36, 1.6), hal=22),
    P("cine500t_p2", "Cine 500T forzada +2", "cine", "Vision3 500T forzada dos pasos: contraste duro, grano marcado, color más crudo.",
      contrast=1.2, toe=1.3, shoulder=0.85, bal=(-0.04, 0.02, 0.06), sat=1.05, sh=(-0.02, 0.008, 0.015), grain=(48, 1.8), hal=25),
    P("cine_bypass", "Cine 500T con retención de plata", "lab", "Negativo de cine con proceso de retención de plata (tipo ENR / bleach bypass): desaturado y contrastado.",
      contrast=1.25, toe=1.25, shoulder=1.0, sat=0.55, bal=(-0.02, 0, 0.03), grain=(30, 1.4), hal=10),
    # ------------------------------------------------------------------ sin capa antihalo
    P("cs800t", "Cine 800T sin antihalo", "cinestill", "Inspirado en CineStill 800T (Vision3 500T sin capa remjet): halos rojos intensos alrededor de las luces de noche.",
      contrast=0.95, shoulder=0.75, bal=(-0.06, 0.0, 0.09), sat=1.02, sh=(-0.01, 0.006, 0.014), grain=(32, 1.5), hal=75),
    P("cs50d", "Cine 50D sin antihalo", "cinestill", "Inspirado en CineStill 50D: luz día de grano muy fino con halación suave en las luces.",
      contrast=0.98, shoulder=0.8, bal=(0.02, 0, -0.02), sat=1.05, grain=(10, 0.9), hal=45),
    P("cs400d", "Cine 400D sin antihalo", "cinestill", "Inspirado en CineStill 400D: luz día versátil, paleta cálida y halos rojizos.",
      contrast=0.97, shoulder=0.8, bal=(0.04, 0.01, -0.03), sat=1.05, grain=(22, 1.2), hal=55),
    # ------------------------------------------------------------------ retrato
    P("portrait160", "Retrato 160", "portrait", "Inspirado en Kodak Portra 160: piel natural, contraste bajo, grano finísimo.",
      contrast=0.85, toe=0.9, shoulder=0.75, bal=(0.03, 0.01, -0.02), sat=0.9, hi=(0.01, 0.005, -0.005),
      twists=((25, 30, 0, 0.92),), grain=(12, 1.0)),
    P("portrait400", "Retrato 400", "portrait", "Inspirado en Kodak Portra 400: el estándar del retrato y la boda; piel cálida y luces cremosas.",
      contrast=0.88, toe=0.9, shoulder=0.72, bal=(0.04, 0.015, -0.03), sat=0.92, hi=(0.015, 0.008, -0.008),
      twists=((25, 30, 0, 0.92), (110, 40, -6, 0.9)), grain=(18, 1.15)),
    P("portrait800", "Retrato 800", "portrait", "Inspirado en Kodak Portra 800: más saturado y granulado que el 400, ideal con poca luz.",
      contrast=0.93, toe=0.95, shoulder=0.75, bal=(0.05, 0.02, -0.03), sat=0.98, grain=(28, 1.3)),
    P("portrait400_o1", "Retrato 400 sobreexpuesto +1", "portrait", "Retrato 400 expuesto un paso de más: tonos pastel, sombras abiertas, look de boda.",
      contrast=0.8, toe=0.75, shoulder=0.7, black=0.05, bal=(0.05, 0.02, -0.02), sat=0.88, grain=(14, 1.1)),
    P("portrait400_o2", "Retrato 400 sobreexpuesto +2", "portrait", "Retrato 400 dos pasos sobreexpuesto: aire luminoso y colores muy suaves.",
      contrast=0.72, toe=0.6, shoulder=0.65, black=0.08, bal=(0.06, 0.02, -0.01), sat=0.84, grain=(12, 1.0)),
    # ------------------------------------------------------------------ consumo
    P("gold200", "Dorada 200", "consumer", "Inspirado en Kodak Gold 200: amarillos y dorados cálidos, nostalgia de álbum familiar.",
      contrast=1.0, bal=(0.07, 0.04, -0.07), sat=1.1, hi=(0.02, 0.012, -0.015), grain=(24, 1.3)),
    P("ultramax400", "Ultra 400", "consumer", "Inspirado en Kodak UltraMax 400: saturado, cálido y contrastado, la película de viaje.",
      contrast=1.05, bal=(0.05, 0.02, -0.04), sat=1.15, grain=(28, 1.35)),
    P("colorplus200", "Color 200 económica", "consumer", "Inspirado en Kodak ColorPlus 200: cálida y algo verdosa en sombras, contraste medio.",
      contrast=0.98, bal=(0.06, 0.03, -0.05), sat=1.05, sh=(-0.005, 0.01, 0), grain=(28, 1.4)),
    # ------------------------------------------------------------------ paleta fría / verde
    P("pro400h", "Pastel 400 verde", "fujicolor", "Inspirado en Fujifilm Pro 400H: pasteles, verdes menta y cielos cian; muy usado en bodas.",
      contrast=0.82, toe=0.85, shoulder=0.7, black=0.04, bal=(-0.02, 0.03, 0.02), sat=0.88,
      twists=((110, 45, 12, 0.9), (215, 40, -10, 0.9)), grain=(16, 1.1)),
    P("superia400", "Superia 400", "fujicolor", "Inspirado en Fujifilm Superia 400: verdes intensos, magentas fríos, contraste vivo.",
      contrast=1.05, bal=(-0.02, 0.03, 0.01), sat=1.08, twists=((110, 40, 8, 1.1),), sh=(-0.006, 0.006, 0.006), grain=(26, 1.3)),
    P("superia1600", "Superia 1600", "fujicolor", "Inspirado en Fujifilm Superia 1600: grano grueso, sombras verdosas, colores fríos.",
      contrast=1.08, toe=1.1, bal=(-0.03, 0.04, 0.02), sat=1.0, sh=(-0.01, 0.012, 0.004), grain=(45, 1.7)),
    P("c200", "Fuji 200 económica", "fujicolor", "Inspirado en Fujicolor C200: verdes azulados, pieles neutras, look de los 2000.",
      contrast=1.0, bal=(-0.02, 0.025, 0.02), sat=1.02, twists=((110, 40, 10, 1.0),), grain=(26, 1.35)),
    # ------------------------------------------------------------------ saturado
    P("vivid100", "Viva 100", "vivid", "Inspirado en Kodak Ektar 100: el negativo más saturado y de grano más fino; paisajes y cielos intensos.",
      contrast=1.12, toe=1.05, shoulder=0.9, bal=(0.02, 0, -0.01), sat=1.3, twists=((215, 40, 0, 1.15), (0, 25, 0, 1.1)), grain=(10, 0.9)),
    P("lomo100", "Lomo Color 100", "vivid", "Inspirado en Lomography Color Negative 100: colores cálidos y saturados, sombras cargadas.",
      contrast=1.1, toe=1.15, bal=(0.06, 0.02, -0.05), sat=1.25, grain=(20, 1.2)),
    P("lomo400", "Lomo Color 400", "vivid", "Inspirado en Lomography Color Negative 400: vivo y algo verdoso, para todo.",
      contrast=1.08, toe=1.1, bal=(0.03, 0.03, -0.03), sat=1.2, grain=(30, 1.4)),
    P("lomo800", "Lomo Color 800", "vivid", "Inspirado en Lomography Color Negative 800: noches cálidas y grano evidente.",
      contrast=1.08, toe=1.15, bal=(0.07, 0.02, -0.04), sat=1.15, grain=(40, 1.6)),
    # ------------------------------------------------------------------ diapositiva
    P("e100", "Diapositiva 100 neutra", "slide", "Inspirado en Kodak Ektachrome E100: diapositiva limpia, neutra y fría, negros profundos.",
      kind="slide", contrast=1.25, toe=1.25, shoulder=1.15, black=0.0, bal=(-0.02, 0, 0.03), sat=1.15, grain=(10, 0.9)),
    P("velvia50", "Diapositiva 50 vívida", "slide", "Inspirado en Fujifilm Velvia 50: saturación extrema, verdes y magentas intensos, contraste duro.",
      kind="slide", contrast=1.35, toe=1.35, shoulder=1.2, black=0.0, bal=(0.0, 0.01, 0.0), sat=1.45,
      twists=((110, 40, 6, 1.2), (300, 40, 0, 1.15)), grain=(8, 0.8)),
    P("velvia100", "Diapositiva 100 vívida", "slide", "Inspirado en Fujifilm Velvia 100: saturación alta algo más contenida que el 50.",
      kind="slide", contrast=1.3, toe=1.3, shoulder=1.15, black=0.0, sat=1.35, grain=(9, 0.85)),
    P("provia100", "Diapositiva 100 equilibrada", "slide", "Inspirado en Fujifilm Provia 100F: diapositiva versátil, fiel y nítida.",
      kind="slide", contrast=1.2, toe=1.2, shoulder=1.1, black=0.0, sat=1.12, grain=(9, 0.85)),
    P("astia100", "Diapositiva 100 suave", "slide", "Inspirado en Fujifilm Astia 100F: diapositiva de retrato, contraste suave y piel delicada.",
      kind="slide", contrast=1.05, toe=1.05, shoulder=1.0, black=0.01, sat=1.05, grain=(9, 0.85)),
    P("kchrome64", "Cromo 64 clásico", "slide", "Inspirado en Kodachrome 64: rojos profundos, amarillos cálidos, azules densos y un contraste rico.",
      kind="slide", contrast=1.25, toe=1.3, shoulder=1.05, black=0.0, bal=(0.04, 0.0, -0.04), sat=1.18,
      twists=((0, 30, 4, 1.15), (215, 40, -6, 1.05)), sh=(0.0, -0.004, 0.006), grain=(12, 1.0)),
    P("kchrome25", "Cromo 25 clásico", "slide", "Inspirado en Kodachrome 25: el clásico de National Geographic; muy fino, cálido y contrastado.",
      kind="slide", contrast=1.3, toe=1.35, shoulder=1.1, black=0.0, bal=(0.05, 0.01, -0.05), sat=1.2,
      twists=((0, 30, 4, 1.15),), grain=(8, 0.8)),
    # ------------------------------------------------------------------ instantánea
    P("polaroid600", "Instantánea cuadrada 600", "instant", "Inspirado en las películas instantáneas tipo Polaroid 600: sombras cian, luces cálidas, contraste bajo.",
      contrast=0.8, toe=0.8, shoulder=0.7, black=0.08, white=0.95, bal=(0.02, 0.0, -0.02), sat=0.82,
      sh=(-0.02, 0.01, 0.025), hi=(0.02, 0.01, -0.01), grain=(14, 1.1)),
    P("sx70", "Instantánea integral 70s", "instant", "Inspirado en la película integral de los 70 (tipo SX-70): tonos suaves, verdes y ocres, aspecto onírico.",
      contrast=0.75, toe=0.75, shoulder=0.65, black=0.1, white=0.93, bal=(0.03, 0.03, -0.04), sat=0.75,
      sh=(-0.01, 0.015, 0.01), grain=(12, 1.0)),
    P("instax", "Instantánea mini", "instant", "Inspirado en Instax: colores vivos y limpios, contraste medio-alto y negros algo azulados.",
      contrast=1.0, black=0.04, bal=(-0.01, 0.0, 0.02), sat=1.05, sh=(-0.005, 0.0, 0.012), grain=(10, 0.9)),
    # ------------------------------------------------------------------ copias de proyección
    P("print2383", "Copia de proyección 2383", "print", "Inspirado en Kodak Vision Color Print 2383: la copia de cine clásica; contraste alto, sombras cian-verdosas y luces cálidas.",
      kind="print", contrast=1.2, toe=1.3, shoulder=1.0, black=0.0, sat=1.08, sh=(-0.02, 0.008, 0.012), hi=(0.015, 0.006, -0.012), grain=(0, 1)),
    P("print2393", "Copia de proyección premium", "print", "Inspirado en Kodak Vision Premier 2393: copia de mayor contraste y saturación, negros más profundos.",
      kind="print", contrast=1.32, toe=1.4, shoulder=1.05, black=0.0, sat=1.15, sh=(-0.015, 0.006, 0.012), hi=(0.012, 0.006, -0.01), grain=(0, 1)),
    P("print3513", "Copia de proyección fría", "print", "Inspirado en Fujifilm Eterna-CP 3513: copia más neutra y fría, con sombras azuladas.",
      kind="print", contrast=1.15, toe=1.2, shoulder=1.0, black=0.0, sat=1.0, sh=(-0.01, 0.0, 0.018), hi=(0.0, 0.004, 0.0), grain=(0, 1)),
    # ------------------------------------------------------------------ procesos de laboratorio
    P("xpro_slide", "Diapositiva en C-41", "lab", "Diapositiva revelada como negativo (proceso cruzado): amarillos, verdes y contraste extremo.",
      kind="slide", contrast=1.4, toe=1.4, shoulder=1.2, black=0.05, bal=(0.04, 0.06, -0.12), kmul=(1.1, 1.05, 0.7), sat=1.3, grain=(20, 1.2)),
    P("bleach_neg", "Negativo con blanqueo parcial", "lab", "Negativo color con blanqueo parcial: plata retenida, colores apagados y contraste metálico.",
      contrast=1.3, toe=1.3, shoulder=1.1, sat=0.5, grain=(26, 1.3)),
    # ------------------------------------------------------------------ color histórico
    P("techni3", "Tricromía clásica", "historic", "Inspirado en el Technicolor de tres bandas (años 30-50): color de tinte por transferencia, rojos y cielos imposibles de puros.",
      kind="tech3", contrast=1.15, toe=1.2, shoulder=1.0, sat=1.35, grain=(12, 1.0)),
    P("techni2", "Bicromía años 20", "historic", "Inspirado en el Technicolor de dos colores (años 20): sólo rojo-anaranjado y verde-azulado.",
      kind="tech2", contrast=1.05, toe=1.1, black=0.04, sat=1.1, grain=(20, 1.3)),
    P("autochrome", "Autocromo 1907", "historic", "Inspirado en el autocromo de los hermanos Lumière: color suave y pastel con grano de almidón coloreado.",
      kind="auto", contrast=0.85, toe=0.9, black=0.06, white=0.92, sat=0.75, bal=(0.04, 0.03, -0.03), grain=(40, 1.8)),
    # ------------------------------------------------------------------ blanco y negro
    P("bw_hp5", "B/N 400 clásica británica", "bw", "Inspirado en Ilford HP5 Plus 400: medios tonos amplios, grano visible y muy tolerante.",
      kind="bw", contrast=1.0, toe=1.0, shoulder=0.85, w=(0.32, 0.52, 0.16), grain=(32, 1.4)),
    P("bw_hp5_1600", "B/N 400 forzada a 1600", "bw", "HP5 Plus forzada dos pasos: contraste duro, sombras densas y grano grueso.",
      kind="bw", contrast=1.3, toe=1.35, shoulder=0.95, w=(0.32, 0.52, 0.16), grain=(52, 1.8)),
    P("bw_fp4", "B/N 125 fina", "bw", "Inspirado en Ilford FP4 Plus 125: grano fino, contraste clásico, muy nítida.",
      kind="bw", contrast=1.05, toe=1.05, shoulder=0.9, w=(0.3, 0.55, 0.15), grain=(18, 1.1)),
    P("bw_panf", "B/N 50 ultrafina", "bw", "Inspirado en Ilford Pan F Plus 50: grano casi invisible, contraste alto y negros profundos.",
      kind="bw", contrast=1.2, toe=1.25, shoulder=1.0, w=(0.3, 0.56, 0.14), grain=(8, 0.8)),
    P("bw_delta3200", "B/N 3200 nocturna", "bw", "Inspirado en Ilford Delta 3200: grano marcado y suave a la vez, para noche y concierto.",
      kind="bw", contrast=1.1, toe=1.15, shoulder=0.85, w=(0.34, 0.5, 0.16), grain=(55, 1.9)),
    P("bw_trix", "B/N 400 reportaje", "bw", "Inspirado en Kodak Tri-X 400: la película del fotoperiodismo; contraste vivo y grano con carácter.",
      kind="bw", contrast=1.12, toe=1.15, shoulder=0.95, w=(0.34, 0.5, 0.16), grain=(34, 1.45)),
    P("bw_trix1600", "B/N 400 reportaje forzada 1600", "bw", "Tri-X forzada a 1600: blancos que estallan, negros sin detalle y grano gordo.",
      kind="bw", contrast=1.4, toe=1.45, shoulder=1.05, w=(0.34, 0.5, 0.16), grain=(58, 1.9)),
    P("bw_tmax100", "B/N 100 tabular", "bw", "Inspirado en Kodak T-Max 100: grano tabular finísimo, tonos limpios y nitidez extrema.",
      kind="bw", contrast=1.08, toe=1.1, shoulder=0.95, w=(0.3, 0.56, 0.14), grain=(9, 0.85)),
    P("bw_tmax3200", "B/N 3200 tabular", "bw", "Inspirado en Kodak T-Max P3200: alta sensibilidad con grano suave y contraste medio.",
      kind="bw", contrast=1.05, toe=1.1, shoulder=0.85, w=(0.33, 0.52, 0.15), grain=(50, 1.8)),
    P("bw_doublex", "B/N cine doble X", "bw", "Inspirado en Kodak Double-X 5222: el negativo B/N de cine; contraste rico y grano cinematográfico.",
      kind="bw", contrast=1.1, toe=1.2, shoulder=0.9, w=(0.35, 0.5, 0.15), grain=(30, 1.4), hal=10),
    P("bw_fomapan", "B/N 100 checa", "bw", "Inspirado en Fomapan 100: tonos clásicos algo suaves en luces, aspecto vintage.",
      kind="bw", contrast=0.98, toe=1.0, shoulder=0.8, w=(0.34, 0.5, 0.16), grain=(22, 1.2)),
    P("bw_acros", "B/N 100 japonesa", "bw", "Inspirado en Fujifilm Neopan Acros 100: grano finísimo, cielos oscuros y gran nitidez.",
      kind="bw", contrast=1.1, toe=1.1, shoulder=0.95, w=(0.38, 0.5, 0.12), grain=(9, 0.85)),
    P("bw_neopan1600", "B/N 1600 japonesa", "bw", "Inspirado en Fujifilm Neopan 1600: contraste alto y grano urbano nocturno.",
      kind="bw", contrast=1.2, toe=1.25, shoulder=0.95, w=(0.34, 0.5, 0.16), grain=(46, 1.7)),
    P("bw_sfx", "B/N infrarrojo extendido", "bw", "Inspirado en Ilford SFX 200: sensibilidad roja extendida; follaje claro y cielos oscuros con filtro rojo.",
      kind="bw", contrast=1.15, toe=1.15, shoulder=0.9, w=(0.75, 0.35, -0.1), grain=(30, 1.4)),
    P("bw_ir400", "B/N infrarrojo 400", "bw", "Inspirado en Rollei Infrared 400: efecto infrarrojo intenso, follaje blanco y cielos casi negros.",
      kind="bw", contrast=1.25, toe=1.25, shoulder=0.9, w=(1.05, 0.25, -0.3), grain=(28, 1.35), hal=20),
    P("bw_ortho", "B/N ortocromática", "bw", "Inspirado en Ilford Ortho Plus 80: ciega al rojo; labios y pieles oscuras, cielos claros, aspecto antiguo.",
      kind="bw", contrast=1.15, toe=1.15, shoulder=1.0, w=(0.0, 0.6, 0.4), grain=(16, 1.1)),
    # ------------------------------------------------------------------ procesos antiguos
    P("daguerre", "Daguerrotipo", "oldprocess", "Inspirado en el daguerrotipo (1839): imagen plateada sobre metal espejado, tono frío y viñeta.",
      kind="bw", contrast=1.0, toe=1.0, shoulder=0.75, black=0.08, white=0.9, w=(0.05, 0.45, 0.5),
      tone=((0, "#1b1e22"), (0.5, "#7d848a"), (1, "#e7ebee")), grain=(18, 1.2)),
    P("ambrotype", "Ambrotipo", "oldprocess", "Inspirado en el ambrotipo (años 1850): negativo de colodión sobre vidrio oscuro, tonos crema.",
      kind="bw", contrast=1.1, toe=1.2, shoulder=0.85, black=0.04, white=0.88, w=(0.02, 0.5, 0.48),
      tone=((0, "#120f0c"), (0.5, "#6d6253"), (1, "#e6dcc4")), grain=(20, 1.3)),
    P("albumen", "Copia a la albúmina", "oldprocess", "Inspirado en la copia a la albúmina (s. XIX): sepia-púrpura cálido y luces amarillentas.",
      kind="bw", contrast=0.95, toe=0.95, shoulder=0.8, black=0.06, white=0.9, w=(0.1, 0.5, 0.4),
      tone=((0, "#2a1414"), (0.45, "#8a5a45"), (1, "#f2e2bf")), grain=(14, 1.1)),
    P("cyanotype_p", "Cianotipo", "oldprocess", "Inspirado en el cianotipo (1842): azul de Prusia, impresión por contacto al sol.",
      kind="bw", contrast=1.0, toe=1.0, shoulder=0.85, black=0.05, white=0.93, w=(0.25, 0.5, 0.25),
      tone=((0, "#0b1f3f"), (0.5, "#2e5c8f"), (1, "#e8eef3")), grain=(14, 1.1)),
    P("calotype", "Calotipo", "oldprocess", "Inspirado en el calotipo de Talbot: negativo de papel, imagen blanda con textura de fibras y tono cálido.",
      kind="bw", contrast=0.9, toe=0.9, shoulder=0.75, black=0.1, white=0.86, w=(0.15, 0.5, 0.35),
      tone=((0, "#2b1a10"), (0.5, "#8b6a48"), (1, "#eadbbb")), grain=(40, 2.0)),
    P("platinum_p", "Platino-paladio", "oldprocess", "Inspirado en las copias de platino y paladio: gama tonal enorme, negros cálidos y luces suaves.",
      kind="bw", contrast=0.92, toe=0.9, shoulder=0.8, black=0.05, white=0.93, w=(0.3, 0.55, 0.15),
      tone=((0, "#1d1612"), (0.5, "#7a6a5c"), (1, "#f3ece2")), grain=(10, 1.0)),
    # ------------------------------------------------------------------ creativas
    P("redscale", "Escala roja", "creative", "Negativo cargado al revés (redscale): rojos, naranjas y amarillos intensos.",
      contrast=1.05, toe=1.05, bal=(0.9, 0.05, -1.8), kmul=(0.9, 1.0, 0.6), sat=1.2, sh=(0.02, -0.004, -0.02), grain=(30, 1.4)),
    P("expired_neg", "Negativo caducado", "creative", "Negativo color caducado: dominantes impredecibles, negros lavados y contraste bajo.",
      contrast=0.82, toe=0.8, shoulder=0.75, black=0.1, bal=(0.04, 0.06, -0.06), sat=0.75, sh=(-0.01, 0.015, 0.01), grain=(34, 1.5)),
    P("expired_slide", "Diapositiva caducada", "creative", "Diapositiva caducada: virada al magenta, luces lavadas y contraste irregular.",
      kind="slide", contrast=1.05, toe=1.1, shoulder=0.9, black=0.04, bal=(0.05, -0.04, 0.03), sat=0.9, grain=(24, 1.3)),
]

PROFILE_BY_ID = {p["id"]: p for p in PROFILES}
