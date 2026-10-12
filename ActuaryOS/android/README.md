# ActuaryOS para Android

App móvil del Caso 1 (reservas de siniestros). Funciona **sin internet**:
todo el cálculo ocurre en el teléfono.

- **Descargar:** [`salida/ActuaryOS-0.1.0.apk`](salida/ActuaryOS-0.1.0.apk)
  (Android 7.0 o superior).
- **Instalar:** abre el archivo en el teléfono y acepta «Instalar apps de
  origen desconocido» para el navegador o administrador de archivos que
  uses. Android mostrará un aviso porque la app no viene de Play Store.

## Qué hace

1. **Datos:** carga un CSV (o pega el contenido, o usa el ejemplo de Seguros
   Horizonte). Elige formato ancho o largo, unidad y moneda.
2. **Revisión:** el detector de errores marca huecos, negativos, datos
   incrementales, números con formato o ambiguos, duplicados, monedas
   mezcladas y factores atípicos, sin corregir nada en silencio.
3. **Métodos:** muestra qué métodos permiten los datos. Ejecuta Chain Ladder,
   Mack y Bornhuetter-Ferguson; este último sólo con primas y una
   siniestralidad a priori que proporciona el usuario.
4. **Resultados:** cada cifra subrayada abre «¿Por qué?» con fórmula, datos,
   pasos, supuestos y limitaciones (modo principiante o experto). Incluye
   comparación entre métodos, escenarios «¿qué pasa si…?» (cola y desarrollo)
   y aprobación o rechazo con nombre del revisor.
5. **Informe:** texto Markdown con las cifras del motor, listo para compartir
   o copiar.

## Arquitectura

```
app/assets/www/motor.js   Motor actuarial (port del paquete de Python actuaryos)
app/assets/www/app.js     Interfaz: sólo presenta lo que calcula el motor
app/src/.../MainActivity  WebView, selector de archivos, compartir y copiar
tests/motor.test.js       Mismas referencias que las pruebas de Python
```

El motor JavaScript se prueba contra los mismos resultados esperados que la
versión de Python: Caso 1 con fracciones exactas, Mack (1993) para Taylor &
Ashe y los archivos con errores intencionales.

```bash
node --test tests/motor.test.js
```

## Compilar

No requiere Android Studio. Se necesitan Java 17+, `curl`, `zip` y `unzip`.

```bash
./construir_apk.sh
```

La primera vez, `herramientas/obtener_herramientas.sh` descarga a
`~/.cache/actuaryos-android`:

- `android.jar` (API 34, de Robolectric).
- `dx` (reempaquetado de AOSP).
- `apksig` (la librería de `apksigner`).
- `aapt2` (paquete npm `aaptjs3`).

La APK se firma con el esquema v2 usando `clave-prueba.p12` (contraseña
`actuaryos-prueba`). **Es una clave de prueba:** sirve para instalar y
actualizar la app de forma manual, no para publicar en Play Store. Para
publicar, genera una clave privada propia y guárdala fuera del repositorio
(`ALMACEN=... CLAVE_ALMACEN=... ./construir_apk.sh`).

## Limitaciones de esta versión

- Sólo lee CSV (Excel: exportar a CSV primero).
- El informe es texto Markdown; Excel y PDF están pendientes.
- No se ha probado en un dispositivo físico ni en emulador desde este
  entorno. La interfaz se probó en Chromium móvil y la APK se verificó
  estructuralmente (firma, manifiesto, recursos y dex).
