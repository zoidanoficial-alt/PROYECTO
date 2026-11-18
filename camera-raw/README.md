# Presets de Camera Raw desde imágenes

Presets **.xmp** para Camera Raw. Funcionan con Photoshop CC 2018 (Camera Raw 10) y versiones posteriores, en fotos RAW y JPG.

## Paquete «FOTONEANDO · Frontera»

Creado a partir de cinco fotografías de referencia de color callejero en diapositiva: luz dura, negros densos y colores de pigmento.

| Preset | Look |
|---|---|
| **FT 00 Frontera (serie)** | Promedio de las cinco referencias: el look de toda la serie |
| **FT 01 Tormenta dorada** | Luz dorada bajo un cielo de tormenta: medios cálidos, cielos densos, amarillos encendidos |
| **FT 02 Rosa del desierto** | Sol del desierto: cielo azul profundo, blancos cálidos, rosas y rojos |
| **FT 03 Hora azul** | Crepúsculo violáceo: todo se hunde en azul, con las luces apagadas |
| **FT 04 Sombra dura** | Luz rasante de tarde: negros profundos, sombras verdosas y piel cálida |
| **FT 05 Muro turquesa** | Pleno sol en la calle: sombras de tinta, turquesas y cartón cálido |

## Paquete «FOTONEANDO · Retrato»

Creado a partir de cinco retratos de referencia: luz tropical, pastel, blanco y negro, y neón de noche.

| Preset | Look |
|---|---|
| **FR 01 Trópico** | Retrato con luz de ventana: piel dorada, mar turquesa, negros profundos y grano fino |
| **FR 02 Pacífico pastel** | Contraste suave, negros lavados, verdes apagados y luces color crema |
| **FR 03 Plata solar** | Blanco y negro a contraluz: piel luminosa, cielos dramáticos y mucha textura |
| **FR 04 Neón lima** | Noche de neón: verdes lima, rojos y turquesas, con un halo de luz alrededor del sujeto |
| **FR 05 Neón nocturno** | El mismo neón pero más denso, con sombras negras y verdes profundos |

## Paquete «FOTONEANDO · Óscar»

Quince presets inspirados en las películas ganadoras del Óscar a Mejor Fotografía en las ceremonias de 2012 a 2026. Cada uno es una interpretación propia del color y la textura de la película, no el etalonaje oficial.

| Preset | Película · director de fotografía | Look |
|---|---|---|
| OS 2012 Richardson · Reloj de ámbar | Hugo · Robert Richardson | Ámbar de lámpara, sombras verde azuladas, brillo suave |
| OS 2013 Miranda · Océano luminoso | Life of Pi · Claudio Miranda | Limpio y luminoso, turquesas intensos |
| OS 2014 Lubezki · Órbita | Gravity · Emmanuel Lubezki | Negros profundos, luz dura, tonos fríos y metálicos |
| OS 2015 Lubezki · Tras bambalinas | Birdman · Emmanuel Lubezki | Tungsteno cálido y verdoso, azules apagados, grano |
| OS 2016 Lubezki · Luz natural de invierno | The Revenant · Emmanuel Lubezki | Frío, desaturado, luces suaves |
| OS 2017 Sandgren · Hora mágica musical | La La Land · Linus Sandgren | Violetas y magentas de hora mágica, primarios saturados |
| OS 2018 Deakins · Bruma naranja | Blade Runner 2049 · Roger Deakins | Bruma naranja casi monocroma, bajo contraste |
| OS 2019 Cuarón · Plata nítida | Roma · Alfonso Cuarón | Blanco y negro digital limpio, gris plateado |
| OS 2020 Deakins · Trinchera | 1917 · Roger Deakins | Naturalismo: verdes y amarillos apagados |
| OS 2021 Messerschmidt · Noche de estudio | Mank · Erik Messerschmidt | Blanco y negro de los años 40: negros densos, brillo, grano |
| OS 2022 Fraser · Arena y especia | Dune · Greig Fraser | Arena ocre, contraste suave, color contenido |
| OS 2023 Friend · Frente gris | All Quiet on the Western Front · James Friend | Casi sin color, gris acero, textura áspera |
| OS 2024 Hoytema · Película gran formato | Oppenheimer · Hoyte van Hoytema | Piel cálida, negros profundos, grano finísimo |
| OS 2025 Crawley · Hormigón cálido | The Brutalist · Lol Crawley | Terrosos de los años 50, negros lavados, grano |
| OS 2026 Arkapaw · Delta del Misisipi | Sinners · Autumn Durald Arkapaw | Piel dorada, negros ricos, verdes húmedos |

### La «base cine para APS-C»

Todos los presets del paquete Óscar incluyen ajustes que hacen parte del trabajo que en el cine hacen la cámara y la lente:

- **Corrección de perfil de lente y de aberración cromática.** Quita la distorsión y los bordes de color de los lentes de kit.
- **Luces que se apagan suavemente**, como en la película: Iluminaciones −35 y Blancos −10, para que el cielo y la piel no se quemen.
- **Sombras abiertas** (+15) con negros firmes, para un rango dinámico parecido al del cine.
- **Menos enfoque digital** y un poco de reducción de ruido, para quitar el aspecto «de video».
- **Grano fino de película**, que da textura y disimula el ruido del sensor.
- **Viñeta suave**, como la de las lentes de cine.

Como estos presets también fijan Iluminaciones, Sombras, Blancos y Negros, aplícalos primero y después ajusta la exposición y el balance de blancos de cada foto. Para regenerarlos o crear variantes, edita y ejecuta `oscar_presets.py`.

## Versión para Canon Rebel SL3 / 250D

Hay dos grupos más, pensados para la Rebel SL3 con el **50 mm** y el **EF-S 18-55 mm f/4-5.6 IS STM**.

**FOTONEANDO · Óscar SL3** tiene los mismos 15 looks del Óscar, ajustados a esa cámara:
- **Calibración de color para el sensor Canon.** Piel menos rosada, verdes menos amarillos, azules más limpios y profundos. Camera Raw 10 no tiene los perfiles «Camera Neutral» para la SL3, así que la corrección se hace en el panel de calibración.
- **Enfoque para 24 MP** y menos ruido de color.
- **Luces más protegidas** (Iluminaciones −42, Blancos −14), porque la SL3 tiene menos rango dinámico que una cámara de cine.
- **Corrección de perfil** del 50 mm y del 18-55.

**FOTONEANDO · SL3 Ajustes** tiene tres complementos que solo tocan el ruido y el enfoque. Aplícalos **después** del look, según el ISO de la foto:
- SL3 · ISO 100-400 (limpio)
- SL3 · ISO 800-1600
- SL3 · ISO 3200-6400 (noche)

### Importante: Photoshop CC 2018 no abre los RAW de la SL3

La SL3 salió en 2019. Sus archivos **.CR3** necesitan Camera Raw 11.3 o posterior, y Photoshop CC 2018 llega hasta Camera Raw 10. La solución es gratis:

1. Instala **Adobe DNG Converter**: https://helpx.adobe.com/camera-raw/using/adobe-dng-converter.html
2. Arrastra tus fotos .CR3, o la carpeta completa, sobre **convertir_cr3_a_dng.bat**.
3. Los DNG aparecen en una subcarpeta **DNG**, en modo compatible con Camera Raw 7.1 o posterior. Ábrelos en Photoshop y se abrirán en Camera Raw con toda la información RAW.

Cada preset ajusta:
- la curva de tonos
- las curvas Rojo, Verde y Azul (el tinte de sombras, medios y luces)
- la saturación
- el panel HSL
- el grano
- una viñeta suave
- en los retratos, también la claridad y la neblina (el halo del neón) y la mezcla de blanco y negro

No toca la exposición ni el balance de blancos, así que puedes ajustarlos después según tu foto.

### Instalar en Windows

1. Descarga y descomprime **camera-raw-presets.zip**.
2. Haz doble clic en **instalar_presets.bat**. Copia los presets a `%APPDATA%\Adobe\CameraRaw\Settings`.
3. Cierra y vuelve a abrir Photoshop.
4. Abre una foto en Camera Raw. Para un JPG ya abierto: *Filtro › Filtro de Camera Raw* (Ctrl+Mayús+A).
5. Ve a la pestaña **Ajustes preestablecidos** (icono de capas) y busca los grupos **FOTONEANDO · Frontera**, **· Retrato**, **· Óscar**, **· Óscar SL3** y **· SL3 Ajustes**.

## Crea tus propios presets desde cualquier imagen

Necesitas Python con `numpy` y `opencv-python`, los mismos que usa el plugin ENTERGALACTIC.

- **Lo más fácil:** arrastra una o varias imágenes sobre **crear_preset_desde_imagen.bat**. Se crea un preset por imagen y se instala solo, en el grupo «Mis referencias».
- **Desde la consola:**

```
python referencia_a_preset.py referencia.jpg
python referencia_a_preset.py ref1.jpg ref2.jpg ref3.jpg --combinar "Mi serie"
python referencia_a_preset.py referencia.jpg --antes mi_foto_sin_editar.jpg --instalar
```

Opciones:

| Opción | Qué hace |
|---|---|
| `--fuerza 0–100` | Qué tanto se acerca a la referencia. Por defecto, 85 |
| `--combinar NOMBRE` | Crea un solo preset con el promedio de todas las imágenes, útil para el look de una serie |
| `--antes FOTO` | Compara contra una foto tuya sin editar. Es más fiel: mide la diferencia real en lugar de suponer una foto neutra |
| `--instalar` | Guarda el preset directamente en la carpeta de Camera Raw |
| `--grupo NOMBRE` | Grupo donde aparece en Camera Raw |

Cómo lee cada imagen:
- Mide los negros, los blancos, el contraste y el brillo de los medios tonos.
- Mide la dominante de color en sombras, medios y luces. Usa solo los píxeles casi neutros, para no confundir un cielo azul o unas flores amarillas con el tinte de la película.
- Mide la saturación general y la de cada color.
- Detecta grano, viñeta y blanco y negro.

El resultado es un punto de partida. La luz y la lente de la escena original no se pueden copiar con ajustes.
