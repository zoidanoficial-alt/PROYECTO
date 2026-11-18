# CINELAB para Android

**CINELAB** es un laboratorio de dirección de fotografía en el móvil, no solo un editor. Es la versión Android de ENTERGALACTIC y comparte con el plugin de Photoshop el mismo motor, catálogo de filtros y recetas.

## La pantalla

- **Barra superior:**
  - ⊕ abrir
  - ↶ deshacer
  - ↷ rehacer
  - ◐ antes / después
  - ⤓ exportar
- **Lienzo** fijo arriba. Mantenlo pulsado para ver el original.
- **Modo Director** y **Modo Profesional.**
- **Seis laboratorios:** Film, Color, Optics, Retouch, Mono y AI.

## Laboratorios

| Lab | Qué hace |
|---|---|
| **Film 🎞** | 69 perfiles de película (cine, diapositiva, retrato, instantánea, copias de proyección, procesos históricos), looks de 14 directores de fotografía, grano, halación, bloom, daños, respiración y compresión de película, cámaras antiguas |
| **Color ◑** | Ruedas de color (sombras, medios, luces), HSL, curvas RGB, balance de blancos, split toning, contraste y saturación, detalle, viñeta y grano, recorte; además, filtros de color y arte pop inspirado en Warhol |
| **Optics ✦** | Destellos de lente, fugas de luz, glow, rayos de luz, aberración cromática, difusión óptica, filtros estrella, partículas y efectos de cristal (prisma, arcoíris, cristal, esmerilado) |
| **Mono ◐** | Blanco y negro analógico: películas, filtros de color, contraste tonal, grano, texturas, negros profundos, virados y simulación de papel (RC brillante y perla, mate, baritado neutro, cálido y frío) |
| **Retouch ✎** | *Fase 2:* imperfecciones con un toque, dodge & burn con pincel, selección de personas y piel con IA, piel, borrado de objetos |
| **AI ✺** | *Fase 3:* reducción de ruido, superresolución, recuperación de detalle, desenfoque de fondo, restauración, segmentación |

## Los dos modos

- **Modo Director:**
  - Looks cinematográficos y perfiles de película con miniaturas de tu foto.
  - **Intensidad del look.**
  - **✦ Ajuste inteligente**: exposición y tono automáticos.
  - **♥ Recetas**: guarda tu edición completa y aplícala a otras fotos con un toque.
- **Modo Profesional:**
  - Revelado base completo (laboratorio Color).
  - Pila de **capas** independientes, hasta 15. Cada capa se puede:
    - activar u ocultar, reordenar (▲▼) o quitar (✕)
    - ajustar en sus parámetros, su **opacidad** y su **modo de fusión**
    - limitar con una **máscara**: sombras, medios, luces, un color, el centro, los bordes, arriba o abajo; con suavidad e inversión

Todo es **no destructivo**: la foto original nunca se toca. Deshacer y rehacer guardan hasta 60 pasos, y la edición se recuerda al cerrar la app.

Funciona **sin conexión** y procesa las fotos en el propio móvil. No envía nada a internet.

## Descargar e instalar

1. Desde el móvil, con tu sesión de GitHub iniciada, abre:
   `https://github.com/zoidanoficial-alt/PROYECTO/releases/download/entergalactic-android/CINELAB.apk`
2. Abre el archivo descargado.
3. Si Android lo pide, permite **«Instalar apps desconocidas»**.

Se instala encima de ENTERGALACTIC, porque es la misma app actualizada. Requiere Android 8.0 o posterior.

Las fotos se guardan en *Imágenes › CINELAB* como JPEG. Al exportar eliges el tamaño: hasta 4096 px, original o 2048 px.

## Cómo está hecha

```
entergalactic-android/
├── web/                     ← la app (HTML/CSS/JS); funciona también en un navegador
│   ├── eg-core.js           ← núcleo del motor (port de eg/core.py)
│   ├── eg-filters.js        ← filtros de looks (port de los filtros Python)
│   ├── eg-filters2.js       ← película, óptica, cristal y papel (port)
│   ├── eg-develop.js        ← Revelado (exclusivo de la app)
│   ├── worker.js            ← procesado en segundo plano (Web Worker)
│   ├── app.js, index.html, app.css
│   └── schema.json          ← catálogo de filtros y recetas, generado desde el motor Python
├── android/                 ← proyecto Android (Gradle): WebView + galería + guardado
├── tools/build_web.py       ← regenera web/schema.json
├── tools/make_fixtures.py   ← casos de referencia con el motor Python
├── tests/compare.js         ← verifica que el motor JS da el mismo resultado que el Python
└── tests/develop.test.js    ← pruebas de cada control del Revelado
```

**Un solo catálogo.** Las recetas y los parámetros se generan desde el mismo motor que usa el plugin de Photoshop. Una receta nueva en el escritorio llega al móvil con `python tools/build_web.py`.

**Verificado contra Python.** `tests/compare.js` aplica cada filtro, cada receta y cada tipo de máscara en JavaScript y en Python sobre la misma foto (134 casos):
- **Filtros deterministas:** diferencia media inferior a 0,004.
- **Filtros aleatorios** (grano, polvo, fugas de luz): se comparan por media y contraste.

**Ligera.**
- El procesado ocurre en un Web Worker, así que la interfaz no se bloquea.
- Las vistas previas se calculan a la resolución de la pantalla (máximo 900 px). Mientras arrastras, a menos de la mitad.
- Los desenfoques usan sumas acumuladas, con coste constante por píxel.
- Cada cambio muestra primero una vista rápida y después la definitiva.

**Compilación.** GitHub Actions (`.github/workflows/entergalactic-android.yml`) hace tres cosas en cada cambio:
1. Verifica el motor contra Python.
2. Compila la APK firmada.
3. La publica en la versión `entergalactic-android`.

La clave de firma (`android/keystore/`) es de uso personal para instalar por fuera de Google Play. Para publicar en Play Store hace falta una clave privada que no esté en el repositorio.
