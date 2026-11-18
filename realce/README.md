# Realce IA — mejora de imagen para Photoshop CC 2018

Panel para Photoshop que **amplía con IA (2×, 3×, 4×)**, **reduce ruido** y **enfoca** fotos.
Muestra una vista previa con comparador antes/después. Todo se procesa en tu ordenador,
sin conexión a internet ni suscripciones.

```
Photoshop (panel CEP)  ──exporta PNG──▶  motor Python (OpenCV)  ──PNG──▶  capa / documento nuevo
```

## Requisitos

- Photoshop CC 2018 (v19) o posterior (Windows o macOS)
- Python 3.8 o posterior. En Windows hay que marcar «Add Python to PATH» al instalarlo.

## Instalación

**Windows:** haz doble clic en `install\instalar_windows.bat`.
**macOS:**

```bash
bash install/instalar_mac.sh
```

El instalador:
1. copia `com.realce.panel` a la carpeta de extensiones CEP de Adobe,
2. activa `PlayerDebugMode`, necesario para extensiones sin firmar,
3. instala `numpy` y `opencv-contrib-python`,
4. descarga los modelos rápidos (FSRCNN y ESPCN, menos de 1 MB).

Para el modelo de **máxima calidad** (EDSR, unos 115 MB) añade `--quality`:
`instalar_windows.bat --quality` o `bash install/instalar_mac.sh --quality`.

Después, reinicia Photoshop y abre **Ventana → Extensiones → Realce IA**.

## Uso

1. Abre una foto y ajusta los controles:
   - **Ampliar**: 1× (sin ampliar), 2×, 3× o 4×.
     - *IA rápida* (FSRCNN): segundos.
     - *IA equilibrada* (ESPCN).
     - *IA calidad* (EDSR): la mejor, pero lenta en CPU.
     - *Clásico* (Lanczos).
   - **Reducir ruido**: *Fuerza* controla cuánto ruido se quita. *Detalle* devuelve las texturas finas.
   - **Enfocar**: máscara de enfoque sobre la luminancia, con control de halos.
2. **Vista previa** procesa un recorte de la zona elegida. Arrastra el comparador para ver antes y después.
   Mientras haya una vista previa, al mover un control se actualiza sola.
3. **Aplicar**:
   - sin ampliar → se añade una capa **«Realce IA»** encima (no destructivo).
   - ampliando → se abre un **documento nuevo** `nombre_realce_x2`.

Puedes procesar la **imagen visible** completa o **sólo la capa activa**.
Se respetan las imágenes de 16 bits y la transparencia.

## Solución de problemas

| Problema | Solución |
|---|---|
| El panel no aparece en *Extensiones* | Vuelve a ejecutar el instalador (PlayerDebugMode) y reinicia Photoshop. |
| «No se pudo ejecutar Python» | En **Ajustes** del panel, escribe la ruta completa, p. ej. `C:\Users\tú\AppData\Local\Programs\Python\Python311\python.exe` o `/usr/local/bin/python3`. |
| «OpenCV no tiene dnn_superres» | `pip uninstall opencv-python` y luego `pip install opencv-contrib-python`. |
| «Falta el modelo …» | Ejecuta `python download_models.py` (o con `--quality`) dentro de la carpeta `engine` instalada. |

El botón **Ajustes → Comprobar instalación** muestra las versiones y los modelos disponibles.

## Uso sin Photoshop (línea de comandos)

```bash
cd com.realce.panel/engine
python realce_engine.py -i foto.jpg -o foto_x2.png --scale 2 --model fast --denoise 40 --sharpen 30
```

## Estructura

```
realce/
├── com.realce.panel/          ← la extensión (se copia entera a la carpeta CEP)
│   ├── CSXS/manifest.xml      ← CEP 8, Photoshop 19.0+
│   ├── client/                ← interfaz HTML/CSS/JS (Node para lanzar Python)
│   ├── host/host.jsx          ← ExtendScript: exportar / importar en Photoshop
│   └── engine/                ← motor Python + modelos
├── install/                   ← instaladores Windows / macOS
└── tests/                     ← tests del motor (pytest)
```

## Créditos de los modelos

Modelos de super-resolución preentrenados para OpenCV `dnn_superres`:
- FSRCNN y EDSR: [Saafke/FSRCNN_Tensorflow](https://github.com/Saafke/FSRCNN_Tensorflow), [Saafke/EDSR_Tensorflow](https://github.com/Saafke/EDSR_Tensorflow)
- ESPCN: [fannymonori/TF-ESPCN](https://github.com/fannymonori/TF-ESPCN)

Antes de distribuir el plugin, revisa sus licencias.
