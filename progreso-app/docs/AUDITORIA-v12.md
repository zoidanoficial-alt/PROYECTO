# Auditoría de Mi Progreso 11.0 y plan para la 12.0

Fecha: 14 oct 2026. Base auditada: versión 11.0 (`versionCode` 15).

## Cómo se auditó

- **Código:** revisión de los 9 módulos JS de `assets/www` (app, data, coach, journey, cycle, strength, export) y de la capa nativa (`MainActivity`, `RestReceiver`).
- **Carga con 2 años de datos simulados:** 13,345 series, 730 días con peso y comidas, y 104 carreras. Se midió el tiempo de render de cada pestaña y de guardar una serie, con Chromium headless a 393×851.
- **Límite real de `localStorage`:** se midió en el mismo motor que usa el WebView. Da unos 5,000,000 de caracteres.
- **Pruebas funcionales:** las 7 pruebas de extremo a extremo existentes (v7, v9–v14: onboarding, coach, camino, ciclo, fuerza, nutrición y minimalismo) pasan sin errores de consola.

## Resultado de las mediciones

| Medición (2 años de datos) | Valor | Lectura |
|---|---|---|
| Datos guardados | 1.99 M caracteres | Ocupa el **40 %** del límite de unos 5 M |
| Guardar una serie (`logSet`) | 130–200 ms en escritorio | En un teléfono de gama media puede pasar de 0.5 s |
| De eso, serializar los datos | 193 ms en una sola acción | Hay **6–7 guardados por acción**, ~30 ms cada uno |
| Render de las pestañas | 4–72 ms | Correcto |

## Qué hay hoy por área

- **Running:** solo existe un registro manual de actividad (minutos, km, esfuerzo y ritmo calculado). Faltan GPS, parciales, récords, planes, guía por voz, historial, planificación de carreras, misiones y coordinación con la fuerza.
- **Ciclo menstrual:**
  - **Funciona:** registro, predicción con margen, fases orientativas, informe de patrones, y el chequeo solo reacciona a síntomas registrados.
  - **Falla en privacidad:** el Excel "para cualquier IA" incluye la hoja *Ciclo* sin preguntar, no se pueden borrar solo los datos del ciclo, al activarlo no hay un consentimiento explícito, y la tarjeta aparece en Inicio sin opción de ocultarla.
- **Misiones:**
  - **Fuerza:** tiene criterios y seguridad (dolor o descarga, nada de progresar).
  - **Running:** no hay misiones.
  - **Recompensas por exceso:** el mensaje "Modo bestia +N extra" premia las series de más, y el logro "Récord de volumen en una sesión" premia hacer más volumen.
- **Recuperación:** el chequeo usa solo datos que existen y muestra el porqué de cada punto. No inventa métricas.
- **Gamificación:**
  - **Existe:** un nivel global, retos semanales, línea de tiempo y logros.
  - **Falta:** niveles por actividad, una ruta para volver después de una pausa y un resumen mensual.
- **Experiencia de uso:**
  - **Bien:** iniciar un entreno es 1 toque y registrar una serie también.
  - **Sin lugar:** el running no tiene lugar propio dentro de la app.
  - **Accesibilidad:** hay botones de 28–36 px (lo mínimo recomendado es 40–44), no se respeta *reducir movimiento*, y faltan etiquetas accesibles en algunos botones de solo icono.

## Prioridades

### P0: críticas

#### P0-1. Guardados repetidos y lentos
- **Problema:** cada acción serializa los 2 MB de datos entre 6 y 7 veces. Por ejemplo, `missionFor` guarda dentro del render.
- **Solución:** agrupar los guardados de un mismo ciclo de eventos en una sola escritura. Se guarda de inmediato al minimizar o cerrar la app (`visibilitychange` y `pagehide`).
- **Valor:** registrar una serie se siente instantáneo, incluso con años de datos.
- **Componentes:** `app.js` (`saveData`).
- **Dependencias:** ninguna.
- **Riesgo de regresión:** medio, porque si la app se cierra de golpe podría perderse el último guardado. Se mitiga guardando al minimizar.
- **Prueba:** la auditoría de rendimiento antes y después, y recargar la página justo después de una acción.
- **Criterio de éxito:** 1 serialización por acción. `logSet` por debajo de 60 ms con 13 k series. Los datos persisten tras recargar.

#### P0-2. Privacidad del ciclo
- **Problema:** los datos de salud íntima se incluyen en exportaciones pensadas para compartir. Tampoco hay consentimiento explícito ni borrado selectivo.
- **Solución:**
  - Pedir consentimiento explícito al activar, explicando qué se guarda, dónde (solo en el teléfono) y para qué.
  - Interruptores separados para:
    1. usar el ciclo en las recomendaciones;
    2. mostrar la tarjeta en Inicio;
    3. incluirlo en exportaciones (apagado por defecto).
  - Botón "Borrar todos mis datos del ciclo".
  - El Excel y el PDF excluyen el ciclo salvo que se active el interruptor de exportación.
- **Valor:** confianza, porque cada persona controla sus datos de salud.
- **Componentes:** `cycle.js`, `export.js`, `app.js` (Más), `coach.js`.
- **Dependencias:** ninguna.
- **Riesgo de regresión:** bajo.
- **Prueba:** exportar con el ciclo activo y sin permiso de exportación (no debe haber hoja *Ciclo*), activar el permiso (sí debe aparecer) y borrar (no deben quedar campos `cyc`).
- **Criterio de éxito:** las 3 comprobaciones pasan automáticamente.

#### P0-3. Riesgo de llenar el almacenamiento
- **Problema:** con un uso intenso, el límite se alcanzaría en unos 4–5 años, y a partir de ahí los guardados fallarían.
- **Solución:**
  - Compactar las series quitando campos redundantes, como `tech:'normal'`.
  - Mostrar un medidor de espacio en Más.
  - Avisar al 75 % y recomendar una copia de seguridad.
  - La migración a IndexedDB queda como P2.
- **Valor:** evita pérdida de datos a largo plazo.
- **Componentes:** `app.js` (carga y guardado).
- **Dependencias:** P0-1.
- **Riesgo de regresión:** bajo, porque la lectura asume `normal` cuando falta el campo.
- **Prueba:** medir el tamaño antes y después de compactar, y comprobar que las técnicas especiales se conservan.
- **Criterio de éxito:** el tamaño baja al menos un 10 %, el medidor aparece y no se pierde ningún dato.

### P1: alto impacto

#### P1-1. Running: registro real
- **Problema:** no se puede registrar una carrera mientras se corre.
- **Solución:**
  - **Durante la carrera:** pantalla de carrera con GPS del teléfono (geolocalización del WebView y permiso nativo de ubicación), con distancia, tiempo, ritmo actual y medio, y parciales por km.
  - **Filtro de precisión:** se descartan puntos con más de 25 m de error o saltos de más de 12 m/s.
  - **Guía por voz:** con el `TextToSpeech` nativo de Android, mediante un puente.
  - **Si la app se cierra:** la carrera se recupera.
  - **Récords:** 1K, 5K, 10K, 21K y 42K, más la carrera más larga.
  - **Integración con relojes y apps:** importación y exportación de archivos **GPX**, que Garmin, Strava y Coros exportan.
- **Valor:** el corredor registra y ve sus parciales sin otra app.
- **Componentes:** nuevo `running.js`, `MainActivity.java` (permiso de ubicación y TTS), `AndroidManifest.xml`, `index.html`, `styles.css`.
- **Dependencias:** P0-1.
- **Riesgo de regresión:** medio en la parte nativa. Se compila y se verifica con aapt.
- **Prueba:** recorrido GPS simulado en Playwright de 3.2 km con ruido y un punto erróneo, más un GPX de muestra.
- **Criterio de éxito:** la distancia queda dentro de ±3 %, el punto erróneo se descarta, hay 3 parciales, el récord de 1K queda guardado, el GPX importado produce la misma distancia y la carrera se recupera tras recargar.
- **Limitación:** con la pantalla apagada, el WebView deja de recibir GPS. Se mantiene la pantalla encendida durante la carrera, y el servicio nativo en primer plano queda en P2.

#### P1-2. Running: planes y recomendaciones
- **Problema:** no hay ningún plan de running.
- **Solución:**
  - **Planes progresivos:** Empezar a correr (caminar y correr), 5K, 10K, 21K y 42K. Se generan según la fecha de la carrera y los días disponibles, con un aumento máximo del 10 % semanal, una semana de descarga cada 4 y reducción de volumen antes de la carrera.
  - **Siguiente sesión:** con su objetivo y su estructura por bloques, que la voz va anunciando.
  - **Planificación de carrera:** predicción del tiempo con rango (fórmula de Riegel a partir de tu mejor esfuerzo reciente) y ritmo objetivo por km.
  - **Coordinación con la fuerza:** avisa si una sesión dura cae junto a un día de pierna.
- **Valor:** el corredor sabe qué hacer hoy y por qué.
- **Componentes:** `running.js`, `data.js` (plantillas), `coach.js` (chequeo).
- **Dependencias:** P1-1.
- **Riesgo de regresión:** bajo.
- **Prueba:** generar los 5 planes, comprobar la regla del 10 % y la descarga, la predicción de Riegel con un caso conocido y el aviso de coordinación.
- **Criterio de éxito:** ninguna semana sube más del 10 % salvo la semana 1, y la predicción para un 5K de 25:00 da un 10K de unos 52:07.

#### P1-3. Motor de misiones unificado
- **Problema:** las misiones están dispersas y algunas premian el exceso.
- **Solución:**
  - Una tarjeta **"Misiones de hoy"** en Inicio con fuerza, running, hábito y recuperación. Cada misión trae objetivo, criterio de éxito y la razón.
  - Si el chequeo pide reducir, la misión cambia a una alternativa de recuperación.
  - Quitar "Modo bestia" y el logro de volumen.
- **Valor:** cada entreno suma a una meta clara, sin incentivar el sobreentrenamiento.
- **Componentes:** `journey.js`, `app.js`, `coach.js`.
- **Dependencias:** P1-2.
- **Riesgo de regresión:** bajo.
- **Prueba:** misiones con chequeo verde y rojo, y misión de running según el plan.
- **Criterio de éxito:** con el plan en rojo no aparece ninguna misión de progreso, y cada misión muestra el porqué.

#### P1-4. Ciclo: lo registrado frente a lo estimado
- **Problema:** la fase y la próxima regla parecen hechos, cuando son estimaciones.
- **Solución:**
  - Etiquetas "registrado" y "estimado" en la tarjeta y en el día.
  - En la vista de cada día se separa lo registrado de lo estimado.
  - El chequeo usa el ciclo solo con permiso.
- **Valor:** se transmite bien la incertidumbre.
- **Componentes:** `cycle.js`, `coach.js`.
- **Dependencias:** P0-2.
- **Riesgo de regresión:** bajo.
- **Prueba:** comprobar las etiquetas, y que sin permiso el chequeo ignora los cólicos.
- **Criterio de éxito:** ambas comprobaciones pasan.

#### P1-5. Gamificación sana
- **Problema:** el nivel es solo global, no hay ruta para volver tras una pausa y no hay resumen mensual.
- **Solución:**
  - Niveles por actividad (fuerza y running).
  - **"Bienvenido de vuelta"** tras 10 días o más sin moverte: 2 semanas de regreso suave, sin culpa ni rachas.
  - Resumen del mes en Historia.
  - Hitos de running: primer 5K, carrera más larga y récords.
- **Valor:** retención sin ansiedad.
- **Componentes:** `journey.js`.
- **Dependencias:** P1-1.
- **Riesgo de regresión:** bajo.
- **Prueba:** simular una pausa de 14 días, revisar niveles con datos de ambos tipos y el resumen del mes.
- **Criterio de éxito:** aparece la tarjeta de regreso y los niveles se calculan correctamente.

#### P1-6. Experiencia de uso y accesibilidad
- **Problema:** el running no tiene lugar propio, hay botones pequeños, no se respeta reducir movimiento y faltan etiquetas accesibles.
- **Solución:**
  - Entreno con un selector **Fuerza | Running**.
  - Botones de al menos 40 px.
  - Respetar `prefers-reduced-motion` (sin confeti ni brillos).
  - Agregar `aria-label` a los botones de solo icono.
  - Estados vacíos claros en running.
- **Valor:** un producto coherente que cualquiera puede usar.
- **Componentes:** `app.js`, `styles.css`, `running.js`.
- **Dependencias:** P1-1.
- **Riesgo de regresión:** bajo.
- **Prueba:** visual y medición de tamaños en Playwright.
- **Criterio de éxito:** ningún botón interactivo de los steppers mide menos de 40 px.

### P2: evolución posterior

Documentado en este archivo, sin implementar en la 12.0:

- **Servicio nativo de ubicación en primer plano:** para correr con la pantalla apagada. Requiere `FOREGROUND_SERVICE_LOCATION`, una notificación persistente y pruebas en un dispositivo real.
- **Health Connect y relojes (Garmin, Coros, Polar):** requieren SDK o API con credenciales, revisión de permisos de Google y la app de Health Connect. Mientras tanto, la integración disponible es el **GPX**.
- **Migración de datos a IndexedDB:** elimina el límite de 5 M caracteres.
- **PIN o huella para el módulo de ciclo.**
- **Zonas de frecuencia cardiaca:** requieren un sensor, y no se inventan.
- **Música y atenuación de audio** durante la guía por voz.

---

## Resultados de la 12.0 (verificados)

Cada bloque se cerró solo después de pasar sus pruebas propias y las pruebas de regresión de las versiones anteriores, en Chromium headless a 393×851.

| Bloque | Mejora | Evidencia |
|---|---|---|
| 1 · P0-1 | Guardados agrupados | `logSet`: **200 → 15 ms** con 13,345 series. 1 serialización por acción. Los datos persisten al recargar justo después de una acción. |
| 1 · P0-3 | Compactación y medidor | **−16 %** de almacenamiento. Las 60 técnicas especiales de la prueba se conservan. Medidor en Más y aviso al 75 %. |
| 2 · P0-2 | Privacidad del ciclo | Consentimiento antes de activar, también para quien ya lo tenía activado. Excel sin hoja *Ciclo* por defecto y con ella al permitirlo. La copia de seguridad pregunta. El borrado deja 0 campos `cyc`. El chequeo ignora los cólicos sin permiso. |
| 2 · P1-4 | Registrado frente a estimado | Etiquetas "fase estimada", "estimación" y "registrado" en la tarjeta, el registro del día y el calendario. |
| 3 · P1-1 | Running con GPS | Recorrido simulado de 3.2 km con ruido: **error de 0.8 %**. Parciales de 5:32 frente a 5:33 reales. Se descartan 11 puntos imprecisos y un salto de 250 m. La carrera se recupera tras recargar. El GPX importado da la misma distancia. Se exportó un GPX de 576 puntos. Se verificó que `watchPosition` recibe la ubicación real del navegador. |
| 4 · P1-2 | Planes y predicción | 5 planes. **Ninguna semana completa sube más del 10 %**, ni en la meta ni en la suma real de sesiones. Hay descargas y reducción previa. Riegel: 5K en 25:00 da un 10K de 52:07. Sesión guiada de 9 bloques que avanza por tiempo. Misión evaluada. Aviso de coordinación entre fuerza y running. |
| 5 · P1-3/5 | Misiones y regreso | Con el chequeo en rojo no hay ninguna misión de progreso, solo de recuperación. Regreso suave tras 16 días: meta de 2 días y sesión reducida. Niveles de fuerza y running. Resumen del mes. Ya no se premia el exceso. |
| 6 · P1-6 | Accesibilidad | Todos los controles de la sesión miden al menos 40 px. Ningún botón de solo símbolo queda sin `aria-label`. Sin confeti con *reducir movimiento*. |

## Archivos modificados

- **Nuevos:**
  - `assets/www/running.js`: GPS, voz, parciales, récords, GPX e historial.
  - `assets/www/runplan.js`: planes, predicción, misiones y coordinación.
  - `assets/www/missions.js`: misiones de hoy, regreso, niveles y resumen mensual.
- **Modificados:**
  - `assets/www/app.js`: guardado, compactación, selector Fuerza | Running, accesibilidad, integración y consentimiento heredado.
  - `assets/www/cycle.js`: consentimiento, permisos, borrado y etiquetas.
  - `assets/www/coach.js`: nota de coordinación y ciclo con permiso.
  - `assets/www/journey.js`: carreras en días activos, niveles y resumen.
  - `assets/www/export.js`: hoja de Carreras y ciclo con permiso.
  - `assets/www/styles.css`
  - `assets/www/index.html`
- **Nativo:**
  - `src/.../MainActivity.java`: permiso de ubicación para la geolocalización del WebView y `TextToSpeech` mediante un puente.
  - `AndroidManifest.xml`: ubicación precisa y aproximada.

## Limitaciones conocidas

- **Sin prueba en dispositivo:** nada de esto se ha probado en un teléfono real. El GPS y la voz se verificaron en el navegador y con datos simulados, y la parte nativa compila y declara sus permisos (comprobado con `aapt2 dump permissions`).
- **GPS con pantalla apagada:** no funciona, porque el WebView deja de recibir ubicación. La app mantiene la pantalla encendida durante la carrera. La solución es un servicio nativo en primer plano (P2).
- **Relojes y Health Connect:** la integración disponible es el GPX. La conexión directa requiere SDK, credenciales y revisión de permisos (P2).
- **Predicción de carrera:** es una estimación con fórmula (Riegel) a partir de tus mejores tramos recientes. Sin carreras con GPS o GPX no se muestra.
- **Límite de almacenamiento:** sigue existiendo, aunque se redujo y se vigila. La migración a IndexedDB es P2.

---

## 13.0 · Modo Ella 🎀 y corrección de desbordes (verificado)

### Bug: pantallas que se salían por los lados
- **Causa:** con letra grande o "tamaño de pantalla" aumentado en Android, la tira de resumen de Inicio (peso "88.0 kg · media 7 d") medía unos px más que la pantalla. El WebView ensanchaba la página y todo, incluida la hoja "¿Cómo llegas hoy?", quedaba corrido y cortado. Además, las rejillas `repeat(n, 1fr)` se estiraban con palabras largas ("Excelente").
- **Solución (styles.css):**
  - Las 40 rejillas pasan a `minmax(0, 1fr)`.
  - Los hijos de grid y flex llevan `min-width: 0`, y los textos cortos tienen elipsis.
  - Tablas y palabras largas hacen salto de línea.
  - La hoja (`.modal`) nunca supera `100vw`.
  - `html, body` llevan `overflow-x: clip`.
- **Prueba (ovf.mjs):** recorre las 5 pestañas, las 8 vistas de Progreso, Running, la sesión y 5 hojas (chequeo, acciones rápidas, técnica, consentimiento, plan de running), y comprueba que ningún elemento pase del borde.
  - Anchos de 300, 320, 360 y 393 px, con letra al 130 %, 140 % y 150 %, en modo clásico y rosa.
  - Antes: 13 px de desborde en Inicio a 300 px. Ahora: 0 en todos los casos.

### Modo Ella
Un botón en Más → Apariencia y en el paso 1 de la bienvenida, con vista previa al instante.
- **Colores (`look: 'rosa'`):**
  - Paleta rosa y blanco y una variante "rosa noche" para el tema oscuro.
  - Logo rosa/lila (`img/logo-rosa.png`, generado del original), con la barra de estado del mismo color.
  - Hero con corazones en lugar del triángulo naranja, botones redondeados y confeti con corazones.
  - Mapa muscular, gráficas e insignia de récord usan la paleta del tema (antes los colores estaban fijos en el código).
- **Perfil de mujer (`sex: 'f'`):**
  - Textos en femenino ("Agotada", "Estás lista", "descansa tranquila"...).
  - Emojis de persona en versión mujer (🏋️‍♀️ 🏃‍♀️ 🧘‍♀️), y 💪 → 💖, 🏆 → 👑, 🔥 → ✨.
  - Niveles de fuerza con referencias para mujer: banca 0.5/0.75/1.0×, sentadilla 0.75/1.25/1.75×, peso muerto 1.0/1.5/2.0×, press militar 0.35/0.55/0.75×.
  - Puntaje de fuerza ajustado: ~60 % de la referencia de hombre en tren superior, 75–80 % en inferior.
  - El Excel "para IA" dice "mujer".
  - Invitación suave y descartable al módulo del ciclo, que nunca se activa sin consentimiento.
- **Nueva rutina "Glúteo y tonificación · 4 días":** se sugiere al activar el modo si aún no hay entrenos.
- **Ajustes independientes:** colores (Rosa/Logo), claro/oscuro, y textos y referencias (Mujer/Hombre). Apagar el botón vuelve al modo clásico.

### Archivos
- Nuevo `ella.js`.
- Modificados: `app.js` (tema, Apariencia, bienvenida, niveles, observador de textos, confeti, colores), `data.js` (cutsF, rutina gluteo), `strength.js` (STR_FEM, colores), `export.js`, `index.html`, `styles.css`, `AndroidManifest.xml` (13.0 / 17).
- Nueva imagen `img/logo-rosa.png`.

### Verificación
- `v20.mjs`: bienvenida, Inicio, chequeo, Progreso, Apariencia, rosa noche y apagado, sin errores.
- Regresión v9–v19, persist, quota y audit: sin errores.
- Rendimiento con 2 años de datos en modo rosa: pestañas en 12–117 ms, guardar una serie en 19 ms.

### Limitaciones
- El ícono del lanzador de Android sigue siendo el del logo original. Cambiarlo al vuelo requiere un `activity-alias` nativo y reiniciar el lanzador.
- Las fotos y animaciones de técnica de los ejercicios vienen de una base pública y no se cambiaron.
- No probado en un teléfono real.
