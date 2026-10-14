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
