# Estimación de reservas de siniestros

> **Estado: borrador — requiere revisión actuarial.** Las cifras provienen del motor de cálculo, pero no han sido aprobadas por un actuario responsable.

## Resumen

- **Reserva estimada total (Chain Ladder): $231,369.44 MXN**
- Bornhuetter-Ferguson: $224,558.99 MXN (-2.9% vs. Chain Ladder)
- Error estándar (Mack): $12,212.61 MXN; intervalo de 95%: $208,354.66 MXN – $256,212.57 MXN
- El origen 2024 concentra el 62% de la reserva; es el de menor desarrollo (12 meses) y el más sensible a los supuestos.

## Datos utilizados

- Fuente: `casos/caso1_seguros_horizonte/pagos_acumulados.csv`
- Tipo: pagos acumulados; unidad de cálculo: miles de MXN
- Huella SHA-256: `9924e5642009aea732811ffcce209b110277f4a3c01b948d46063d5f089355fd`

```
Origen             12m         24m         36m         48m
2021            100.00      150.00      180.00      200.00
2022            120.00      168.00      201.00           —
2023            140.00      196.00           —           —
2024            160.00           —           —           —
```

## Validación de datos

- Sin hallazgos: estructura triangular completa, montos no negativos y acumulados crecientes.

## Factores de desarrollo

| Periodo | Factor | Factor acumulado | Orígenes usados |
|---|---:|---:|---|
| 12 → 24 meses | 1.42778 | 1.90071 | 2021, 2022, 2023 |
| 24 → 36 meses | 1.19811 | 1.33124 | 2021, 2022 |
| 36 → 48 meses | 1.11111 | 1.11111 | 2021 |

## Resultados: Chain Ladder (ponderado por volumen)

| Origen | Pagado | Costo último estimado | Reserva |
|---|---:|---:|---:|
| 2021 | $200,000.00 MXN | $200,000.00 MXN | $0.00 MXN |
| 2022 | $201,000.00 MXN | $223,333.33 MXN | $22,333.33 MXN |
| 2023 | $196,000.00 MXN | $260,922.43 MXN | $64,922.43 MXN |
| 2024 | $160,000.00 MXN | $304,113.67 MXN | $144,113.67 MXN |
| **Total** | | $988,369.44 MXN | **$231,369.44 MXN** |

Supuestos:

- El patrón de desarrollo observado en el pasado se repetirá en los orígenes recientes.
- Los factores son promedios ponderados por volumen de todos los orígenes disponibles.
- El origen más antiguo alcanzó su desarrollo final a 48 meses (factor de cola = 1).

Advertencias del método:

- El factor 36→48 se basa en un solo origen (2021); es poco robusto. Considera un factor de referencia de mercado o un ajuste de curva y documenta la decisión.

## Resultados: Bornhuetter-Ferguson

| Origen | Pagado | Costo último estimado | Reserva |
|---|---:|---:|---:|
| 2021 | $200,000.00 MXN | $200,000.00 MXN | $0.00 MXN |
| 2022 | $201,000.00 MXN | $223,500.00 MXN | $22,500.00 MXN |
| 2023 | $196,000.00 MXN | $259,448.82 MXN | $63,448.82 MXN |
| 2024 | $160,000.00 MXN | $298,610.17 MXN | $138,610.17 MXN |
| **Total** | | $981,558.99 MXN | **$224,558.99 MXN** |

Supuestos:

- El patrón de desarrollo histórico (Chain Ladder) indica qué porcentaje del costo falta por desarrollar.
- El origen más antiguo alcanzó su desarrollo final a 48 meses (factor de cola = 1).
- Siniestralidad esperada a priori: 75.00% para todos los orígenes (plan de negocio sintético).
- Las primas devengadas por origen son correctas y están en la misma unidad que los pagos.

Advertencias del método:

- El factor 36→48 se basa en un solo origen (2021); es poco robusto. Considera un factor de referencia de mercado o un ajuste de curva y documenta la decisión.

## Resultados: Mack (Chain Ladder con error estándar)

| Origen | Pagado | Costo último estimado | Reserva | Error estándar |
|---|---:|---:|---:|---:|
| 2021 | $200,000.00 MXN | $200,000.00 MXN | $0.00 MXN | $0.00 MXN |
| 2022 | $201,000.00 MXN | $223,333.33 MXN | $22,333.33 MXN | $34.69 MXN |
| 2023 | $196,000.00 MXN | $260,922.43 MXN | $64,922.43 MXN | $629.97 MXN |
| 2024 | $160,000.00 MXN | $304,113.67 MXN | $144,113.67 MXN | $12,181.68 MXN |
| **Total** | | $988,369.44 MXN | **$231,369.44 MXN** | $12,212.61 MXN |

Supuestos:

- El patrón de desarrollo observado en el pasado se repetirá en los orígenes recientes.
- Los factores son promedios ponderados por volumen de todos los orígenes disponibles.
- El origen más antiguo alcanzó su desarrollo final a 48 meses (factor de cola = 1).
- Los orígenes son independientes entre sí.
- La varianza del siguiente pago es proporcional al acumulado actual (supuesto de Mack).
- El intervalo de 95% usa una distribución lognormal con la misma media y error estándar.

Advertencias del método:

- El factor 36→48 se basa en un solo origen (2021); es poco robusto. Considera un factor de referencia de mercado o un ajuste de curva y documenta la decisión.
- La varianza de 36→48 se extrapoló con la regla de Mack (sólo hay una observación). Valida la extrapolación; con pocas observaciones la incertidumbre está subestimada.

## Trazabilidad

Cada cifra puede reproducirse con `python -m actuaryos reproducir <registro.json>` y explicarse con `--por-que <clave>`.

| Método | Versión | Parámetros |
|---|---|---|
| Chain Ladder (ponderado por volumen) | 1.0.0 | `{'cola': 1.0, 'excluir': []}` |
| Bornhuetter-Ferguson | 1.0.0 | `{'cola': 1.0, 'siniestralidad_esperada': {'2021': 0.75, '2022': 0.75, '2023': 0.75, '2024': 0.75}, 'fuente_supuesto': 'plan de negocio sintético'}` |
| Mack (Chain Ladder con error estándar) | 1.0.0 | `{'nivel_confianza': 0.95, 'cola': 1.0}` |
