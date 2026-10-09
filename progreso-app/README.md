# Mi Progreso (app Android)

App para medir el progreso físico: peso diario con media de 7 días, medidas,
fuerza (1RM estimado por ejercicio), fotos de progreso con comparación lado a
lado y la rutina del plan. Todo se guarda solo en el teléfono.

## Instalar

1. Pasa `dist/MiProgreso.apk` al teléfono y ábrelo.
2. Si Android lo pide, permite **instalar apps de origen desconocido** para la
   app desde la que lo abriste (Archivos, Chrome, Telegram…).
3. En Xiaomi/Redmi (HyperOS/MIUI) puede salir un aviso de seguridad; elige
   **Instalar de todos modos**.

Requiere Android 8.0 o superior.

## Compilar

```bash
./build.sh
```

Solo necesita Java 17+, `curl` y `python3`. El script descarga de Maven Central
`aapt2`, `dx`, `apksig` y las clases de Android, compila, firma (esquema v2) y deja el
APK en `dist/MiProgreso.apk`.

La app es un `WebView` (`src/.../MainActivity.java`) que sirve `assets/www/index.html`
bajo `https://progreso.local/`, con un puente nativo para guardar copias de
seguridad en `Descargas/MiProgreso`.

## Firma y actualizaciones

`keystore/miprogreso.p12` (contraseña `miprogreso`) firma el APK. Para que una
versión nueva se instale encima de la anterior **sin perder datos**, hay que
firmarla con la misma llave; si se pierde, exporta una copia de seguridad desde
*Más → Copia de seguridad* antes de desinstalar.
