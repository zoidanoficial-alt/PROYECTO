# ActuaryOS — visión de producto

**Promesa:** pasar de horas de Excel, código, documentación y validaciones
manuales a un flujo de trabajo integrado, auditable y mucho más rápido.

## Principios no negociables

1. **La IA explica; un motor numérico verificable calcula.** Ninguna cifra
   de un entregable sale de texto generado: todas provienen de un
   `Resultado` del motor.
2. **Nada se corrige en silencio.** Los problemas de datos se reportan con
   explicación y propuesta. Las transformaciones sólo se aplican si el
   usuario las activa, y quedan registradas.
3. **Los supuestos son explícitos.** Si un método necesita un supuesto (cola,
   siniestralidad a priori), lo pide; no lo inventa.
4. **Ningún resultado nace aprobado.** Todo es «borrador» hasta que un
   actuario lo revisa y aprueba con nombre, fecha y comentario.
5. **Todo es reproducible.** Huella de datos + método + versión +
   parámetros = mismo resultado, conciliado cifra por cifra.
6. **Se valida contra referencias conocidas.** Cada método tiene pruebas
   con resultados calculados a mano o publicados.

## Módulos y estado

| Módulo | Qué hace | Estado |
|---|---|---|
| Entrada universal de datos | CSV/Excel, formato ancho o largo, mapeo de columnas | ✅ v0.1 (bases de datos: pendiente) |
| Detector de errores | Huecos, negativos, incrementales, formatos, duplicados, monedas, atípicos | ✅ v0.1 |
| Reservas técnicas | Chain Ladder, Bornhuetter-Ferguson, Mack | ✅ v0.1 |
| Selector de metodología | Requisitos por método y lo que falta | ✅ v0.1 |
| «¿Por qué?» | Datos, fórmula, pasos, supuestos y limitaciones por cifra; modo principiante/experto | ✅ v0.1 |
| Control y auditoría | Registro JSON, huella SHA-256, reproducción y conciliación, aprobación | ✅ v0.1 (permisos por usuario: pendiente) |
| Comparación | Entre métodos y entre corridas (qué cambió y por qué) | ✅ v0.1 |
| Entregables | Informe Markdown | ✅ v0.1 (Excel, PDF y presentaciones: pendiente) |
| Laboratorio actuarial | Frecuencia, severidad, siniestralidad, primas | ⏳ Caso 2 |
| Simulador de riesgos | Monte Carlo, VaR, TVaR, sensibilidad | ⏳ Caso 3 |
| Copiloto con IA | Asistente conversacional sobre el motor | ⏳ después del Caso 4 |
| Interfaz web | Carga, vista previa y botones «¿Por qué?» | ⏳ |

## Casos de producto

Cada caso responde tres preguntas:
**(1)** ¿qué problema real resuelve?, **(2)** ¿qué datos, cálculos,
validaciones y resultados produce?, **(3)** ¿cómo demostramos que funciona
y ahorra trabajo?

### Caso 1 — Reservas de siniestros ✅

Ver [`casos/caso1_seguros_horizonte`](../casos/caso1_seguros_horizonte/README.md).

### Caso 2 — Rentabilidad de una cartera ⏳

1. **Problema:** ¿alcanzan las primas para cubrir siniestros y gastos?
2. **Producirá:** frecuencia, severidad, prima de riesgo, siniestralidad,
   índice combinado y suficiencia de prima por segmento, a partir de pólizas
   (exposición) y siniestros. Validará pólizas sin exposición, siniestros
   fuera de vigencia, fechas imposibles y duplicados.
3. **Demostración:** cartera sintética con frecuencias y severidades
   conocidas; las métricas deben recuperarlas dentro de tolerancias
   estadísticas.

### Caso 3 — Simulación de riesgo ⏳

1. **Problema:** ¿qué puede pasar en escenarios favorables, normales y
   adversos?
2. **Producirá:** modelo de frecuencia-severidad (p. ej. Poisson-Lognormal),
   Monte Carlo con semilla registrada, percentiles, VaR, TVaR y escenarios
   («¿qué pasa si la frecuencia sube 15%?»).
3. **Demostración:** casos con solución analítica (media y varianza del
   agregado compuesto) y reproducibilidad exacta con la misma semilla.

### Caso 4 — Automatización de informes ⏳

1. **Problema:** entregar resultados reproducibles, explicar cambios y
   documentar supuestos sin rehacer todo cada trimestre.
2. **Producirá:** informes técnico y ejecutivo en Excel/PDF vinculados a los
   resultados, con comparación contra el periodo anterior y bitácora de
   cambios.
3. **Demostración:** cambiar un dato o supuesto debe actualizar el informe y
   explicar exactamente qué cifras cambiaron y por qué.

## Próximos pasos sugeridos

1. Exportar el informe del Caso 1 a Excel con tablas vinculadas.
2. Caso 2: datos sintéticos de pólizas y siniestros con parámetros conocidos.
3. Caso 3: simulador Monte Carlo con pruebas analíticas.
4. Interfaz web mínima sobre el mismo motor.
