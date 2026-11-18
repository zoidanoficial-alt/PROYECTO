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

Cada preset ajusta:
- la curva de tonos
- las curvas Rojo, Verde y Azul (el tinte de sombras, medios y luces)
- la saturación
- el panel HSL
- el grano
- una viñeta suave

No toca la exposición ni el balance de blancos, así que puedes ajustarlos después según tu foto.

### Instalar en Windows

1. Descarga y descomprime **camera-raw-presets.zip**.
2. Haz doble clic en **instalar_presets.bat**. Copia los presets a `%APPDATA%\Adobe\CameraRaw\Settings`.
3. Cierra y vuelve a abrir Photoshop.
4. Abre una foto en Camera Raw. Para un JPG ya abierto: *Filtro › Filtro de Camera Raw* (Ctrl+Mayús+A).
5. Ve a la pestaña **Ajustes preestablecidos** (icono de capas) y busca el grupo **FOTONEANDO · Frontera**.

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
