# Arquitectura técnica

## Visión general
- **App híbrida:** un `WebView` nativo de Android (Java) que carga una app web local (HTML, CSS y JavaScript sin frameworks) desde `assets/www`, servida bajo `https://progreso.local/` con `WebViewAssetLoader`.
- **Sin backend:** no hay servidor, cuenta ni red. Los datos se guardan en `localStorage` del WebView.
- **Tamaño:** ~10 800 líneas (JS + CSS + Java), APK de ~4.5 MB, 203 fotos de ejercicios.
- **Compilación sin Android Studio:** `build.sh` usa `aapt2`, `javac`, `dx` y `apksig` descargados de Maven Central.

## Estructura del código

```
AndroidManifest.xml        Permisos, receptores, versión
build.sh                   Compila y firma el APK
src/com/zoidan/progreso/
  MainActivity.java        WebView + puente JavaScript (AndroidBridge)
  ReminderReceiver.java    Recordatorios programados (AlarmManager)
  RestReceiver.java        Aviso de fin de descanso
  BootReceiver.java        Reprograma recordatorios al reiniciar
res/                       Icono y recursos Android
assets/www/
  index.html               Estructura de la app y orden de scripts
  styles.css               Estilos por capas de versión; temas oscuro, claro y Modo Ella con variables CSS
  data.js                  Contenido: ejercicios, rutinas, técnica (cómo se hace), nutrición, hábitos
  app.js                   Núcleo: datos, navegación, Hoy, Plan, sesión de entreno, Progreso, Explorar, bienvenida
  decide.js                20.0: historia por ejercicio (hiciste/mejoraste/siguiente), sesión guiada, resultado, medición
  ruta.js                  19.0–20.0: niveles principiante/avanzado, Tu camino por etapas, rutina con variables
  coach.js                 Chequeo de recuperación, plan del día, análisis de tendencias
  strength.js              Fuerza, series semanales, ficha de técnica, récords
  journey.js               Etapas de vida, agenda flexible, constancia sin culpa
  facil.js                 Galería y asistente de rutinas, selector de ejercicios
  missions.js              Misiones por ejercicio
  notif.js                 Recordatorios inteligentes (agenda local)
  cycle.js                 Ciclo menstrual (opcional, con consentimiento)
  ella.js                  Modo Ella (tema y textos en femenino)
  running.js, runplan.js   GPS, guía por voz, planes de carrera
  treadmill.js             Caminadora sin GPS
  pf.js, pecho.js          Catálogo de máquinas de gimnasio y ejercicios de pecho
  retos.js                 Retos de peso corporal
  export.js                PDF (jsPDF), Excel (sin librerías), CSV Strong/Hevy, importación
  icons.js                 Iconos lineales (Lucide)
  vendor/                  jsPDF y jsPDF-AutoTable (MIT)
  fonts/                   Inter (OFL)
  img/                     Logo y fotos de ejercicios
tests/e2e/                 Pruebas de extremo a extremo (Playwright)
docs/                      Historial técnico por versión y protocolo de validación
```

Los scripts se cargan en orden en `index.html` y comparten el ámbito global (sin módulos ni bundler). No hay dependencias de npm en producción.

## Modelo de datos
Un único objeto JSON en `localStorage['miprogreso.v1']` (la misma clave desde la 1.0; las versiones migran los datos al cargar):

| Clave | Contenido |
|---|---|
| `profile` | Perfil y preferencias: nombre, peso inicial/meta, altura, edad, objetivo, somatotipo, nivel, etapa, días y minutos por semana, recuperación, equipo, molestias, tema, Modo Ella, ciclo |
| `days` | Por fecha: peso, comidas, agua, hábitos, recuperación, suplementos, ciclo |
| `sessions` | Entrenos: rutina, día, inicio/fin, ejercicios planeados, cambios, ajustes por cansancio |
| `lifts` | Series: ejercicio, peso (kg), reps, RIR, fecha, sesión |
| `workouts`, `plan` | Entrenos propios y qué entreno toca cada día de la semana |
| `measures`, `achievements`, `goals`, `challenges`, `commits`, `events` | Medidas, logros, metas, retos, compromisos, historia |
| `activities`, `runs`, `runPlan` | Otras actividades y running |
| `feedback`, `metrics` | 20.0: respuestas de claridad y medición de uso local (anónima) |

Las fotos se guardan aparte (IndexedDB) y el descanso en curso en `miprogreso.rest`. Respaldo completo exportable/importable desde la app.

**Límite conocido:** `localStorage` admite ~5 MB; la app compacta series antiguas y avisa al acercarse. Para años de datos conviene migrar a IndexedDB o SQLite.

## Puente nativo (`window.AndroidBridge`)
`vibrate`, `keepScreenOn`, `speak` (voz), `hasLocation`, `scheduleRest`/`cancelRest`, `requestNotifications`, `setReminders` (agenda JSON), `notifStatus`, `openNotifSettings`, `notifyNow`, `takeLaunchTab` (abrir en una pestaña desde una notificación), `saveBase64`/`saveFile` (Descargas/MiProgreso), `shareFile`, `copyText`, `setBars` (color de barras del sistema).

## Permisos
Vibración, cámara (fotos de progreso), ubicación (running con GPS), notificaciones, alarmas exactas (`USE_EXACT_ALARM`, `SCHEDULE_EXACT_ALARM` ≤ API 32) y arranque del sistema (reprogramar recordatorios).

## Compilar, firmar y versionar
```bash
./build.sh                                  # dist/MiProgreso.apk
KEYSTORE=/ruta/llave.p12 KEY_ALIAS=x KEY_PASS=y ./build.sh   # con otra llave
```
- Versión en `AndroidManifest.xml` (`versionCode`, `versionName`) y en `APP_VERSION` de `app.js`.
- Para actualizar sin perder datos, cada versión debe firmarse con **la misma llave** y subir `versionCode`.
- Para Google Play se recomienda generar un **Android App Bundle (AAB)** con Gradle y usar Play App Signing (ver riesgos).

## Pruebas
28 pruebas de extremo a extremo con Playwright (`tests/e2e/run-all.sh`) que recorren los flujos de cada versión, más una sonda de desbordamiento con letra grande. Resultado en la versión 22.0: sin errores. No hay pruebas unitarias ni pruebas en dispositivos físicos automatizadas.
