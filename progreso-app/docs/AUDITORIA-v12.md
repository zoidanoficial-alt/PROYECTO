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

---

## 14.0 · Planet Fitness México y caminadora (verificado)

Fuente: informe "Planet Fitness México: caminadoras y catálogo completo de máquinas". Solo se usó lo que el informe respalda, con su nivel de confianza.

### Caminadora (sin GPS) — `treadmill.js`
- **Selector en Running:** "📡 Calle (GPS) | 🏃 Caminadora". Lo respetan todas las formas de empezar: libre, sesión del plan y recomendación.
- **Entrenamientos guiados:**
  - Caminadora libre.
  - Intervalos 6 × 1 min.
  - Colinas 6 × 2 min (solo cambia la inclinación).
  - Caminata inclinada 12-3-30.
  - Caminata activa.
  - Las velocidades se escalan con tu trote cómodo: el que sale de tus carreras recientes (zonas de ritmo) o uno que fijas tú.
  - Las sesiones del plan se traducen a km/h, incluido el ritmo tempo y el de intervalos.
- **Pantalla en vivo:**
  - Velocidad e inclinación con botones de 44 px, limitadas a los rangos de la Matrix Endurance (0.8–20 km/h, 0–15 %; modelo probable, marca confirmada).
  - Distancia = velocidad × tiempo, más parciales por km, metros subidos y aviso por voz en cada cambio ("Pon 10.4 km/h y 1 % de inclinación").
- **Al terminar:** "¿Qué marca la consola?" para corregir distancia y minutos con la medida real de la banda. Si la corrección pasa del 2 %, se descartan los parciales calculados.
- **Recuperación:** la sesión se recupera si se cierra la app, sin inventar minutos (máximo 5 s por intervalo).
- **Récords:** las sesiones de caminadora no cuentan, porque cada banda mide distinto. Tampoco exportan GPX.

### Tu Planet Fitness — `pf.js`
- **Ubicación:** Más → Dónde entrenas → "Tu Planet Fitness" (si tu gimnasio es Planet Fitness).
- **Contenido de la hoja:**
  - Sucursal y membresía Classic / Black Card.
  - 33 equipos en 4 secciones: fuerza, peso libre/poleas/circuito, cardio y spa Black Card.
  - Cada equipo lleva su etiqueta: Confirmado en México, Probable o No verificado en MX.
- **Marcar "No hay":**
  - En una máquina, sus ejercicios quedan fuera y las rutinas usan sustitutos con la lógica existente. Ejemplo: sin prensa, la Prensa 45° se cambia por Sentadilla en Smith.
  - En Smith, poleas o mancuernas, se actualiza el equipo.
  - Solo aplica cuando entrenas en Planet Fitness.
- **Black Card:** con el chequeo bajo, la misión de recuperación y la recomendación sugieren HydroMassage o sillón de masaje, aclarando que no sustituye el sueño.
- **Nuevas actividades:** Elíptica, Escaladora, Remo (con distancia) y Circuito 30 min.

### Archivos
- Nuevos: `treadmill.js`, `pf.js`.
- Modificados: `running.js` (ganchos de caminadora, selector, historial), `app.js` (hasEquip, Más), `coach.js`, `missions.js`, `data.js` (actividades), `index.html`, `styles.css`, `AndroidManifest.xml` (14.0 / 18).

### Verificación
- **v21.mjs, con reloj simulado:**
  - En intervalos, la distancia calculada coincide con la teórica (3,206.7 m) y salen 3 parciales.
  - Los segmentos cambian la velocidad (6.8 → 10.4 → 6.4 km/h) y la pausa no suma distancia.
  - La sesión se recupera tras recargar y la corrección con la consola funciona (6.10 km guardados).
  - No afecta los récords; el tempo del plan sale a 9.2 km/h y el modo calle sigue usando GPS.
  - Prensa marcada "No hay" deja fuera sus 2 ejercicios con sustitutos, sin afectar otros gimnasios. Smith "No hay" quita y devuelve el equipo.
  - Black Card sugiere spa y aparecen las 4 actividades nuevas.
- **Desborde con letra al 140–150 %** (incluidas la hoja PF, la caminadora y el formulario de actividades): 0 px.
- **Regresión v9–v20 y persist:** sin errores.

### Limitaciones
- El modelo exacto de caminadora en PF México no está confirmado (el informe lo marca como "probable").
- La app no se conecta a la consola Matrix: no hay API pública, y el Bluetooth o Apple Watch depende de la consola. La distancia se confirma a mano.
- El catálogo es del informe; la disponibilidad real se marca por sucursal.

---

## 15.0 · Retos de peso corporal y rutina "Héroe ágil" (verificado)

Fuente: informe "El entrenamiento de Tom Holland para Spider-Man (2016–2026): qué está confirmado y qué no". Solo se usó lo que el informe da por confirmado, y se aplicaron sus propias recomendaciones: copiar la estructura y no el volumen, mantener el cardio, no seguir dietas extremas y no hacer acrobacia sin supervisión.

### Retos (`retos.js`)
- **Ubicación:** Entreno → Fuerza → "Retos de peso corporal".
- **Cindy:** AMRAP de 5 dominadas, 10 flexiones y 15 sentadillas.
  - Duración de 10, 12, 15 o 20 min; por defecto 12, como recomienda el informe.
  - Botón grande "+1 ronda" con deshacer, cuenta regresiva y avisos por voz (mitad del tiempo, último minuto, "¡Tiempo!").
  - Al final pregunta las repeticiones extra de la ronda incompleta (0–29).
- **Escalera (Duffy Gaver):** la ronda n son n dominadas, 2n fondos, 3n flexiones, 4n abdominales y 5n sentadillas, subiendo hasta el tope y bajando a 1.
  - Topes de 3, 5, 8 o 10; por defecto 5 (375 repeticiones). La versión de 10 son 1,500 repeticiones en 19 rondas, igual que en el informe.
  - Se marca "✓ Ronda lista" y cuenta el tiempo. Si la terminas antes, se guarda como intento parcial y no cuenta como marca.
- **Variantes de dominada:** estrictas, asistidas o remo invertido.
- **Marcas personales:** solo se comparan entre el mismo reto, duración/tope y variante. Una marca nueva genera un evento en el historial y confeti.
- **Referencia de Tom Holland:** sus 27 rondas se muestran como contexto, no como meta.
- **Pantalla bloqueada:** tocar fuera no cierra el reto, y la pantalla se queda encendida.
- **Registro:** cada reto cuenta como actividad ("Reto peso corporal") y hay una hoja "Retos" en el Excel.

### Rutina "Héroe ágil · inspirada en Tom Holland"
- **Circuito de fuerza de Ashwell, 2 veces por semana:** peso muerto ×8, press inclinado ×10, elevaciones de piernas ×15 y fondos lastrados ×12, en 5 rondas con 30 s de descanso.
- **Un día de peso corporal con lastre opcional.**
- **Cardio de 20–30 min.**
- **Reto semanal.**
- **Pesos:** la descripción aclara que su peso muerto era a 2× su peso corporal y que tú empiezas con el peso que te permita 8 repeticiones limpias. El coach de cargas hace el resto.

### Ficha "Cómo entrena Tom Holland: lo confirmado"
- **Fases** de 2008 a 2026.
- **Qué copiar:** estructura, cardio, porciones con la mano (2 puños de cada grupo) y creatina.
- **Qué no:** 500 kcal al día con 16 km de carrera, mortales sin progresión y macros inventados.
- **Aviso** de que no hay afiliación con Marvel, Sony ni el actor.

### No incluido (y por qué)
- **Circuito HIIT con mancuernas (bear crawl, thrusters, remo renegado):** el informe dice que su atribución por película es contradictoria, y esos ejercicios no existen en el catálogo con foto y técnica.
- **EMS y máscara de altitud:** requieren equipo, y el informe no aporta evidencia de beneficio.
- **Acrobacia:** el informe la desaconseja sin entrenador.

### Verificación
- **v22.mjs, con reloj simulado:**
  - Cindy de 10 min con 12 rondas + 7 se guarda como marca, genera su actividad y su evento, y el deshacer funciona.
  - Un segundo intento peor no cuenta como marca, y otra variante cuenta por separado.
  - La escalera hasta 3 hace las rondas 1-2-3-2-1 y se completa.
  - Una escalera parcial no cuenta como marca, y tocar fuera no cierra el reto.
  - Los 6 ejercicios de la rutina existen y la ficha no desborda.
- **Desborde** a 320 y 393 px con letra al 140 %: 0 px.
- **Regresión v9–v21 y persist:** sin errores.

---

## 16.0 · Salir (⬅️) y reiniciar (↺) una sesión sin descartar ejercicio por ejercicio (verificado)

**Problema:** al empezar un entreno de rutina (p. ej. "Héroe ágil · inspirada en Tom Holland"), los ejercicios ya vienen cargados. Para cancelar, había que bajar hasta el final y tocar "Descartar sesión" con confirmación. Para empezar de nuevo, había que reiniciar ejercicio por ejercicio.

**Solución (`app.js`, `styles.css`):**
- **⬅️ en la cabecera de la sesión:** sale y borra la sesión al instante, sin diálogo. Borra sus series y los récords que generaron.
- **↺ en la cabecera:** reinicia la misma rutina desde cero. Borra las series, quita los ejercicios añadidos, deshace las metas de series cambiadas y los cambios de ejercicio, y reinicia el reloj. Las adaptaciones automáticas a tu equipo y molestias se recalculan. Se conservan el plan del chequeo, la versión corta y el lugar (gym/casa/hotel).
- **Red de seguridad:** ambos muestran el aviso "Sesión borrada (N series) · Deshacer" o "Sesión reiniciada · Deshacer" durante 6 s. Deshacer restaura la sesión exacta: series, récords, extras y metas.
- **"Descartar sesión" al final:** ahora hace lo mismo que ⬅️.
- **Botón Atrás de Android:** sigue llevando a Inicio sin borrar nada, para poder consultar algo a mitad del entreno.

**Verificación (`v23.mjs`):**
- Rutina "Héroe ágil", día 1, con 2 series: ⬅️ deja 0 sesiones, 0 series y ningún diálogo.
- Deshacer devuelve las 2 series y la sesión activa.
- Con un ejercicio extra y una meta de series cambiada, ↺ deja 0 series, 4 ejercicios, meta original (5) y reloj nuevo. Deshacer lo devuelve todo (2 series, extra, meta 3).
- ⬅️ sin series muestra "Sesión cancelada".
- Al vencer el aviso y recargar, la sesión ya no existe.
- La cabecera cabe a 320 px con letra al 140 %.
- Regresión v9–v22, persist y desborde: sin errores.

---

## 17.0 · Notificaciones: recordatorios locales inteligentes

**Problema:** la app solo avisaba el fin del descanso. No recordaba el entreno, el chequeo, el peso, el agua, la proteína ni el running.

**Diseño:**
- **Local y privado:** la página arma una agenda de 7 días con tus datos (`notif.js`) y Android la dispara con AlarmManager aunque la app esté cerrada (`ReminderReceiver.java`). No hay servidor, cuenta ni datos que salgan del teléfono.
- **Solo cuando hace falta:** la agenda se recalcula cada vez que sales de la app (visibilitychange/pagehide), al abrirla y al cambiar ajustes. Si ya entrenaste, te pesaste, hiciste el chequeo o llegaste a tu meta de agua o proteína, ese aviso desaparece.
- **Tipos de aviso** (cada uno se activa por separado y con hora propia):

  | Aviso | Hora por defecto | Cuándo |
  |---|---|---|
  | Entreno del día | 18:00 | Días de tu agenda, con el nombre del día de la rutina |
  | Sesión de running | 07:00 | Días con sesión del plan; reemplaza al de fuerza |
  | Chequeo | 08:00 | Días de entreno |
  | Peso | 07:30 | Cada mañana |
  | Agua | 11:00, 15:00 y 19:00 | Solo si vas por debajo del 30/60/85 % de tu meta |
  | Proteína | 20:30 | Solo si te falta más del 30 % |
  | Compromisos | 20:00 | Si tienes uno pendiente |
  | Regreso amable | 18:00 | Uno solo por pausa, con 4+ días sin actividad |
  | Resumen semanal | Domingo 19:00 | Cada semana |
  | Ciclo | 09:00 | Apagado por defecto. Texto discreto ("Recordatorio de tu calendario"), porque se ve en la pantalla bloqueada |

- **Reglas:**
  - Nada entre 22:00 y 7:00. La hora se elige en una lista de 24 h, de 07:00 a 21:45 cada 15 min (el selector nativo del navegador cortaba el "p. m." y 18:00 se veía como "06:00").
  - Máximo 4 avisos al día, por prioridad: running/entreno > chequeo > peso > proteína > agua > compromisos.
  - Tono sin culpas ni rachas.
- **Permisos:**
  - Tarjeta única en Inicio: "Activar notificaciones" o "Ahora no". Al activarlas se pide el permiso de Android 13+.
  - En Más → Notificaciones: estado real del sistema (`areNotificationsEnabled`), botón "Abrir ajustes" si están bloqueadas, "Enviar una de prueba" y lista de los próximos 4 avisos.
- **Al tocar un aviso** se abre la pestaña que corresponde: Entreno, Nutrición, Progreso o Inicio.
- **Reinicio del teléfono o actualización de la app:** `BootReceiver` vuelve a programar la agenda guardada. Es el único receptor expuesto y solo atiende BOOT_COMPLETED y MY_PACKAGE_REPLACED. El receptor que muestra los avisos no está expuesto, así que otra app no puede hacer que Mi Progreso muestre notificaciones falsas.
- **Batería:** alarmas con ventana de 10 min (`setWindow`), sin alarmas exactas.

**Archivos:**
- Nuevos: `notif.js`, `ReminderReceiver.java`, `BootReceiver.java`.
- Modificados: `MainActivity.java` (setReminders, notifStatus, openNotifSettings, notifyNow, takeLaunchTab, onNewIntent, permiso), `AndroidManifest.xml` (RECEIVE_BOOT_COMPLETED, receptores, singleTop, 17.0 / 21), `app.js`, `index.html`, `styles.css`.

**Limitaciones:**
- Probado con un bridge de Android simulado y el reloj fijado. Falta comprobarlo en un teléfono real.
- Algunas capas de Android (MIUI/HyperOS de Xiaomi, por ejemplo) bloquean las alarmas de apps en segundo plano. Si no llegan, en Ajustes → Apps → Mi Progreso → Ahorro de batería hay que elegir "Sin restricciones" y activar el inicio automático.

**Verificación (`v24.mjs`, bridge de Android simulado, reloj fijado el miércoles 14/10 a las 06:00):**
- La tarjeta de Inicio activa los avisos y pide el permiso.
- 28 avisos programados en 7 días, 0 en horario nocturno y máximo 4 por día.
- Hoy: 7:30 peso, 8:00 chequeo, 18:00 "Hoy toca: Pierna" y 20:30 proteína.
- Tras pesarse, beber 3.5 L, comer la proteína, hacer el chequeo y entrenar, no queda ningún aviso de hoy.
- Con una sesión de running hoy, solo queda "🏃 Hoy: 5 km suaves".
- El regreso amable sale una sola vez, se conserva entre recálculos y no se repite cuando ya pasó.
- Al apagar el agua, desaparecen sus avisos; con el peso a las 09:15, el aviso se mueve a esa hora; las horas van de 07:00 a 21:45.
- "Enviar una de prueba" funciona y "Abrir ajustes" aparece cuando están bloqueadas.
- Al salir de la app se recalcula la agenda, y al tocar un aviso se abre la pestaña correcta, también si la app estaba cerrada.
- Al apagar el interruptor general, la agenda queda vacía.
- Sin errores de consola.

---

## 17.0.1 · Fácil de usar (respuesta al primer feedback de usuarios)

**Feedback recibido:** "no se siente fácil de usar", "es un laberinto", "no motiva".

**Diagnóstico (medido con una usuaria nueva, 393 px):**
- **Inicio:** 16 bloques y 1,779 px de alto. El chequeo aparecía 3 veces y había dos cosas llamadas "Retos".
- **Entreno:** para cambiar de rutina había que abrir un desplegable con nombres poco claros ("Pro Split · Get The Pump"). Para armar la propia había que elegir "Mi semana (personalizada)" en ese desplegable.
- **Selector de ejercicios:** un ejercicio a la vez, filtro en menú desplegable.

**Cambios:**
1. **Modo Ella desde Inicio.**
   - Botón 🎀 en la cabecera de Inicio: un toque activa o desactiva.
   - Al apagarlo vuelve el tema (claro u oscuro) que tenías antes.
2. **Inicio enfocado.**
   - Arriba, lo que toca hoy, con los puntos de tu semana y un mensaje de ánimo dentro de la tarjeta principal ("¡Te falta 1 para cumplir tu semana! 🔥").
   - Debajo, solo "Para hoy": comida y agua, misiones y, si aplica, tu ciclo.
   - Todo lo demás va en una sola sección plegada, "Más para ti".
   - Se quitó la tarjeta de chequeo duplicada y "Retos de la semana" pasó a llamarse "Metas de la semana".
   - Alto de 1,779 a 1,046 px.
3. **Rutinas fáciles.**
   - **Tarjeta "Tu rutina" siempre visible en Entreno:** tus días como fichas. Tocas un día y ves sus ejercicios, empiezas o editas.
   - **🔄 Cambiar rutina:** galería con nivel, días y vista previa de cada rutina, con "Usar" o "Usar y personalizar".
   - **✨ Crear mi rutina en 3 pasos:**
     - Días → enfoque de cada día (con un reparto sugerido según cuántos días eliges; en Modo Ella prioriza glúteo) → lista.
     - La app elige ejercicios que puedes hacer con tu equipo y sin cargar tus molestias.
     - Prioriza los que tienen foto y evita los de nivel avanzado.
   - **✏️ Personalizar** convierte cualquier rutina de la app en "Mi rutina" editable, asignada a tus días.
   - **Editor de la semana en una sola hoja:** cambiar el entreno de cada día, crear uno nuevo desde ahí y editar sus ejercicios.
   - **Series con botones −/+.**
4. **Ejercicios del Excel** (`ejercicios_pecho_peso_libre.xlsx`, 24 ejercicios PEC-001…PEC-024, en `pecho.js`).
   - Los 7 que ya existían conservan su nombre, para no romper el historial, y reciben la ficha del archivo. Son: press banca con barra, inclinado con barra, banca con mancuernas, inclinado con mancuernas, press de piso con mancuernas, aperturas y fondos con lastre.
   - Los 17 nuevos se suman al catálogo.
   - 15 tienen foto de inicio y final (Free Exercise DB, dominio público, recortadas a 420×280). Los otros usan pictograma: landmine, aperturas en el suelo y pullover transversal.
   - **Ficha de cada ejercicio:** zona del pecho, banco o ángulo, nivel, series × repeticiones · descanso, descripción y 💡 consejo clave. Los de nivel avanzado llevan aviso de spotter.
   - Al añadir un ejercicio se usan las series, repeticiones y descanso del archivo.
5. **Selector de ejercicios nuevo.**
   - Fichas de músculo (incluida "🆕 Pecho peso libre") y "Mi equipo" de un toque.
   - Búsqueda también en inglés.
   - Selección múltiple ("Añadir 2 ejercicios") y botón ⓘ para ver la técnica sin perder lo elegido.
6. **Guía de 4 pasos** la primera vez (también a quien ya usaba la app): Inicio, tu rutina, registrar y deshacer, y Modo Ella.
7. **Entreno:** lo secundario (series de la semana, mapa muscular, balance, técnicas) va en una sección plegada, "Tu semana y más".

**Verificación (`v25.mjs`):**
- La guía aparece y se marca como vista.
- **Inicio:**
  - 2 secciones visibles más "Más para ti" plegada con 8 dentro, 0 chequeos duplicados y 3 puntos de semana.
  - 🎀 activa rosa y femenino (con rutina de glúteo si no hay entrenos), se oculta fuera de Inicio y al desactivar vuelve el modo clásico.
- **Entreno:**
  - Tarjeta de rutina con 7 fichas y sin el desplegable viejo.
  - Tocar un día → Empezar inicia "Día 1 · Pierna".
- **Selector:** muestra los 24 de pecho con peso libre. "Añadir 2 ejercicios" añade Svend 3×10–15/60 s y aperturas inclinadas 3×10–15/75 s.
- **Ficha:** el press declinado con barra muestra 4 datos, consejo clave y foto.
- **Rutinas:**
  - La galería → glúteo → Usar funciona.
  - Personalizar crea 4 entrenos asignados a 4 días.
  - En 3 pasos con L, X y V sugiere Empuje, Jalón y Pierna, y crea 5, 5 y 6 ejercicios: todos hacibles y ninguno avanzado.
- **Editor de la semana:** lunes a descanso y martes con un entreno nuevo "Abdomen exprés" de 2 ejercicios; el botón + sube las series a 4.
- **Pie de Más:** "Mi Progreso 17.0.1".
- Desborde a 320, 360 y 393 px con letra al 130–140 %: 0 px (las tiras de días y de enfoques se desplazan de lado a propósito).
- Regresión v9–v24 y persist: sin errores de la app.
  - A esas pruebas se les agregó un paso que cierra la guía nueva tras el registro inicial. v11 y v13 ahora abren "Más para ti" antes de buscar la agenda.
  - v14 muestra un aviso de Chrome ("navigator.vibrate bloqueado sin un toque previo"). Lo provoca la vibración de un logro al dibujar Inicio justo después de recargar, sin que la prueba haya tocado la pantalla. En Android la vibración pasa por el puente nativo y no tiene esa restricción.

---

## 18.0 · Diseño de alto rendimiento

**Objetivo:** que se sienta como un entrenador personal de alto rendimiento, no como un juego infantil. Sigue la maqueta y los 5 cambios del brief del usuario.

**Paleta** (tokens en `styles.css`, capa 18.0):

| Token | Valor | Uso |
|---|---|---|
| Midnight | `#111C23` | Fondo del modo oscuro, la identidad principal y el tema por defecto |
| Performance | `#25D8D0` | Botón principal, datos y semana |
| Ivory | `#FAF7F5` | Fondo del modo claro |
| Ella | `#E94F83` | Acento del modo claro (navegación activa, línea de "Tu misión de hoy", botón Modo Ella) y color principal del Modo Ella |

**Los 5 cambios:**
1. **Menos emojis.**
   - Iconos lineales coherentes: 72 iconos de Lucide (licencia ISC, `fonts/LICENSE-Lucide.txt`) en `icons.js`.
   - `iconify()` cambia los emojis de la interfaz (títulos de sección, barras de herramientas, botones, fichas de rutina, selectores) por su icono. Lo hace al dibujar cada pantalla y en todas las pestañas.
   - Los emojis quedan en mensajes y celebraciones (avisos breves, récords).
2. **Jerarquía clara en Inicio:**
   - Una misión principal, tres indicadores (puntos, días activos, peso medio) y accesos rápidos (Peso, Agua, Comida, Registro).
   - Debajo, "Para hoy" y "Más para ti" plegado.
   - El botón flotante (+) no aparece en Inicio porque los accesos rápidos ya cubren eso.
3. **Tipografía:**
   - Inter (variable, `fonts/InterVariable.woff2`, licencia OFL) incluida en la app, así que funciona sin internet.
   - Títulos en semibold. Saludo en dos líneas: "Buenas tardes," normal y el nombre en negrita.
4. **Gamificación sobria:**
   - Sin decoraciones de corazones ni el triángulo naranja en la tarjeta principal.
   - Sin confeti al activar Modo Ella ni al crear una rutina (queda para récords y entrenos terminados).
   - Barras de un solo color y mensajes en gris.
5. **El entreno como protagonista:**
   - Tarjeta "Tu misión de hoy" con la foto del primer ejercicio del día fundida a la derecha.
   - Botón "▶ Empezar entrenamiento" en píldora turquesa.
   - Semana L–D con puntos rellenos para los días entrenados y "3 de 5 sesiones esta semana".

**Se conserva:** el turquesa, la identidad de Modo Ella (ahora ivory + rosa), la navegación inferior y el registro de la semana.

**Archivos:**
- Nuevos: `icons.js`, `fonts/InterVariable.woff2`, `fonts/LICENSE-Inter.txt`, `fonts/LICENSE-Lucide.txt`.
- Modificados: `styles.css` (capa 18.0), `app.js` (misión, indicadores, accesos, saludo, iconos al dibujar), `facil.js` (semana de 7 días, indicadores, botón Ella con icono), `index.html`, `AndroidManifest.xml` (18.0 / 23).

**Verificación (`v26.mjs`):**
- Inicio en oscuro, claro y Modo Ella, Entreno y Más.
- Inter cargada.
- Ningún emoji en la interfaz de las 5 pestañas, según el recorrido de `v26c`.
- Sin errores de consola.
- **Desborde:** a 320, 360 y 393 px con letra al 130–150 %, en clásico y rosa, da 0 px. El botón de la misión y el texto de la semana bajan de línea solo cuando no caben.
- **Regresión v9–v26 y persist:** sin errores de la app.
  - v11 y v15 abrían "Registrar" con el botón + de Inicio, que ahora está oculto; usan la misma hoja de Registro.
  - v13 abría el chequeo desde el recuadro de Inicio, que ya no existe; el chequeo sigue en Entreno ("Chequeo de hoy") y en las misiones.
  - v14 conserva el aviso de Chrome sobre `navigator.vibrate` explicado en la 17.0.1.

---

## 19.0 · Arquitectura de producto: un camino claro

**Problema (del usuario):** la app tenía muchas funciones que competían por la atención. Alguien nuevo no entendía en cinco segundos qué puede hacer, qué debería hacer ahora ni qué consigue si lo hace.

**Tres niveles:**

| Nivel | Dónde | Contenido |
|---|---|---|
| 1 · Lo que debo hacer ahora | **Hoy** | Tu objetivo en una línea ("Objetivo: bajar a 81 kg · te faltan 7 kg"), una sola misión con un solo botón y **qué vas a conseguir** al hacerla ("Al terminar: completas 3 entrenos y desbloqueas tus récords"). Debajo, la semana. Todo lo demás va en "Más de hoy", plegado. |
| 2 · Lo que necesito para avanzar | **Plan** | Tu plan del día, tu rutina (días, cambiar, personalizar, crear en 3 pasos) y el registro de la sesión. |
| 3 · Lo que quiero explorar | **Explorar** | Nutrición, estadísticas, running, retos, ejercicios, otras actividades y ajustes. |

**Qué salió de la primera vista de Hoy:** los tres indicadores, los cuatro accesos rápidos (el registro rápido queda en el botón +) y el aviso de notificaciones (ahora se ofrece después del primer entreno: "¿Te aviso para el siguiente entreno?").

**Navegación:** Hoy · Plan · (Nutrición) · Progreso · Explorar.
- **Principiante:** 4 pestañas. Nutrición vive en Explorar porque no es lo primero que necesita para empezar.
- **Avanzado:** 5 pestañas, porque ahí nutrición es una necesidad propia y diaria.

**Dos experiencias.** Se eligen en la bienvenida ("¿Cuánta guía quieres?") y se cambian en Explorar → "Tu experiencia".

- **Principiante:**
  - **Rutina adecuada:** no se le pide elegir entre rutinas que no conoce. La app arma cuerpo completo para sus días (torso/pierna o glúteo con 4 o más), con su equipo y sus molestias, a 3 series. Si empieza desde cero (etapa 1), le da "Primeros pasos".
  - **Primer día:** si aún no tiene entrenos, Hoy nunca muestra "Descanso". La misión es **"Tu primer entreno"**, sea el día que sea.
  - **Tu camino:** primer entreno → 3 entrenos → semana cumplida → primer récord → 10 entrenos. Cada hito dice qué desbloquea, y el último propone el modo avanzado.
  - **Plan:** solo el plan del día, la rutina y el chequeo, sin barra de herramientas, retos ni análisis semanales.
  - **Progreso:** "Resumen" con entrenos totales, semana, kg desde el inicio y tus mejores marcas (se desbloquean con 3 entrenos), más Peso y Fotos. Logros aparece al desbloquear el hito de 3 entrenos.
  - **Estadísticas completas:** se piden desde Explorar o Progreso y ofrecen pasar a avanzado.
- **Avanzado:** todo lo anterior a la vista: personalizar rutinas, progresión por ejercicio, tendencias, récords, variables (series, RIR, técnicas) y las 8 vistas de Progreso.
- **Quien ya usaba la app:** se le asigna avanzado si tiene 5 o más entrenos, rutina propia o etapa 3 o más; si no, principiante. Lo puede cambiar en un toque.

**Corrección incluida:** desde la 18.0 el `<body>` lleva `data-tab`. El código que ocultaba la pestaña Nutrición tomaba "el primer elemento con data-tab=food", que en Nutrición era el propio `<body>`, y dejaba la página en blanco. Ahora se busca solo dentro de la barra de navegación.

**Archivos:**
- Nuevo: `ruta.js` (niveles, hitos, objetivo, resultado de la misión, Explorar, Progreso de principiante, rutina de inicio).
- Modificados: `app.js` (Hoy, Plan, Progreso, Explorar, navegación, bienvenida), `facil.js` (guía nueva), `notif.js`, `icons.js`, `index.html` (Hoy, Plan, Explorar), `styles.css` (capa 19.0), `AndroidManifest.xml` (19.0 / 24).

**Verificación:**
- **`v27.mjs`:**
  - La bienvenida propone principiante.
  - **Hoy:** 4 pestañas; la primera vista es objetivo + misión + Tu camino; sin indicadores ni accesos rápidos; "Más de hoy" plegado.
  - **Plan:** sin barra de herramientas ni análisis.
  - **Progreso:** Resumen, Peso y Fotos, con marcas bloqueadas.
  - **Explorar:** Nutrición abre su pestaña y Estadísticas ofrece pasar a avanzado.
  - **Con 3 entrenos:** se cumplen 3 hitos, aparecen las mejores marcas y la pestaña Logros.
  - **En avanzado:** 5 pestañas, Plan completo y las 8 vistas de Progreso.
- **`v27b`:**
  - Una principiante recibe cuerpo completo L/X/V con 6 ejercicios a 3 series.
  - El aviso de notificaciones no aparece antes del primer entreno.
  - Quien elige avanzado ve 4 rutinas para elegir y se le guarda la elegida (tp4).
- **`v27c`:** un jueves sin entrenos, Hoy muestra "Tu primer entreno · Cuerpo completo", y Empezar abre la sesión de 6 ejercicios.

---

## 20.0 · Los datos se convierten en decisiones

**Objetivo:** pasar de un diario de gimnasio a un entrenador. Cada dato que la persona registra se usa para responder tres preguntas: *esto hiciste, esto has mejorado y este es tu siguiente objetivo*.

**1. Datos → decisiones (`decide.js`):**
- `exStory(ejercicio)` agrupa el historial por sesión y devuelve:
  - **Esto hiciste:** la última sesión (series y mejor serie).
  - **Has mejorado:** el cambio desde la primera sesión, en % de fuerza estimada (1RM) o en reps si es con peso corporal. Distingue "estable" y "día bajo" sin culpa.
  - **Siguiente objetivo:** la sobrecarga progresiva que ya existía (`suggestion`, con RIR y rango de reps), con una alternativa y el porqué. Si hay estancamiento, propone cambiar el estímulo.
- **Dónde se ve:**
  - **Hoy:** debajo del botón, "Objetivo clave: Sentadilla en Smith 22.5 kg × 10 (la última vez 20 kg × 12)".
  - **Sesión:** cada ejercicio muestra su objetivo y lo deja precargado en peso y reps.
  - **Pantalla final:** comparación con la vez anterior y los objetivos del siguiente entreno.
  - **Progreso (principiante):** "Tus ejercicios" con la historia completa de cada uno. Ya no hay que esperar 3 entrenos para verlo.

**2. Tu camino con significado:** son 4 etapas en orden, cada una desbloquea la siguiente y la recompensa es la prueba con tus números.

| Etapa | Meta | Prueba que se muestra |
|---|---|---|
| Primer entreno | Completar la primera sesión | "Punto de partida medido en N ejercicios" |
| Dominar tu rutina | Entre 3 y 6 sesiones (2 por cada tipo de entreno) con ≥ 80 % de las series | "N sesiones completas · haces el X % de tus series" |
| Superar un récord | Superar la marca de inicio en cualquier ejercicio | "Sentadilla en Smith: 20 kg × 12 → 25 kg × 10 (+19 %)" |
| Construir consistencia | Cumplir la meta semanal 4 semanas seguidas | "4 semanas seguidas cumpliendo tu plan" |

- Al completar las 4 se ofrece (sin presionar) el modo avanzado.
- Sustituye a los 5 hitos de la 19.0, que eran conteos.

**3. Primer entreno guiado (principiante):**
- Ejercicios numerados y en orden; solo uno abierto a la vez.
- Foto animada (inicio/final), "Cómo se hace" en 3 pasos y el error a evitar, sin tener que abrir otra pantalla.
- **Primera vez:** "Elige un peso con el que hagas 12 reps y te sobren 2–3. Si dudas, empieza ligero."
- **Después:** "Tu objetivo: 22.5 kg × 10", precargado.
- **Registro mínimo:** peso, reps y "¿Cómo se sintió?" con tres opciones (Fácil / Bien / Al límite), que se guardan como RIR 4 / 2 / 0. Desaparecen el contador de series iguales, la meta ±, la barra "contra tu última vez", el chequeo previo y el selector de lugar.
- "Serie 1 de 2: hazla y anota lo que lograste"; al guardar empieza el descanso con su duración explicada.
- **Cuándo terminaste:** aparece una tarjeta "Terminaste todos los ejercicios" y el botón cambia a "Terminar y ver mi resultado".

**4. Pantalla final:**
- Título según lo que pasó: "Primer entreno completado", "Superaste tu marca", "Mejoraste respecto a la última vez" o "Entrenaste con inteligencia".
- Tiempo, series y ejercicios.
- Si se completó una etapa, su prueba y la meta de la siguiente.
- "Esto hiciste y esto cambió" ejercicio por ejercicio.
- "Tu siguiente objetivo": cuándo (p. ej. "Lunes · Cuerpo completo") y los pesos de los 3 primeros ejercicios.

**5. Los cuatro riesgos señalados:**
- **Misión en día de descanso:**
  - Se quitó la regla de la 19.0 que forzaba a entrenar.
  - Ahora la misión es "Descanso activo": caminar, movilidad y dormir, más cuándo es el próximo entreno.
  - Si aún no ha entrenado nunca, la misión es "Prepárate", con "Mira tus ejercicios" para ver cómo se hacen.
  - "Entrenar hoy de todos modos" queda como enlace secundario.
- **Rutinas automáticas:** además de los días, ahora usan:
  - **Tiempo por sesión:** de 3 a 6 ejercicios, y se recorta si la estimación pasa del tiempo.
  - **Experiencia:** 3 series en básicos y 2 en accesorios al empezar.
  - **Objetivo:** reps y descansos según definición, volumen o mantenimiento.
  - **Recuperación:** pregunta nueva en la bienvenida, "¿Cómo duermes y te recuperas?"; si es "Mal", una serie menos.
  - **Equipo y molestias.**
  - En Plan se ve **"Por qué esta rutina"** con cada variable aplicada, y el botón "Ajustar a mi tiempo y recuperación" rehace la rutina (con Deshacer).
- **Exceso de recompensas:**
  - Mensajes de la sesión sobrios: "Serie 2 de 3 hecha", "Completado".
  - Sin confeti al completar un ejercicio, solo un pulso discreto; el confeti queda solo para récords reales.
  - Los logros ya no lanzan avisos al terminar la sesión (la pantalla final lo explica).
  - Los textos ya no usan "¡Al 1000%!".
- **Pruebas técnicas ≠ validación:**
  - La app no envía nada por internet, así que se agregó medición local: días de uso, entrenos empezados, terminados y cancelados, descansos hechos y horas hasta el primer entreno.
  - Tras los 3 primeros entrenos pregunta "¿Supiste qué hacer en cada paso?" (Sí / Más o menos / No, con comentario opcional).
  - En Explorar, "Ayúdanos a mejorar" comparte un **reporte anónimo** en JSON, sin nombre, peso, medidas, fotos ni ciclo.
  - El protocolo para probar con personas está en `docs/VALIDACION.md`.

**Archivos:**
- Nuevo: `decide.js`.
- Modificados:
  - `ruta.js`: etapas, objetivo clave, Progreso y rutina con variables.
  - `app.js`: misión de descanso, sesión guiada, mensajes, medición, bienvenida y Explorar.
  - `coach.js`: se retiró el resumen anterior.
  - `facil.js`: "Por qué esta rutina".
  - `index.html`.
  - `styles.css`: capa 20.0.
  - `AndroidManifest.xml`: 20.0 / 25.

**Verificación (`v28.mjs`), con reloj fijo:**
- **Bienvenida:** 30 min, recuperación "Mal" y definición dan cuerpo completo L/X/V con 4 ejercicios a 2 series de 10–12 y 5 razones visibles.
- **Jueves:** "Prepárate", sin botón de entrenar; se marca la recuperación.
- **Viernes:**
  - Sesión guiada: 4 tarjetas, una abierta, con "Cómo se hace" y las 3 opciones de esfuerzo, sin chequeo ni selector de lugar.
  - Al registrar todo aparece "Terminaste todos los ejercicios".
  - Pantalla final con la etapa 1 completada y objetivos para el lunes; se responde la pregunta de claridad.
- **Lunes:** "Objetivo clave: Sentadilla en Smith 22.5 kg × 10 (la última vez 20 kg × 12)", y la sesión precarga ese objetivo.
- **Progreso:** muestra la historia por ejercicio.
- **Reporte:** no contiene el nombre.
- **Ajustar a 4 días / 60 min / Bien:** da torso y pierna con 6 ejercicios a 3 series.
- **Con sesiones simuladas:** "Dominar tu rutina" exige 4 sesiones con 2 tipos de entreno, y "Superar un récord" muestra "20 kg × 12 → 25 kg × 10 (+19 %)".

---

## 21.0 · Fisicoculturismo para competir, adaptado a Planet Fitness

**Objetivo:** programas de competencia ya armados, para que la persona solo elija uno y empiece, y que se adapten solos a lo que tiene su Planet Fitness.

**Programas (`compite.js`):** cuatro, cada uno con su fuente.

| Programa | Días | Nivel | Contenido |
|---|---|---|---|
| Golden Six · inspirado en Arnold | 3 | Principiante–intermedio | Cuerpo completo |
| Arnold split · nivel I | 6 | Intermedio | Pecho+espalda / hombro+brazo / pierna ×2, 3–4 × 10 |
| Era dorada · volumen de competencia | 6 | Avanzado | Pirámides 10/8/6/4; súper series de antagonistas; condensa la doble sesión de los 70 |
| Classic Physique · inspirado en Chris Bumstead | 6 de 8 | Avanzado | Rotación 3-1-3-1 de su preparación 2023 |

**Dónde están:**
- Explorar → **Competir**.
- Plan → Cambiar rutina, en la sección "Fisicoculturismo · para competir".

**Cómo se usan:**
- La vista previa muestra el ejercicio que harás y, tachado, el original.
- **"Empezar hoy"** elige el programa y abre la sesión del día 1 en un toque.

**Planet Fitness revisado (`pf.js`):**
- **Catálogo:** 34 máquinas y equipos de fuerza (antes 21), en 3 secciones:
  - Placas.
  - Discos Matrix Magnum: hack squat, press supino, pantorrilla sentado, Glute Trainer, prensa 45° y remo en T.
  - Peso libre: half rack, bancos, barras fijas, zona PF 360 y paralelas.
- **Cuatro niveles de confianza:** confirmado en México, estándar de la cadena, varía por club y no verificado. Lo que varía o no está verificado solo entra a las rutinas si marcas "Sí".
- **Half rack:** anunciado en 2026 para 7 clubes. Si lo marcas, la app deja la sentadilla, el press y el peso muerto con barra.

**Adaptación curada:**
- `PF_SWAP` define, para cada ejercicio, el sustituto más fiel en orden de preferencia. Ejemplos:
  - Sentadilla con barra → hack squat → Smith.
  - Peso muerto → rumano en Smith.
  - Press banca → press Magnum → Smith.
  - Remo en T → remo con pecho apoyado.
- En la sesión el cambio se explica, por ejemplo: "adaptado a Planet Fitness: press plano de discos, lo más parecido a la barra".
- Fuera de PF se usa el sustituto genérico de siempre.

**Ejercicios nuevos (14):**
- Press Arnold, curl concentrado, encogimientos, curl de muñeca.
- Curl y press francés con barra EZ: equipo nuevo "barra de peso fijo"; se agrega solo a PF y a gimnasio completo.
- Press Magnum, press inclinado en máquina, elevaciones laterales en máquina.
- Remo en T Magnum, remo con pecho apoyado, pullover en polea.
- Glute drive Magnum, sit-ups.
- Llevan foto de Free Exercise DB (dominio público) y ficha "Cómo se hace".

**Preparación para competir:** tarjeta en Plan con la fecha del show y la categoría (Classic, Bodybuilding, Men's Physique, Bikini, Wellness, Figura).

| Fase | Cuándo | Cardio | Poses | Nutrición |
|---|---|---|---|---|
| Fuera de temporada | Más de 20 semanas antes del show | 20 min, 3–5 días | 2 veces por semana | Volumen |
| Preparación | De 20 semanas a 8 días antes | 30 min diarios, que suben hasta ~45 si la pérdida de peso se estanca | 10–15 min diarios | Definición |
| Semana del show | Últimos 7 días | Suave, sin experimentos | Ensayo diario de poses y entrada | Sin cambios drásticos; la guía el coach |
| Después del show | — | Suave | Descanso de poses | Regreso gradual al mantenimiento |

- En todas las fases: foto semanal de frente, lado y espalda.
- **Límite de seguridad:** la app no da protocolos de deshidratación, diuréticos ni sustancias, y lo dice.

**Fuentes y límites:** `docs/FUENTES-v21.md`. Las cifras vienen de fuentes secundarias que difieren entre sí.

**Riesgo de marca:** "CBUM" es marca registrada y él tiene una app que compite con esta. Los nombres visibles están en `COMP_NAMES`, en un solo lugar, para renombrarlos antes de vender o publicar.

**Verificación (`tests/e2e/v29.mjs`):**
- Usuario de Planet Fitness avanzado:
  - Competir muestra 4 programas con sus cambios: Golden Six 12, nivel I 20, era dorada 24, Classic 6.
  - La vista previa de nivel I muestra press Magnum, press inclinado en Smith, remo en Smith y rumano en Smith en vez de los de barra.
  - "Empezar hoy" abre el día 1 con 4 adaptaciones explicadas.
- **Con half rack marcado:** la sentadilla, el peso muerto y el press banca con barra se quedan.
- **Hoja de máquinas:** 42 elementos (34 de fuerza y peso libre, más 8 de cardio) en 4 secciones. El spa solo aparece con Black Card.
- **Preparación:** con show el 8 ene 2027 y Classic Physique, la fase sale "Preparación · 12 sem".
- **Gimnasio completo (no PF):** 0 cambios en era dorada.
- **Corrección antes de entregar:** al agregar la tarjeta de preparación se perdió por error el enlace de los botones de la tarjeta de rutina (Cambiar rutina, Editar, días). La prueba `v25` lo detectó y se restauró.

---

## 22.0 · CBUM a fondo y kit del competidor

**Mi rutina sin ganas de armarla:**
- El editor de la semana (Plan → Editar) empieza con **"¿Sin ganas de armarla? Entrena como…"**. Hay seis tarjetas:
  - CBUM · prep Olympia
  - CBUM · off-season 2024
  - Tom Holland · Spider-Man
  - Arnold split
  - Golden Six
  - Arnold · era dorada
- Cada tarjeta abre la vista previa con sus ejercicios, adaptados a tu gimnasio. Desde ahí hay tres opciones:
  - **Empezar hoy**
  - **Usar esta rutina tal cual**
  - **Ponerla en mi semana y editarla**: respeta su orden y sus descansos de lunes a domingo; CBUM queda Cuádriceps, Pecho, Espalda, Descanso, Hombro, Femoral, Brazo.
- Las filas usan días abreviados (Lun…Dom) y un lápiz lineal, para que no se corten con letra grande. Era el problema de tus capturas.

**CBUM a fondo (`kit.js`):**
- **15 sesiones documentadas** (2022–2025) con el orden real de ejercicios y sus técnicas (tempo 3-1-1, volumen alemán, tri-sets, isométricos, rest-pause, drop sets). Cada una dice:
  - de qué video o newsletter viene,
  - su nivel de confianza,
  - si las series son del video o aproximadas.
- **"Entrena como CBUM hoy"** empieza una sesión suelta sin cambiar tu rutina.
- La rotación de preparación ahora usa sus sesiones reales. Hay una rotación nueva: **off-season 2024 de 9 días**.
- **14 ejercicios nuevos:**
  - Pendulum y belt squat, sentadilla sissy, curl femoral de pie
  - Fondos en máquina, press JM, remo alto, press declinado en máquina
  - Pullover en máquina, extensión sobre la cabeza en polea, curl araña
  - Aperturas inclinadas en polea, pájaro en polea, elevación tibial
- **Corrección para Planet Fitness:** las máquinas que PF no tiene en su catálogo ahora se cambian por un sustituto (antes se daban por disponibles). Ejemplos:
  - Pendulum → hack squat
  - Belt squat → Smith
  - Hammer Strength → press Magnum
  - Remo alto → remo sentado

**Kit del competidor (Explorar → Competir), 9 herramientas:**
1. Programas completos.
2. Entrena como CBUM hoy.
3. **Mi show:** fecha, categoría (se suma Women's Physique) y fase.
4. **Poses obligatorias** por categoría y federación (NPC/Pro League o IFBB/FMFF), con cómo hacer cada una. Incluye práctica cronometrada: cada pose 20–60 s, 10 s para cambiar, 2 vueltas, vibración y minutos acumulados.
5. **Nutrición del competidor** (Helms 2014 en preparación, Iraki 2019 en off-season):
   - Calorías y macros con explicación, suplementos con evidencia y aviso de salud mental.
   - "Usar estas metas en la app" fija calorías, proteína y grasa (nuevo `fatG` en `targets()`).
6. **Check-in semanal:** peso promedio, cintura, energía, hambre, sueño, minutos de poses y notas, con historial y ritmo en %/semana.
7. **Competir en México:** FMFF/IFBB, NPC Worldwide/Pro League, WNBF México y Naturalmanía, con inscripción, cuotas reportadas y eventos 2026.
8. **Tope de Classic Physique** para tu estatura (Pro League 2023, NPC amateur y fórmula aproximada de la IFBB).
9. **Semana y día del show:** qué no hacer (agua, sodio, diuréticos), carga de carbohidratos con evidencia y qué llevar.

**Otras correcciones:**
- "Tu plan de hoy" y la sesión guiada ya no agregan "reps" a indicaciones de texto.

**Fuentes:** `docs/FUENTES-v22.md`.

**Verificación (`v30.mjs`):**
- **Editor:** 6 rutinas famosas y días "Lun…Dom". La vista previa de CBUM prep muestra su día de cuádriceps 2022. "Ponerla en mi semana" deja Cuádriceps, Pecho, Espalda, Descanso, Hombro, Femoral, Brazo.
- **Kit y sesiones:** el kit tiene 9 herramientas y las sesiones de CBUM son 15. En Planet Fitness, cuádriceps 2024 cambia belt squat por Smith y pendulum por sentadilla goblet, sin repetir máquina; la vista previa y la sesión coinciden.
- **Poses:** Classic (NPC) da 6 elementos; la práctica corre y registra minutos.
- **Nutrición:** con show en febrero de 2027 da 2,180 kcal, 202 g de proteína, 224 g de carbohidratos y 53 g de grasa, y se aplican a las metas.
- **Check-in:** se guarda.
- **México, topes y día del show:** abren.
- **Rotaciones:** prep `5,5,7,R,6,6,7,R` y off-season `7,7,7,R,6,7,6,5,R`.
- **`v29`:** actualizada porque Competir ahora abre el kit.

---

## 23.0 · Tu semana a tu manera y modo coach

**"Tu plan de hoy" desplazable (`coach.js`):**
- Los ejercicios del día se ven como tarjetas con foto en una tira horizontal que se desliza, con todos los ejercicios.
- Antes eran 3 filas más "Ver los N ejercicios", y la tarjeta se hacía muy larga.

**Mi rutina, día por día (`facil.js`, `kit.js`):**
- El selector de cada día tiene grupos:
  - **Crear mi propio entreno…**
  - **Mis entrenos**
  - **Entrena como CBUM**: 15 sesiones.
  - **Entrena como Tom Holland**: circuito de fuerza y día de peso corporal.
  - **Entrena como Arnold**: Golden Six, días del nivel I y de la era dorada.
  - **Descanso**
- Al elegir uno famoso se crea una vez como entreno (con sus ejercicios, series y orden) y se reutiliza si lo pones en otro día.
- Ejemplo verificado: Lun Pierna (propio) · Mar CBUM · Mié Tom Holland · Jue Descanso · Vie Arnold.

**Modo coach:** si entrenas una rutina, un día o una sesión de CBUM, Tom Holland o Arnold:
- **En Hoy:** la misión dice "Entrenas como CBUM" (o Tom Holland o Arnold).
- **En "Tu plan de hoy":** aparece el mismo aviso con su ícono.
- **En la sesión:**
  - Una tarjeta con la nota de esa sesión (por ejemplo, "Belt squat primero para cuidar las rodillas…").
  - Un **tip del día** de su forma de entrenar, que cambia cada día.
- **En cada ejercicio:** su **tip** propio. Si en tu gimnasio se cambió por un sustituto sin tip propio, se usa el del original. Ejemplos:
  - "Él hace las laterales sentado porque de pie le molesta el hombro"
  - "Codos altos y junta los omóplatos (indicación de Justin King)"
- Los tips vienen de la misma investigación de la 22.0. **No se usan fotos ni la imagen de ellos**, porque sus derechos de imagen están protegidos.

**Barra inferior:** las etiquetas van en su propio elemento con recorte ("…"), para que no se junten con letra grande. En tu captura se veía "NutriciónProgreso".

**Verificación (`v31.mjs`):**
- **Plan:** la tira tiene 8 ejercicios y se desliza.
- **Selector de días:** muestra los grupos Mis entrenos (5), CBUM (15), Tom Holland (2) y Arnold (7). La semana armada queda como se eligió, y poner CBUM otra vez el sábado reutiliza el mismo entreno.
- **Martes:** Hoy dice "Entrenas como CBUM". La sesión muestra la tarjeta con la nota y el tip, y el tip del ejercicio.
- **Miércoles:** "Entrenas como Tom Holland".
- **Sesión suelta del kit:** también entra en modo CBUM.
- **Con zoom de 130 %:** ninguna etiqueta de la barra inferior se desborda.

---

## 24.0 · Principios aplicados a tus datos: protección del rendimiento y calentamiento adaptativo

**Idea de producto:** el valor de las entrevistas y rutinas de atletas no está en copiarlas, sino en aplicar sus principios. La app convierte datos en la siguiente decisión correcta para cada persona. Ver `venta/01-RESUMEN-PRODUCTO.md`.

**Protección del rendimiento en definición (`protect.js`):** se activa con el objetivo de definición o en la preparación para un show.

*Qué observa:*
- **Rendimiento:** las 3 últimas sesiones de cada ejercicio contra su mejor marca de las 6 semanas previas (fuerza estimada, o reps si es con peso corporal). Una caída cuenta si es de más del 5 %, y se necesitan al menos 4 sesiones por ejercicio.
- **Recuperación:** últimos 7 días contra los 7 anteriores en sueño, calidad del sueño, energía, dolor muscular y estrés del chequeo diario, más los check-ins semanales.
- **Ritmo de pérdida:** si pasa del 1 % del peso por semana.

*Qué concluye:*

| Situación | Resultado | Qué hace la app |
|---|---|---|
| Menos de 2 ejercicios con datos | Juntando datos | Nada |
| Sin caídas | Estable | No cambiar nada |
| Una caída aislada | A vigilar | Recuerda que no es pérdida muscular y no cambia nada |
| Caídas repetidas en 2 o más ejercicios, con buena recuperación | Bajó en varios ejercicios | Revisar técnica, sueño y comida; observar una semana más |
| Caídas repetidas en 2 o más ejercicios, con peor recuperación o pérdida de más de 1 %/sem | Tendencia a revisar | Propone las acciones de abajo |

*Acciones que propone cuando la tendencia es a revisar:*
- **Semana de menos fatiga:** mismos pesos, una serie menos y 2–3 reps en reserva. Se activa con un toque y se aplica sola a las sesiones.
- **Subir 150 kcal:** solo si bajas más de 1 % por semana.
- **Priorizar el sueño.**
- **Si sigue 2 semanas más, buscar orientación profesional.**

**Nunca baja pesos ni suma cardio automáticamente.** La tarjeta aparece en Plan y en el kit del competidor.

**Calentamiento adaptativo:** aparece en cada ejercicio compuesto con carga, antes de la primera serie, y no cuenta como serie.

| Caso | Calentamiento |
|---|---|
| Pesado (≥ 60 kg o ≤ 6 reps) | 3 series: 40 % × 8, 60 % × 5, 80 % × 2 del objetivo de hoy |
| Moderado | 2 series: 50 % × 8, 75 % × 4 |
| Ese músculo ya trabajó en la sesión | 1 serie de ajuste |
| Primera vez (sin historial) | 1–2 series ligeras |
| Aislamiento o peso corporal | Nada |

- Las series se marcan con un toque.
- No hay rutina larga de bandas: el calentamiento prepara para el trabajo que viene.

**Molestias:** al empezar, la pregunta "¿Alguna molestia hoy?" se responde con un toque ("No, todo bien" o la zona).
- Si eliges una zona, los ejercicios que la cargan muestran "Hoy cuidas tu rodilla: empieza ligero y en un rango sin dolor".
- Un botón cambia esos ejercicios por compuestos que no la cargan. Por ejemplo, con la rodilla: sentadilla → peso muerto rumano.
- Sigue disponible "Me duele" en cada ejercicio.

**Verificación (`v32.mjs`, con historial simulado):**
- **Los cuatro diagnósticos salen bien:** caídas con mal sueño y energía da "tendencia a revisar"; caídas con buena recuperación, "bajó en varios"; una caída, "a vigilar"; sin caídas, "estable".
- **El detalle** muestra los 3 ejercicios con −12 % y el sueño de 7.5 → 5.5 h.
- **La semana de menos fatiga** hace que la sesión siguiente empiece en "reducir".
- **Calentamiento:** con la sentadilla a 70 kg da 27.5 × 8, 42.5 × 5 y 55 × 2; el curl, nada; la prensa después de la sentadilla, 1 serie.
- **Molestia en la rodilla:** marca 2 ejercicios y los cambia por compuestos sin carga en la rodilla.
