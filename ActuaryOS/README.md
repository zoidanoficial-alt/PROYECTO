# ActuaryOS

Un flujo de trabajo actuarial integrado, explicable y auditable: de un
archivo de datos a un borrador de informe revisable, sin que ninguna cifra
salga de texto libre.

> Prototipo con datos **sintéticos**. No sustituye la validación de un
> actuario responsable.

**v0.1** cubre el [Caso 1: reservas de siniestros](casos/caso1_seguros_horizonte/README.md).
La visión completa y la hoja de ruta están en [`docs/producto.md`](docs/producto.md).

**App Android:** [`android/salida/ActuaryOS-0.1.0.apk`](android/salida/ActuaryOS-0.1.0.apk). Ver [`android/README.md`](android/README.md).

## Instalación

```bash
cd ActuaryOS
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev,excel]"
```

## Uso

```bash
C=casos/caso1_seguros_horizonte

# 1. Revisar los datos antes de calcular
python -m actuaryos validar $C/pagos_acumulados.csv --unidad miles --moneda MXN

# 2. ¿Qué métodos permiten estos datos?
python -m actuaryos recomendar $C/pagos_acumulados.csv --unidad miles --moneda MXN

# 3. Calcular, comparar, explicar y documentar
python -m actuaryos reservas $C/pagos_acumulados.csv --unidad miles --moneda MXN \
  --metodo todos --primas $C/primas_devengadas.csv --elr 0.75 \
  --por-que reserva:2024 --modo principiante \
  --informe informe.md --registro registro.json

# 4. Reproducir y conciliar una corrida anterior
python -m actuaryos reproducir registro.json
```

Claves para `--por-que`: `reserva:<año>`, `ultimo:<año>`, `factor:12-24`,
`reserva:total`, `error_estandar:<año>` (Mack), etc.

Opciones de carga: `--formato largo` con `--col-origen/--col-desarrollo/--col-valor`
para mapear columnas, `--hoja` para Excel, `--incremental` y
`--limpiar-formato`. Las dos últimas son transformaciones explícitas y
quedan registradas.

## Estructura

```
actuaryos/
  triangulo.py      Triángulo de desarrollo inmutable con huella SHA-256
  datos.py          Carga CSV/Excel y detector de errores
  reservas/         Chain Ladder, Bornhuetter-Ferguson, Mack
  resultado.py      Cifras con «¿Por qué?» y flujo de aprobación
  selector.py       Qué métodos aplican y qué falta
  comparar.py       Comparación entre métodos y corridas
  auditoria.py      Registro, reproducción y conciliación
  informe.py        Informe Markdown vinculado a resultados
  cli.py            Línea de comandos
casos/              Casos de producto con datos sintéticos y resultados esperados
tests/              Pruebas numéricas, de validación y de reproducibilidad
```

## Pruebas

```bash
python -m pytest
```

Incluyen los resultados esperados del Caso 1 (fracciones exactas) y las
cifras publicadas por Mack (1993) para el triángulo de Taylor & Ashe. Si
está instalado el paquete `chainladder`, también se contrasta contra él.
