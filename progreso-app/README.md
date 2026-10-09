# Mi Progreso 2.0 (app Android)

App de entrenamiento y progreso físico. Todo se guarda solo en el teléfono.

- **Entreno (Gym Bible):** rutinas predefinidas (Pro Split · Get The Pump, Torso/Pierna)
  o personalizadas; registro de series con la marca de la última vez, aviso de récord
  (sobrecarga progresiva), técnicas (drop set, forzadas, negativas, choque), cronómetro
  de descanso con vibración, volumen semanal por grupo, regla 75/25 y alerta de
  sobreentrenamiento.
- **Nutrición:** calorías con la fórmula de Marc McLean (peso en lb × 12/15/17) y macros
  según somatotipo; registro de comidas, azúcar refinada (máx. 35 g), agua y ventana
  post-entreno de 45 min.
- **Progreso:** peso con media de 7 días y consejo de ajuste, medidas, 1RM estimado por
  ejercicio y fotos con comparación lado a lado o superpuesta (guías de simetría).
- **Más:** perfil, suplementos del día, fisiología del bombeo, mentalidad, las 7 reglas
  de oro (un hábito nuevo por semana) y copia de seguridad.

El contenido está en `assets/www/data.js`, la lógica en `assets/www/app.js`.

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
