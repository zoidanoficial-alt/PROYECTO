# ENTERGALACTIC — suite de efectos fotográficos para Photoshop CC 2018

Un único panel con seis módulos. En cada módulo puedes **combinar hasta 15 filtros** en una misma edición.
Cada filtro tiene su opacidad, su modo de fusión y su máscara: sombras, luces, un rango de color, el centro o los bordes…

| Módulo | Para qué sirve |
|---|---|
| **Chroma** | Color cinematográfico, contraste tonal, saturación, efectos de luz (resplandor, haz de luz, hora dorada), recuperar sombras y luces, filtros fotográficos (cálidos, fríos, polarizador, degradados), tonos específicos (HSL), atmósferas cálidas, frías o dramáticas. |
| **Plata** | Blanco y negro con aspecto de película química: 8 películas (pancromática, clásica 400, 3200, ortocromática, infrarroja…), filtros de color, contraste, estructura (texturas), negros profundos, zonas de luces y sombras, grano orgánico. Técnicas de cuarto oscuro: virados, grado de papel, quemado de bordes, tapado, copia lith y solarización. |
| **Analógico** | Cámaras antiguas (juguete, cajón años 50, placa húmeda, telemétrica años 70, desechable años 90, estenopeica), fugas de luz, polvo, rayones y pelos, películas vintage, desenfoques ópticos (miniatura, bordes blandos, zoom, movimiento), aberración cromática, texturas, viñetas e instantáneas con marco. |
| **Cine** | Looks inspirados en Autumn Durald Arkapaw, Lol Crawley, Hoyte van Hoytema, Greig Fraser y Emmanuel Lubezki (18 recetas, ver [ESTILOS.md](ESTILOS.md)). Incluye copia de cine (film-out), paleta limitada, destello anamórfico y formatos de pantalla. |
| **Clean** | Reducción de ruido de luminancia y de color por separado, **perfiles de ruido por cámara e ISO**, reducción localizada (con la selección de Photoshop o por zonas y colores), conservación de detalle y contraste, píxeles calientes y artefactos JPEG. |
| **Realce IA** | Ampliación 2×, 3× o 4× con redes neuronales, más enfoque de salida. |

Incluye **58 recetas** listas para usar, y puedes guardar las tuyas.

## Instalación

Requisitos: Photoshop CC 2018 o posterior y Python 3.8 o posterior. En Windows, al instalar Python marca «Add Python to PATH».

1. Descarga el repositorio en ZIP y descomprímelo.
2. Instala el panel:
   - **Windows:** doble clic en `entergalactic\install\instalar_windows.bat`.
   - **macOS:** ejecuta `bash entergalactic/install/instalar_mac.sh`.
3. Reinicia Photoshop y abre **Ventana → Extensiones → ENTERGALACTIC**.

Para el modelo de ampliación de máxima calidad (unos 115 MB), ejecuta el instalador con `--quality`.

## Uso

1. Elige un **módulo** (pestaña).
2. Elige una **receta**, o construye la tuya con **＋ Añadir**. Pulsa cada filtro para desplegar sus controles:
   - **Activar / desactivar** con la casilla, y **reordenar** con ▲▼. Los filtros se aplican de arriba abajo.
   - **Duplicar** con ⧉ y **quitar** con ✕.
   - **Opacidad** y **Fusión**: normal, multiplicar, trama, superponer, luz suave, luminosidad, color…
   - **Aplicar a**: toda la imagen, sombras, medios tonos, luces, un rango de color, el centro, los bordes, arriba o abajo. Puedes ajustar la suavidad e invertir.
   - Doble clic en un deslizador lo devuelve a su valor por defecto.
3. Pulsa **Vista previa**. Puedes ver la *imagen completa* o el *detalle al 100 %*, útil para el ruido y el grano. Arrastra el comparador para ver antes y después. Mientras haya vista previa, cada cambio la actualiza.
4. Pulsa **Aplicar**:
   - **Capa nueva** (por defecto): se crea una capa «EG Chroma», «EG Plata»… encima, sin tocar el original.
   - **Si tienes una selección activa**, la capa recibe una **máscara de capa** con esa selección (control localizado). Puedes pintarla después.
   - Si el resultado cambia de tamaño (ampliación con IA o marco de instantánea), se abre en un **documento nuevo**.

**Guardar recetas:** pulsa *Guardar* y ponle nombre. Se guardan en `Documentos/ENTERGALACTIC/recetas` como archivos `.json` que puedes compartir.

**Perfiles de cámara (Clean):**
1. Abre una foto de tu cámara con un ISO concreto. Mejor si tiene zonas lisas: cielo, pared, o una foto desenfocada de una superficie gris.
2. Escribe el nombre, por ejemplo «Canon R6 ISO 6400», y pulsa *Medir y guardar*.
3. Elígelo en «Perfil de ruido». La reducción se adapta al ruido real de tu cámara en sombras, medios y luces.

Si no tienes perfil, el modo *Automático* mide el ruido en cada foto.

## Rendimiento

Medido en una foto de 24 megapíxeles (6000×4000), incluyendo leer y guardar:

| Receta | Tiempo | RAM máxima |
|---|---|---|
| Clásico 400 (Plata) | ~5 s | 1,8 GB |
| Película caducada (Analógico) | ~8 s | 2,2 GB |
| Medio ISO 1600-3200 (Clean) | ~10 s | 2,5 GB |
| Cine verde azulado y naranja (Chroma) | ~13 s | 3,5 GB |

### Vista previa en vivo

El panel está pensado para responder al instante:

- **Motor persistente.** Python, NumPy y OpenCV arrancan una sola vez. Antes, cada vista previa volvía a arrancarlos (más de 1 s).
- **Exportación ligera.** Para la vista previa, Photoshop exporta la imagen reducida a 1400 px y en 8 bits, o un recorte de 1024 px al 100 %. Esa exportación se reutiliza mientras no edites el documento.
- **Vista en vivo al arrastrar.** Mientras mueves un deslizador se calculan vistas rápidas a media resolución (unos 45 ms, hasta ~16 por segundo). Al soltar llega la vista de calidad completa (unos 230 ms).
- **Sin colas atrasadas.** Si mueves deprisa, solo se calcula el último ajuste.

Medido con la foto de 24 MP reducida a 1400 px: unos 45 ms en vista rápida y unos 230 ms en calidad completa. En la prueba del panel, arrastrar un deslizador durante 1,5 s produjo 24 actualizaciones.

## Estructura

```
entergalactic/
├── com.entergalactic.panel/       ← la extensión (se copia entera a la carpeta CEP de Adobe)
│   ├── CSXS/manifest.xml          ← CEP 8: Photoshop 19.0 en adelante
│   ├── client/                    ← panel HTML/JS + schema.json (catálogo generado)
│   ├── host/host.jsx              ← ExtendScript: exportar, importar, máscara de selección
│   └── engine/
│       ├── eg_engine.py           ← línea de comandos que usa el panel
│       ├── build_schema.py        ← regenera client/schema.json
│       └── eg/                    ← núcleo y filtros (chroma, plata, analog, clean, realce) + recetas
├── install/                       ← instaladores
└── tests/                         ← pytest
```

**Añadir un filtro nuevo:**
1. Escribe una función con `@register(...)` en el módulo que corresponda.
2. Ejecuta `python engine/build_schema.py`.

El panel genera sus controles automáticamente.

## Línea de comandos (sin Photoshop)

```bash
python eg_engine.py -i foto.jpg -o salida.png --recipe receta.json
```

```bash
python eg_engine.py -i foto.jpg --measure-noise --save-profile "Mi cámara ISO 3200" --profiles-dir perfiles
```

## Nota sobre nombres

ENTERGALACTIC usa nombres propios para sus módulos y sus películas simuladas («Clásica 400», «Diapositiva años 60»…). No usa marcas comerciales de otros productos ni de fabricantes de película.
