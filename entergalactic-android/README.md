# ENTERGALACTIC para Android

Versión móvil de ENTERGALACTIC con las herramientas esenciales:
- **Cine:** 33 looks inspirados en 14 directores de fotografía.
- **Pop:** serigrafía, repeticiones y tramas inspiradas en Andy Warhol.
- **Chroma:** color, luz, contraste y atmósferas.
- **Plata:** blanco y negro químico.
- **Analógico:** cámaras antiguas, fugas de luz, película vintage e instantáneas.

En total, 49 filtros y 70 recetas.

Funciona **sin conexión** y procesa las fotos en el propio móvil. No envía nada a internet.

No incluye **Clean** ni **Realce IA**: necesitan OpenCV y modelos de redes neuronales pesados, y las cámaras de los móviles ya reducen el ruido.

## Descargar e instalar

1. Desde el móvil, con tu sesión de GitHub iniciada, abre la página de la versión **«ENTERGALACTIC para Android»**:
   `https://github.com/zoidanoficial-alt/PROYECTO/releases/tag/entergalactic-android`
2. Descarga **ENTERGALACTIC.apk** y ábrela.
3. Si Android lo pide, permite **«Instalar apps desconocidas»** para el navegador o el gestor de archivos.

Requiere Android 8.0 o posterior.

## Uso

1. **Abrir foto:** elige una imagen de la galería.
2. Elige una pestaña (**Cine, Pop, Chroma, Plata, Analógico**) y toca una receta. Las miniaturas se generan con tu foto.
3. Ajusta la **Intensidad** del look. **Mantén pulsada la foto** para ver el original.
4. En **Ajustar filtros**:
   - Activa o desactiva filtros, reordénalos (▲▼) o quítalos (✕).
   - Toca un filtro para cambiar sus parámetros, su opacidad, su modo de fusión o a qué zona se aplica (sombras, luces, un color, el centro…).
   - Añade más, hasta 15.
5. **Guardar en galería:** la foto se guarda en *Imágenes › ENTERGALACTIC*.
   - En **Ajustes** eliges el tamaño: hasta 4096 px (por defecto), original o 2048 px.

## Cómo está hecha

```
entergalactic-android/
├── web/                     ← la app (HTML/CSS/JS); funciona también en un navegador
│   ├── eg-core.js           ← núcleo del motor (port de eg/core.py)
│   ├── eg-filters.js        ← 46 filtros (port de los filtros Python)
│   ├── worker.js            ← procesado en segundo plano (Web Worker)
│   ├── app.js, index.html, app.css
│   └── schema.json          ← catálogo de filtros y recetas, generado desde el motor Python
├── android/                 ← proyecto Android (Gradle): WebView + galería + guardado
├── tools/build_web.py       ← regenera web/schema.json
├── tools/make_fixtures.py   ← casos de referencia con el motor Python
└── tests/compare.js         ← verifica que el motor JS da el mismo resultado que el Python
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
