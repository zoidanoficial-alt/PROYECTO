# Mi Progreso 5.0 (app Android)

App de entrenamiento y progreso físico. Gratis, sin anuncios, sin cuenta y sin internet:
todo se guarda en el teléfono y se exporta cuando quieras.

- **5.0 · Menos fricción:** guardar una serie es un toque (el botón ya trae peso × reps) y el
  botón “＋ Igual” de la barra de descanso repite la serie sin abrir nada. Cambiar de máquina
  es un toque (⇄ en cada ejercicio). La sesión y el descanso sobreviven a cierres y a la app
  minimizada, con aviso nativo al terminar el descanso.
- **5.0 · Personalización real:** dónde entrenas (Planet Fitness, gimnasio completo, casa, sin
  equipo) y molestias (rodilla, hombro, espalda baja, muñeca, codo): las rutinas se adaptan
  solas al empezar y el buscador solo propone lo que puedes hacer. 93 ejercicios con foto,
  incluidos 18 sin equipo o con poco equipo, y ejercicios propios ilimitados.
- **5.0 · Libreta simple o app completa**, constancia sin culpa (meta semanal, semanas en
  pausa que no rompen la racha, sin recordatorios) y CSV compatible con Strong/Hevy para
  exportar e importar.

- **Diseño 4.0:** tema claro (u oscuro), bienvenida guiada, Inicio con “qué toca hoy”,
  botón + para registrar cualquier cosa, y entreno con un ejercicio abierto a la vez,
  botones −/+ para peso y reps y RIR con un toque.
- **Exportar para IA:** reporte PDF (resumen, gráfica de peso, nutrición, progreso por
  ejercicio, volumen, nivel de fuerza, logros y mensaje sugerido para la IA) y Excel con
  9 hojas de datos planos. Se guardan en Descargas/MiProgreso y se comparten desde la app.
- **Planet Fitness:** 75 ejercicios (58 disponibles en PF) con fotos reales de inicio y final
  (Free Exercise DB, dominio público), ficha “Cómo se hace” con pasos en español, peso en kg o lb
  por ejercicio (las máquinas vienen en lb), sustitutos por patrón de movimiento cuando
  una máquina está ocupada y biblioteca con búsqueda.
- **Carga y fatiga:** RIR/RPE por serie, sugerencia de peso × reps para superar la sesión
  anterior, mapa de calor muscular con series efectivas por semana, 1RM (Epley) en vivo,
  recuperación manual (HRV, sueño) con propuesta de descarga.
- **Logros y nivel de fuerza:** récords de peso, reps y 1RM, volumen por sesión, rachas y
  nivel (principiante → élite) en banca, sentadilla, peso muerto y press militar.
- **Fotos:** cámara con la silueta de la foto anterior superpuesta y peso del día en cada
  foto; video de técnica en cámara lenta con marcas manuales de cada repetición.
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

El PDF usa jsPDF y jsPDF-AutoTable (MIT, en `assets/www/vendor/`); el Excel se genera
sin librerías (`assets/www/export.js`).

La app es un `WebView` (`src/.../MainActivity.java`) que sirve `assets/www/index.html`
bajo `https://progreso.local/`, con un puente nativo para guardar copias de
seguridad en `Descargas/MiProgreso`.

## Firma y actualizaciones

`keystore/miprogreso.p12` (contraseña `miprogreso`) firma el APK. Para que una
versión nueva se instale encima de la anterior **sin perder datos**, hay que
firmarla con la misma llave; si se pierde, exporta una copia de seguridad desde
*Más → Copia de seguridad* antes de desinstalar.
