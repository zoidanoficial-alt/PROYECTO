# Revela SL3

Editor de fotos tipo Lightroom que corre en el navegador, pensado para la
**Canon EOS Rebel SL3** (EOS 250D / 200D II / Kiss X10) y con un **asistente
de IA que te va dictando cómo mejorar la resolución y la calidad de tus fotos
de huevos**.

Todo el revelado ocurre en tu equipo (GPU, WebGL2): tus fotos no se suben a
ningún servidor. Solo el análisis opcional con Claude envía una copia
reducida (máx. 1568 px) de la foto.

## Cómo abrirla

```bash
cd revela_sl3
python3 serve.py          # abre http://localhost:8080
```

Los módulos de JavaScript necesitan `http://`; abrir `index.html` con doble
clic (`file://`) no funciona. Cualquier servidor estático sirve (por ejemplo,
GitHub Pages). Desde el celular, ábrela en Chrome o Safari y elige
"Agregar a pantalla de inicio": se instala como app y funciona sin conexión.

Navegadores: Chrome, Edge, Firefox o Safari recientes (requiere WebGL2).

## App para Android (APK)

Cada cambio en `revela_sl3/` compila la APK en GitHub Actions y la publica en:

**https://github.com/zoidanoficial-alt/PROYECTO/releases/download/revela-sl3-latest/RevelaSL3.apk**

1. Abre ese enlace en tu teléfono (con tu sesión de GitHub si el repositorio es privado).
2. Descarga `RevelaSL3.apk` y ábrela; Android te pedirá permitir "instalar apps
   desconocidas" para tu navegador o administrador de archivos.
3. Las versiones nuevas se instalan encima sin perder tus ajustes.

En la app: **Importar** abre tus fotos (JPEG y CR3 que pasaste de la cámara con
Camera Connect o con la tarjeta SD); **Exportar** guarda en
`Documentos/RevelaSL3` y abre el menú Compartir (Fotos, WhatsApp, Drive…);
el dictado usa la voz en español del teléfono.

Compilarla tú mismo (requiere Android SDK y Java 21): `npm ci && npm run android:apk`.

## Qué hace

| Lightroom | Revela SL3 |
|---|---|
| Biblioteca: importar, calificar ★, elegir/rechazar, filtrar | ✔ (también importa la carpeta `DCIM/100CANON` de la SD) |
| Revelar: temperatura, matiz, exposición, contraste, iluminaciones, sombras, blancos, negros | ✔ |
| Presencia: textura, claridad, neblina, intensidad, saturación | ✔ |
| Curva de tonos (RGB y por canal) | ✔ |
| HSL / Color (8 rangos) | ✔ |
| Detalle: enfoque (cantidad, radio, máscara), reducción de ruido (luminancia y color) | ✔ (Alt + arrastrar la máscara la muestra) |
| Efectos: viñeta, grano | ✔ |
| Recortar y enderezar, proporciones, giro 90° | ✔ |
| Gotero de balance de blancos, tono automático | ✔ |
| Historial, deshacer/rehacer, antes/después | ✔ |
| Copiar/pegar/sincronizar ajustes entre fotos | ✔ |
| Ajustes preestablecidos (y guardar los tuyos) | ✔ incluye recetas para huevos y los Estilos de imagen de Canon |
| Vista 1:1 | ✔ |
| Exportar por lote (JPEG/PNG/WebP, tamaño, nitidez de salida) | ✔ conserva EXIF en JPEG |
| Súper resolución | ✔ 1.5x / 2x: re-muestreo bicúbico + nitidez adaptativa (CAS) |

Lo que **no** tiene (todavía): máscaras/ajustes locales, pincel corrector,
panorámicas/HDR y revelado RAW "real" (ver abajo).

### Archivos CR3 de la SL3

La app lee el CR3 directamente y usa el **JPEG de resolución completa
(6000×4000) que la cámara guarda dentro del RAW**, más todo el EXIF (lente,
ISO, abertura, velocidad, orientación). Ese JPEG ya trae el Estilo de imagen y
el balance de blancos de la cámara, así que el margen de edición es el de un
JPEG Fino, no el de un RAW completo. Conserva siempre tus CR3: para rescates
extremos ábrelos en *Digital Photo Professional* (gratis de Canon).

## Asistente para fotos de huevos

Al abrir una foto, el asistente analiza:

- **EXIF**: tamaño de imagen (L / M / S1 / S2 de la SL3), ISO, abertura
  (difracción a partir de f/11), velocidad vs. focal (trepidación), focal
  (magnificación del huevo), compresión JPEG.
- **La imagen**: nitidez (varianza del laplaciano por zonas), ruido
  (estimador de Immerkær), luces quemadas en el cascarón, dominante de color
  (método de "parche blanco" sobre el cascarón).

Te da una calificación y una lista de pasos **en la cámara** (con los nombres
de los menús de la SL3) y **en la edición**. Con **"Aplicar sugerencias"** se
ajustan los controles y con **"🔊 Dictar consejos"** te los lee en voz alta,
para que puedas seguirlos con la cámara en la mano.

Elige el tema: *Huevo blanco*, *Huevo rojo / marrón*, *Huevo cocinado /
platillo* u *Otro*.

### Análisis profundo con Claude (opcional)

Con una clave de API de Anthropic (botón **"Clave de API"**), Claude
(`claude-opus-5-5`) revisa la foto visualmente junto con el EXIF y las
mediciones, y devuelve un diagnóstico, pasos para la próxima toma, pasos de
edición y **valores para todos los controles** que puedes aplicar con un clic.
También puedes hacerle preguntas libres ("¿cómo evito el reflejo en el
cascarón?"). La clave se guarda solo en tu navegador; no la uses en equipos
compartidos.

### Receta rápida SL3 para huevos

Modo **Av**, **f/8**, **ISO 100**, tripié, **autodisparador 2 s** (o disparo
desde Camera Connect), **RAW+L**, Estilo de imagen **Detalle fino**, balance
de blancos personalizado con una hoja blanca, Auto Lighting Optimizer
desactivado, enfoque manual con **ampliación 10x en Visión directa**, zoom a
**55 mm a 25 cm** del sensor para que el huevo llene el cuadro, luz de ventana
difusa de lado y una cartulina blanca del otro. Con huevos blancos compensa
**+2/3 EV** (el exposímetro los subexpone) sin quemar el cascarón.

## Atajos

`←/→` navegar · `0–5` estrellas · `P/X/U` elegir/rechazar/quitar ·
mantener `\` antes/después · `R` recortar · `Z` 1:1 · `W` gotero ·
`Shift+A` auto · `G/D` biblioteca/revelar · `Ctrl+Z` deshacer ·
`Ctrl+C/V` copiar/pegar ajustes · `Ctrl+E` exportar · doble clic en un
control lo regresa a 0.

## Estructura

```
revela_sl3/
  index.html, css/app.css      interfaz
  js/main.js                   lógica de la app
  js/engine.js, js/shaders.js  motor de revelado WebGL2
  js/cr3.js, js/tiff.js        lectura de CR3 y EXIF
  js/loader.js                 decodificación, orientación, EXIF al exportar
  js/analysis.js               histograma, nitidez, ruido, dominante, auto
  js/advisor.js, js/sl3.js     asesor experto sin conexión
  js/claude.js                 asesor con Claude (opcional)
  js/params.js                 controles y ajustes preestablecidos
  js/crop.js, js/curve*.js     recorte y curva de tonos
  sw.js, manifest.webmanifest  app instalable / sin conexión
  tests/                       pruebas (node --test)
```

## Pruebas

```bash
cd revela_sl3
npm test        # o: node --test tests/*.test.js
```
