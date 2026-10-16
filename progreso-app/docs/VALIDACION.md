# Validación con personas reales · Mi Progreso 20.0

Que las pruebas automáticas pasen y la pantalla no se desborde **no demuestra** que la gente entienda la app, termine sus entrenos o regrese. Este documento sirve para medir eso con personas reales, sin servidores y respetando la privacidad.

## Qué queremos saber

| Pregunta | Señal | Meta inicial |
|---|---|---|
| ¿Se entiende en 5 segundos? | En la prueba de 5 s, la persona dice qué puede hacer, qué hacer ahora y qué consigue | 4 de 5 personas |
| ¿Completa el primer entreno? | `entrenos_terminados ≥ 1` y `horas_hasta_primer_entreno` | ≥ 60 % en 72 h |
| ¿Sabe qué hacer en cada paso? | Respuesta "Sí" a "¿Supiste qué hacer en cada paso?" | ≥ 70 % "Sí" |
| ¿Termina lo que empieza? | `entrenos_terminados / entrenos_empezados` | ≥ 75 % |
| ¿Regresa? | `volvio_semana_1` (abrió la app entre el día 2 y el 7) | ≥ 40 % |
| ¿Progresa? | Etapa del camino a las 4 semanas (`etapa_del_camino`) | Mayoría en etapa 2 o más |

## Prueba en persona (30 min, 5 a 8 personas)

1. **Perfil:** principiantes reales (0–6 meses en el gym), mitad con Modo Ella. Nunca han visto la app.
2. **Prueba de 5 segundos:** muestra la pantalla Hoy 5 s, quítala y pregunta:
   1. ¿Qué puedes hacer en esta app?
   2. ¿Qué deberías hacer ahora?
   3. ¿Qué consigues si lo haces?
3. **Tareas, sin ayuda** (pide que piensen en voz alta):
   - Configura la app con tus datos.
   - Empieza tu entreno de hoy y registra las 2 primeras series del primer ejercicio.
   - Encuentra cuánto peso te toca la próxima vez.
   - Cambia tu rutina a 4 días.
4. **Anota:** dónde duda (más de 5 s sin tocar nada), qué toca por error, qué dice en voz alta y si termina cada tarea.
5. **Cierre:** "Del 1 al 10, ¿la usarías la próxima vez que vayas al gym? ¿Qué te haría usarla más?"

## Prueba en uso real (2 a 4 semanas)

1. Instala el APK a 10–20 personas que entrenen en serio.
2. A los 7 y a los 28 días pídeles: Explorar → **Ayúdanos a mejorar** → **Compartir reporte anónimo** (WhatsApp o correo).
3. Junta los JSON en una hoja de cálculo (una fila por persona) y compara con las metas de la tabla.

**Qué contiene el reporte:**
- Versión, nivel, etapa, meta semanal y minutos por sesión.
- Días de uso, si volvió el día 1 y entre los días 2 y 7.
- Entrenos empezados, terminados y cancelados, y descansos hechos.
- Horas hasta el primer entreno, la etapa del camino y las respuestas a la pregunta de claridad.

**Qué NO contiene:** nombre, peso, medidas, fotos, ciclo ni series.

## Cómo decidir

- **Menos del 60 % termina el primer entreno:** revisar la sesión guiada (¿el peso inicial confunde?, ¿hay demasiado texto?).
- **Muchas respuestas "Más o menos" o "No":** leer las notas; son las frases exactas de la confusión.
- **Muchos entrenos cancelados:** ver si la rutina es muy larga para su tiempo (bajar ejercicios o series).
- **Termina pero no vuelve:** reforzar el siguiente objetivo y los recordatorios, sin añadir más recompensas.

Cada cambio se valida con una nueva ronda, no con más pruebas automáticas.
