# Analista Financiero Inteligente — diseño

> Objetivo: que una persona sin conocimientos financieros pueda investigar un
> problema de negocio, analizar sus datos, entender qué está pasando y tomar
> una decisión fundamentada.

El primer producto vendible es un **analizador de rentabilidad y flujo de
caja para pymes**. Resuelve un problema completo y frecuente: *"vendo
bastante, pero nunca sé cuánto dinero estoy ganando realmente"*.

---

## 1. El recorrido del usuario

```
"Vamos a averiguarlo. Primero necesito entender cuánto vendes, cuánto te
 cuesta vender y qué gastos tiene tu empresa..."
```

| # | Etapa | Qué hace el sistema | Módulo |
|---|-------|---------------------|--------|
| 1 | Cargar datos | Lee Excel (todas las hojas), CSV o captura manual por mes. Detecta títulos encima de la tabla. | `ingesta.py` |
| 2 | Identificar | Propone qué es cada columna (fecha, importe, producto, fecha de cobro…). **Pregunta solo lo dudoso**. Deduce si una hoja son ventas, costos o gastos por su nombre. | `ingesta.py` |
| 3 | Validar | Fechas inválidas, importes ilegibles, duplicados, monedas mezcladas, filas de "total" (y si cuadran), signos, meses sin datos, partidas inusuales. | `validacion.py` |
| 4 | Calcular | Estado de resultados por mes y por periodo, márgenes, variaciones, punto de equilibrio, rentabilidad por producto, flujo de efectivo, días de cobro y pago. | `calculos.py` |
| 5 | Explicar | Traduce cada cifra: qué es, qué significa en pesos, por qué importa, qué revisar. | `explicar.py` |
| 6 | Investigar | Detecta el hallazgo, arma el **puente de utilidad** y contrasta hipótesis. | `diagnostico.py` |
| 7 | Decidir | Propone acciones, las **simula**, muestra sensibilidad, riesgos y primer paso. Escenarios y proyección de caja. | `recomendaciones.py`, `escenarios.py` |
| 8 | Informe | HTML imprimible para presentar a un director + JSON de trazabilidad. | `informe.py` |

`sesion.py` orquesta todo y siempre sabe el **siguiente paso**. Interfaces:
`cli.py` (terminal, modo guiado o automático), `app.py` (web, Streamlit) y
`asistente.py` (preguntas en lenguaje natural).

---

## 2. Los cinco principios, en el código

### 1. Nunca dejar al usuario frente a una hoja en blanco
`Sesion.siguiente_paso()` devuelve en cada momento qué hacer, por qué y qué
información falta. La interfaz web lo muestra siempre en la barra lateral; la
CLI lo imprime después de cada acción. Las preguntas (`Pregunta`) explican
**por qué** se necesita cada dato.

### 2. Traducir finanzas a lenguaje humano
No: *"el margen bruto disminuyó 15.6 pts"*. Sí: *"de cada $100 vendidos te
quedan $30.3 después de pagar el producto; antes eran $46.0. Con las ventas
actuales esa diferencia equivale a unos −$115,000 de utilidad. Qué revisar:
compáralo por producto"*. Ver `explicar.GLOSARIO`, `explicar_cifra()` y
`explicar_variacion()`.

### 3. Demostrar cada conclusión
Cada número es una `Cifra` en un `Libro`: valor, fórmula, periodo, supuestos,
cifras de las que depende y **filas originales** (`archivo › hoja › fila 38`).
`Libro.rastrear(clave)` devuelve el árbol completo hasta el Excel. El puente
de utilidad se verifica: si no cuadra con el estado de resultados, el
programa falla en vez de mostrar algo incoherente.

### 4. Convertir análisis en decisiones
Las hipótesis respaldadas generan acciones concretas (renegociar un insumo,
ajustar un precio, cambiar la mezcla, revisar un gasto, cobrar antes). Cada
una se simula con el mismo motor, con sus supuestos explícitos, una
sensibilidad (¿y si los clientes reaccionan más?), riesgos, esfuerzo, plazo
y primer paso. Los escenarios comparan alternativas en utilidad **y** en caja,
incluido el faltante máximo de efectivo.

### 5. Enseñar sin obligar a estudiar finanzas
Cada cifra tiene un "¿cómo se calculó?" desplegable, y cada concepto una
tarjeta corta (`leccion()`). El usuario aprende margen, mezcla o días de
cobro **mientras** resuelve su problema, y puede profundizar hasta la fila
del Excel cuando lo necesite.

---

## 3. Arquitectura en seis capas

```
1. Interfaz conversacional   cli.py · app.py · asistente.py
          ↓                  objetivos, preguntas y explicaciones en lenguaje sencillo
2. Motor de diagnóstico      sesion.py · diagnostico.py
          ↓                  decide qué datos faltan y qué análisis corresponde
3. Datos      4. Cálculos    ingesta.py · validacion.py │ calculos.py · escenarios.py
          ↓                  importación, limpieza,     │ fórmulas deterministas
                             validación, trazabilidad   │
5. Interpretación            explicar.py · recomendaciones.py · limites.py
          ↓                  hallazgos, hipótesis, alternativas cuantificadas
6. Entrega ejecutiva         informe.py (HTML) + exportar_json (trazabilidad)
```

**Frontera de la IA.** El modelo de lenguaje (Claude) entiende la pregunta,
elige qué consultar, explica y propone qué investigar. **No calcula.** Solo ve
el resultado de herramientas deterministas (`asistente.Herramientas`) y debe
citar la clave de cada cifra (`[margen_bruto.actual]`) para que sea
rastreable. Sin credenciales funciona en modo local con un enrutador por
palabras clave sobre las mismas herramientas.

---

## 4. Cómo funciona la investigación guiada

Cuando las ventas suben y la utilidad baja, el sistema no se detiene en la
observación. Compara **periodos equivalentes** (primera mitad vs segunda
mitad de los meses disponibles; si son impares, el mes central queda fuera
de la comparación) y descompone el cambio de la utilidad de operación:

| Efecto | Fórmula | Qué responde |
|--------|---------|--------------|
| Volumen | (Q₁ − Q₀) × margen unitario promedio₀ | ¿Vendí más unidades? |
| Mezcla | Σ (q₁ᵢ − Q₁·s₀ᵢ) × m₀ᵢ | ¿Vendo más de lo que deja menos? |
| Precio | Σ q₁ᵢ × (p₁ᵢ − p₀ᵢ) | ¿Cobro distinto? |
| Costo unitario | −Σ q₁ᵢ × (c₁ᵢ − c₀ᵢ) | ¿Me cuesta más cada unidad? |
| Gastos | −(gasto₁ − gasto₀) por categoría | ¿Qué gasto creció? |

La suma de los efectos es **exactamente** el cambio en la utilidad. Si faltan
cantidades, cae a una descomposición por porcentajes (crecimiento, mezcla,
cambio de margen); si falta el producto, a una global. En ambos casos dice qué
dato falta para separar precio de costo.

Cada hipótesis de la investigación (costos, gastos, precios y mezcla, calidad
de datos) queda como **respaldada** (≥25% de lo que restó), **parcial**
(10–25%), **descartada** o **sin datos**. Los efectos son **hechos**; los
motivos ("el proveedor subió su precio", "hubo más merma") son **hipótesis
por confirmar**, con una lista concreta de qué comprobar.

---

## 5. Límites y juicio profesional

Hacer accesible el análisis no significa sustituir el juicio profesional.
`limites.py` detecta preguntas sobre impuestos, crédito, inversiones
importantes, temas laborales o información para terceros, y lo dice
explícitamente; el informe incluye una sección de riesgos y límites. Datos con
advertencias sin confirmar generan resultados marcados como **PROVISIONALES**.
No se calculan impuestos, depreciación ni intereses salvo que vengan en los
datos.

---

## 6. Qué tomamos de cada libro

**Financial Intelligence for Entrepreneurs (Berman & Knight).**
La estructura de cifras y su orden: ventas → utilidad bruta → utilidad de
operación; "la utilidad es una estimación" y "utilidad ≠ efectivo" (por eso
el flujo se calcula por fecha real de cobro y pago, y se alerta cuando la
utilidad no llega a la caja); razones de rentabilidad y eficiencia (margen,
días de cobro y pago); punto de equilibrio; y la idea de que la alfabetización
financiera se construye con los números propios del negocio.

**Storytelling with Data (Knaflic).**
El informe empieza por la idea principal ("Las ventas crecen, pero la
utilidad cae. El mayor golpe: …"); cada gráfica tiene un título que dice qué
concluir; gris para el contexto y un solo color de acento para lo que resta;
gráfica de cascada para el puente; se elimina el desorden (sin rejillas,
leyendas ni 3D); análisis explicativo, no exploratorio.

**SQL for Data Analysis (Tanimura).**
Perfilado y calidad de datos antes de analizar: duplicados, nulos,
conversiones de tipo, fechas; comparaciones periodo contra periodo,
porcentaje del total y mezcla; detección de anomalías (partidas inusuales por
rango intercuartil); análisis de tendencia antes de proyectar.

**Designing Data-Intensive Applications (Kleppmann).**
Los datos crudos son inmutables y la tabla limpia es **derivada** y
reproducible (cambiar una regla = recalcular, no corregir a mano); linaje de
cada dato (`origen` por fila, árbol de dependencias de cada cifra); bitácora
de decisiones del usuario; fallar ruidosamente ante inconsistencias (el
puente que no cuadra lanza error); esquema tolerante a evolución (mapeo de
columnas por sinónimos, nuevas fuentes como "conexiones contables" se
integran produciendo el mismo libro de movimientos).

**The Lean Startup (Ries).**
Construir el producto mínimo que resuelve un problema completo (rentabilidad
y caja de una pyme) en lugar de un "departamento de finanzas" entero; medir
con métricas accionables, no de vanidad; y aplicar el ciclo
construir-medir-aprender al propio usuario: cada recomendación se plantea
como experimento ("prueba el nuevo precio con un grupo de clientes durante 2
semanas") con supuestos explícitos que la realidad confirma o refuta.

---

## 7. Hoja de ruta (aprendizaje validado)

| Fase | Entrega | Hipótesis a validar | Métrica accionable |
|------|---------|---------------------|--------------------|
| MVP (este repo) | Excel/CSV → diagnóstico → informe | Un dueño sin formación llega a una decisión con evidencia | % de usuarios que generan informe; % que ejecutan el "primer paso" |
| 2 | Conectores contables (CFDI/SAT, QuickBooks, Contpaqi, bancos) | La carga manual es la mayor fricción | Tiempo de carga a diagnóstico |
| 3 | Seguimiento: comparar la acción simulada vs lo que pasó | Los supuestos (elasticidad, ahorro) se pueden calibrar | Error entre impacto simulado y real |
| 4 | Presupuesto y alertas mensuales | El valor recurrente está en vigilar, no en un diagnóstico único | Retención mensual |
| 5 | Revisión experta integrada (contador/asesor) | Las decisiones de crédito/impuestos necesitan un humano | % de casos escalados resueltos |

Los conectores contables deben producir el mismo libro de movimientos
canónico (`ingesta.COLUMNAS`) para reutilizar validación, cálculos y
diagnóstico sin cambios.
