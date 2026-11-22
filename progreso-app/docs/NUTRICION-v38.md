# Nutrición inteligente (Mi Progreso 38.0)

## 1. Evaluación de la arquitectura existente

- **App:** WebView con JS global, sin red obligatoria; datos en `localStorage` (`miprogreso.v1`), filtrados por `loadData()`.
- **Antes de 38.0, Nutrición tenía:**
  - `targets()`: libras × factor (McLean) más un reparto por somatotipo.
  - `FOODS` con 24 accesos rápidos.
  - `openMealForm` para escribir macros a mano, McDonald's o una etiqueta.
  - Comidas en `DB.days[fecha].meals`, agua y tarjetas de hábitos (hambre, calidad, digestión, temporada, mitos).
- **Reutilizado:**
  - Perfil (edad, estatura, sexo, fase) y registro de peso: `weightEntries`, `weekAvg`, `currentWeight`.
  - Medidas: cintura en `DB.measures`.
  - Fuerza: `strengthScores`.
  - Entrenos registrados: sesiones, carreras, actividades y HYROX.
  - Recuperación: `DB.days[].rec` y `trAvgRec`.
  - Misiones (`todayMissions`), navegación, `foldify`, gráficas (`drawChart`) y persistencia.
- **Fuente única:**
  - `targets()` sigue siendo la única puerta de los objetivos. Con una estrategia activa devuelve los del motor nuevo (`nTargets()`), y todos los módulos (Hoy, Perfil, misiones, exportar) ven lo mismo.
  - Las comidas siguen en `DB.days[].meals`; solo se agregan los campos `slot`, `fid` y `g`.
- **"Campamento":** no existe en el código.
  - Para cuando se construya, se expone `window.NutriAPI.snapshot()` con todos los datos pedidos.
  - Mientras, la misión diaria de nutrición ya entra en "Misiones de hoy", leyendo de la misma fuente, sin duplicar registros.
- **Datos nuevos:** solo `DB.nutri`. Guarda:
  - estrategia, actividad, experiencia y ritmo;
  - ajuste aceptado (`adj`), fases, historial de ajustes;
  - favoritos, recientes, comidas guardadas y preferencias del plan.
- **Compatibilidad:** sin estrategia activa, todo funciona como antes.

## 2. Métodos de cálculo

| Paso | Método | Fuente |
|---|---|---|
| Metabolismo basal | Mifflin-St Jeor: 10·kg + 6.25·cm − 5·edad + 5 (H) / −161 (M) | Mifflin y col., 1990, Am J Clin Nutr 51:241; Frankenfield y col., 2005, J Am Diet Assoc 105:775 |
| Gasto diario | BMR × factor 1.2 / 1.375 / 1.55 / 1.725 / 1.9. Se sugiere a partir de los minutos reales de entreno | Factores de actividad usados con Mifflin |
| Calibración | Requiere ≥14 días de tendencia, ≥10 días registrados y ≥6 pesajes en 3 semanas. Gasto observado = ingesta media − pendiente del peso × 7700 kcal/kg; pesa hasta 70 % y se descarta si difiere más de 40 % | Hall y col., 2011, Lancet 378:826 (la regla de 7700 es aproximada) |
| Volumen | +0.4 / 0.3 / 0.2 % del peso por semana (principiante / intermedio / avanzado), con el superávit acotado a 5–15 % del gasto. Proteína 1.8 g/kg (rango 1.6–2.2); grasa 25 % | Iraki, Fitschen, Espinar y Helms, 2019, Sports 7:154; Morton y col., 2018, Br J Sports Med 52:376 |
| Definición | −0.5 a 1 % por semana (0.7 % por omisión), con el déficit ≤25 % del gasto. Proteína 2.6 g/kg de masa magra (2.3–3.1) si hay cintura medida; si no, 2.2 g/kg | Helms, Aragon y Fitschen, 2014, JISSN 11:20; Helms y col., 2014, IJSNEM 24:127; Garthe y col., 2011, IJSNEM 21:97 |
| Recomposición | Mantenimiento, o −10 % si la grasa estimada es alta (RFM >22 % H / >32 % M). Proteína 2.2 g/kg | Barakat y col., 2020, Strength Cond J 42:7; Woolcott y Bergman, 2018 (RFM) |
| Mantenimiento | Gasto estimado. Proteína 1.6 g/kg; grasa 30 % | Morton y col., 2018 |
| Rendimiento | Carbohidratos por carga semanal: <150 min → 3–5 g/kg; <420 → 5–7; <900 → 6–10; más → 8–12. Proteína 1.8 g/kg; grasa ≥20 %; nunca se recorta el combustible | Thomas, Erdman y Burke, 2016, Med Sci Sports Exerc 48:543 |
| Seguridad | Nunca por debajo del basal estimado ni de 1500 (H) / 1200 (M); grasa ≥0.6 g/kg | Loucks y col., 2011; Mountjoy y col., 2018 (RED-S) |
| Reparto | ≈0.4 g/kg de proteína por comida en 3–4 comidas | Schoenfeld y Aragon, 2018, JISSN 15:10 |

## 3. Motor de adaptación (`nAdviceFrom`, función pura)

Reglas generales:
- No decide con menos de 14 días de fase ni con menos de 6 pesajes.
- Siempre trabaja con la tendencia (regresión lineal), nunca con un solo día.
- Después de un ajuste aceptado, espera 14 días antes de proponer otro.
- Solo propone: el cambio se aplica únicamente si el usuario toca "Aplicar".

**Volumen**
- Ritmo mayor a 1.6 × el objetivo → propone −150 kcal.
- Ritmo menor a 0.5 × el objetivo:
  - con buena adherencia → propone +125 kcal;
  - sin ella → primero pide registrar bien.
- Sube de peso pero no de fuerza → revisar entrenamiento, sueño y proteína; no cambia calorías.
- Cintura más de 2.5 cm arriba en 4 semanas → revisar.

**Definición**
- Pierde más de 1.2 %/semana → propone +150 kcal.
- Duerme poco o el pulso en reposo subió mientras baja rápido → propone +100 kcal.
- Estancamiento:
  - adherencia insuficiente → revisar registros primero;
  - menos de 21 días → esperar (puede ser agua);
  - real → propone −125 kcal o +2,000 pasos.
- Si ya está en el mínimo seguro, nunca propone comer menos.

**Recomposición**
- Cintura bajando con peso estable = éxito.
- Cintura y peso subiendo → propone −100 kcal.
- Sin cintura medida → pide medirla.

**Mantenimiento**
- El peso se desvía más de 0.35 %/semana → propone ±100 kcal.

**Rendimiento**
- Pierde peso sin buscarlo → propone +200 kcal.
- Recuperación baja → revisar carbohidratos y sueño.

## 4. Fases

- Volumen 12–24 sem → mantenimiento 4–8 → definición 8–16 → mantenimiento posterior.
- Cada fase guarda inicio, peso y cintura de partida. La pantalla muestra objetivo, indicadores, condiciones para avanzar y condiciones para detenerse.
- `nPhaseReview()` solo avisa con señales reales (semanas cumplidas, cintura, peso meta, caída de fuerza). Nunca cambia de fase sola.

## 5. Base de alimentos

- 80 alimentos con valores por 100 g, sacados de USDA FoodData Central (SR Legacy); el queso panela, del SMAE.
- Incluye crudo y cocido por separado (pollo, res, arroz, pasta, avena) y unidades familiares (pieza, taza, rebanada, cucharada, scoop).
- Una prueba verifica que las kcal de cada alimento cuadren con 4/4/9 (±15 %).
- Platillos preparados (tacos, tamales, pan dulce) **no** se incluyeron: su composición varía demasiado. Se registran armando el plato con ingredientes o con macros a mano.

## 6. Atletas de referencia (práctica, no evidencia)

- **Chris Bumstead:** se toman los principios de sus entrevistas públicas (off-season largo, comidas estructuradas, seguimiento). No se usan sus cantidades ni sus suplementos.
- **Paddy Pimblett:** se toman la disciplina y el seguimiento de su campamento. Se excluyen por completo los cortes de peso y la manipulación de agua (Reale, Slater y Burke, 2017, IJSPP 12:142).
- En la biblioteca de conocimiento aparecen etiquetados como "Práctica de atletas".

## 7. Excluido por seguridad

Deshidratación, sauna, restricción de agua, dietas de hambre, déficits extremos, laxantes, diuréticos, manipulación de sodio, cortes de peso de combate, protocolos de tarima automáticos y sustancias dopantes. La preparación para competir en culturismo se remite a un coach con supervisión médica.

## 8. Archivos

- **Nuevos:**
  - `assets/www/foods.js`, `nutri.js`, `nutriui.js`, `nutri.css`
  - `tests/unit/nutri.test.mjs` (29 pruebas)
  - `tests/e2e/v44.mjs`
  - este documento
- **Modificados:**
  - `app.js`: `targets()` delega al motor; `loadData` conserva `nutri`; dos textos corregidos (ventana anabólica y 3.3 g/kg).
  - `index.html`.
  - `tests/e2e/run-all.sh`.
  - `build.gradle.kts`.

## 9. Pendiente

- Lector de código de barras con una base de productos mexicanos (requeriría una base externa o una licencia).
- Platillos típicos con receta estándar documentada.
- Pantalla de "Campamento" (aún no existe): ya puede consumir `NutriAPI.snapshot()`.
- Validar el motor con usuarios reales durante 8–12 semanas.
