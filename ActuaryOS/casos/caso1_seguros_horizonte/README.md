# Caso 1 — Seguros Horizonte: ¿cuánto hay que reservar?

> Datos **sintéticos**. No provienen de ningún cliente. Estos resultados no
> sustituyen la validación de un actuario responsable.

## 1. ¿Qué problema real necesita resolver el actuario?

Seguros Horizonte tiene siniestros ocurridos entre 2021 y 2024 que todavía no
se terminan de pagar. Necesita estimar **cuánto le falta por pagar** para
constituir la reserva, justificar la cifra ante dirección y auditoría y
saber qué tan sensible es a los supuestos.

Hoy esto suele ser: copiar el triángulo a Excel, calcular factores a mano,
revisar celda por celda, rehacer la tabla cuando cambian los datos y
redactar el informe aparte.

## 2. ¿Qué datos, cálculos, validaciones y resultados debe producir la app?

**Entrada** (`pagos_acumulados.csv`, miles de MXN). El vacío significa «aún
no observado», no cero:

| Año | 12 m | 24 m | 36 m | 48 m |
|---|---:|---:|---:|---:|
| 2021 | 100 | 150 | 180 | 200 |
| 2022 | 120 | 168 | 201 | — |
| 2023 | 140 | 196 | — | — |
| 2024 | 160 | — | — | — |

Para Bornhuetter-Ferguson se necesitan además `primas_devengadas.csv` y una
siniestralidad esperada a priori (en el ejemplo, 75%, supuesto sintético).

**Validaciones antes de calcular:** estructura triangular, huecos
intermedios, negativos, acumulados que bajan, datos que parecen
incrementales, números con formato o ambiguos, duplicados, monedas
mezcladas, unidad no declarada y factores atípicos.

**Cálculos:** Chain Ladder ponderado por volumen, Bornhuetter-Ferguson y
Mack (error estándar e intervalo).

**Resultado esperado (Chain Ladder)**, calculado a mano con fracciones
exactas en [`esperado.json`](esperado.json):

| Periodo | Factor |
|---|---:|
| 12 → 24 | 514/360 = 1.42778 |
| 24 → 36 | 381/318 = 1.19811 |
| 36 → 48 | 200/180 = 1.11111 |

| Año | Costo último | Reserva |
|---|---:|---:|
| 2021 | $200,000.00 | $0.00 |
| 2022 | $223,333.33 | $22,333.33 |
| 2023 | $260,922.43 | $64,922.43 |
| 2024 | $304,113.67 | $144,113.67 |
| **Total** | | **$231,369.44 MXN** |

Supuesto clave: 2021 ya alcanzó su desarrollo final a 48 meses (cola = 1).
Se puede cambiar con `--cola`.

## 3. ¿Cómo demostramos que funciona y ahorra trabajo?

- **Exactitud:** `tests/test_caso1_reservas.py` compara cada factor, último
  y reserva contra los valores calculados a mano (tolerancia 1e-5).
- **Referencia externa:** `tests/test_mack.py` reproduce las cifras
  publicadas por Mack (1993) para el triángulo de Taylor & Ashe: reserva
  18,680,856 y error estándar total 2,447,095, año por año.
- **Errores detectados:** cada archivo en [`con_errores/`](con_errores)
  contiene un problema típico y `tests/test_validacion.py` comprueba que se
  detecta y se explica sin modificar los datos en silencio.
- **Reproducibilidad:** el registro de auditoría permite recalcular y
  conciliar cifra por cifra. Si alguien cambia un solo dato, la huella
  SHA-256 lo delata.
- **Ahorro de trabajo:** un solo comando sustituye la cadena
  copiar → calcular → revisar → redactar:

```bash
python -m actuaryos reservas casos/caso1_seguros_horizonte/pagos_acumulados.csv \
  --unidad miles --moneda MXN --metodo todos \
  --primas casos/caso1_seguros_horizonte/primas_devengadas.csv --elr 0.75 \
  --fuente-elr "plan de negocio sintético" \
  --informe informe.md --registro registro.json
```

Ejemplo del informe generado: [`informe_ejemplo.md`](informe_ejemplo.md).

## Archivos con errores intencionales

| Archivo | Problema | Lo que hace la app |
|---|---|---|
| `hueco_intermedio.csv` | Falta 2021 a 24 m pero hay datos a 36 m | Error `PERIODO_INCOMPLETO`; no calcula |
| `numeros_con_formato.csv` | «$201» y «1,96» | `$201` sólo se limpia con `--limpiar-formato` (queda registrado); «1,96» es ambiguo y nunca se adivina |
| `datos_incrementales.csv` | Pagos del periodo cargados como acumulados | Error `POSIBLES_DATOS_INCREMENTALES`; propone `--incremental` |
| `formato_largo_duplicados_monedas.csv` | Registro duplicado y MXN/USD mezclados | Errores `CELDA_DUPLICADA` y `MONEDAS_MEZCLADAS` |
| `factor_atipico.csv` | 2023 se triplica de 12 a 24 m | Advertencia `FACTOR_ATIPICO`; permite calcular, pide revisar o excluir con justificación |
