# PROYECTO

Este repositorio contiene dos herramientas independientes:

- **[Analista financiero guiado](#analista-financiero-guiado)** (`analista_financiero/`):
  convierte un Excel/CSV de ventas, costos y gastos en un diagnóstico que una
  persona sin formación financiera puede entender, comprobar y presentar.
- **[Casandra BMV](#casandra-bmv)** (`cassandra_bmv/`): alertas de valuación
  estirada en la Bolsa Mexicana de Valores.

## Analista financiero guiado

> *"Tengo una empresa, vendo bastante, pero nunca sé cuánto dinero estoy
> ganando realmente."* — *"Vamos a averiguarlo."*

El sistema recorre ocho etapas, y en cada una dice cuál es el siguiente
paso, qué información falta y por qué:

1. **Carga** Excel (todas las hojas), CSV o cifras capturadas a mano.
2. **Identifica columnas** y pregunta solo cuando no entiende un campo.
3. **Valida**: fechas inválidas, duplicados, monedas mezcladas, filas de
   "total" que no cuadran, signos, meses sin datos, partidas inusuales.
   Nunca presenta datos dudosos como definitivos (marca resultados como
   *provisionales*).
4. **Calcula** con código determinista: ventas, márgenes, utilidad, punto
   de equilibrio, rentabilidad por producto, flujo de efectivo, días de cobro.
5. **Explica** en lenguaje sencillo ("de cada $100 que vendes te quedan…").
6. **Investiga**: si las ventas suben y la utilidad baja, arma un puente que
   explica peso por peso el cambio (volumen, mezcla, precio, costo unitario,
   cada gasto) y contrasta hipótesis, separando hechos de suposiciones.
7. **Propone acciones y las simula** (utilidad, caja, sensibilidad, riesgos),
   y permite simular escenarios de precio, volumen, costos, gastos y plazos.
8. **Genera un informe** para presentar a un director, con la trazabilidad
   de cada cifra hasta la fila del Excel original.

La IA (Claude) solo entiende preguntas y explica: **toda cifra viene del
motor de cálculo**. Diseño completo, principios y fuentes en
[`docs/analista_financiero.md`](docs/analista_financiero.md).

### Uso

```bash
pip install -r requirements.txt

# Demo completa: genera datos de ejemplo (con errores a propósito) y su informe
python -m analista_financiero demo --salida demo_analista

# Modo guiado, conversación paso a paso en la terminal
python -m analista_financiero guiar mis_ventas.xlsx

# Análisis automático con informe y trazabilidad
python -m analista_financiero analizar mis_ventas.xlsx --tc USD=18.5 \
    --informe informe.html --json trazabilidad.json --empresa "Mi empresa"

# Pregunta en lenguaje natural
python -m analista_financiero preguntar mis_ventas.xlsx "¿por qué bajó mi utilidad?"

# Aplicación web (la misma que abre CIFRAS.exe)
streamlit run analista_financiero/app.py
```

### Versión de escritorio: CIFRAS Consultores

`CIFRAS.exe` (Windows) es la aplicación de trabajo de CIFRAS Consultores:
expedientes por cliente guardados en `Documentos/CIFRAS Consultores/Clientes`,
informes con la marca y los datos de contacto del consultor, plantilla de
Excel para clientes y la aplicación web completa. Se compila en GitHub
Actions (`.github/workflows/exe-windows.yml`) con `empaquetado/CIFRAS.spec`;
cada etiqueta `v*` publica el zip como Release.

Para el asistente con IA, define `ANTHROPIC_API_KEY`; sin ella funciona en
modo local con las mismas herramientas de cálculo.

**Formato de datos.** Sirve un archivo con una hoja por tipo (p. ej.
"Ventas", "Costo de ventas", "Gastos") o una sola tabla con columna "Tipo".
Columnas reconocidas: fecha, importe/monto, producto, cantidad, categoría,
concepto, moneda, folio, cliente/proveedor y fecha de cobro/pago. Con
producto y cantidad el diagnóstico separa precio, costo y mezcla; con fecha
de cobro/pago calcula el efectivo real.

> El análisis no sustituye a un contador ni a un asesor: en impuestos,
> crédito, inversiones importantes o información para terceros, el sistema lo
> indica y prepara la información para la revisión profesional.

---

# Casandra BMV

Un script que jala precios de emisoras de la Bolsa Mexicana de Valores,
calcula qué tan "estirados" están (precio vs. tendencia + múltiplos de
valuación) y manda una alerta redactada en tono de **Casandra**: la
profetisa que siempre tuvo razón y a la que nadie le creyó. Entre más
tiempo lleve el mercado ignorando la advertencia, más dramático se pone el
mensaje. Cuando la valuación por fin corrige, hay un mensaje final de
"os lo dije".

> Esto es un ejercicio de análisis cuantitativo con fines educativos/de
> entretenimiento. No es asesoría de inversión.

## Cómo funciona

1. **`fetch.py`** trae el historial de precios y los múltiplos (P/U, P/VL)
   de cada emisora vía Yahoo Finance (`yfinance`), agregando el sufijo
   `.MX` si hace falta.
2. **`multiples.py`** calcula un "puntaje de estiramiento" combinando:
   - qué tan por encima está el precio de su media móvil larga (en
     desviaciones estándar);
   - qué tan por encima está el P/U (trailing, o forward si no hay
     trailing) del rango "normal" configurado;
   - qué tan por encima está el P/VL de su rango "normal".
3. **`state.py`** guarda en `state.json` cuántos ciclos **consecutivos**
   lleva cada emisora estirada (la "racha"), y detecta cuándo una racha se
   resuelve (la valuación vuelve a un rango razonable).
4. **`voice.py`** redacta la alerta. El nivel de drama (1 a 5) depende de
   la longitud de la racha: la primera vez es apenas un presentimiento;
   después de muchos ciclos sin corrección, Casandra ya está gritando en
   mayúsculas.
5. **`analysis.py`** arma un reporte cuantitativo completo por emisora:
   tendencia (SMA20/50/200, cruce dorado/de la muerte, RSI), momentum
   (retornos a 1 día, 1 semana, 1 mes, 6 meses, 1 año), valuación (P/U,
   P/VL, dividendo, capitalización) y riesgo (volatilidad anualizada,
   drawdown vs. máximo de 52 semanas).
6. **`notify.py`** manda el mensaje por consola, a un archivo de log y,
   opcionalmente, a Discord o Telegram vía variables de entorno.
7. **`run.py`** amarra todo y guarda el estado para la siguiente corrida.

## Instalación

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp tickers.example.yaml tickers.yaml
```

Edita `tickers.yaml` con las emisoras que te interesan y, si quieres,
rangos "normales" de P/U o P/VL específicos por emisora (si no los das, se
usan los valores por defecto en `thresholds`).

## Uso

Correr una sola vez:

```bash
python -m cassandra_bmv.run --config tickers.yaml
```

Correr en bucle (por ejemplo cada hora):

```bash
python -m cassandra_bmv.run --config tickers.yaml --loop-interval 3600
```

Modo de prueba, sin mandar notificaciones externas (sólo imprime en
consola):

```bash
python -m cassandra_bmv.run --config tickers.yaml --dry-run
```

### Reporte cuantitativo (tendencia, momentum, valuación, riesgo)

A diferencia de la corrida normal (que solo avisa cuando algo está
"estirado"), `--report` manda un reporte completo de cada emisora sin
importar su estado:

```bash
python -m cassandra_bmv.run --config tickers.yaml --report
```

Incluye: estructura de tendencia (SMA20/50/200, cruce dorado/de la
muerte, RSI14), retornos a 1 día/1 semana/1 mes/6 meses/1 año, múltiplos
de valuación (P/U trailing y forward, P/VL, dividendo, capitalización) y
métricas de riesgo (volatilidad anualizada, drawdown vs. máximo de 52
semanas).

Si quieres recibirlo periódicamente (por ejemplo, una vez al día) sin
mezclarlo con las alertas de estiramiento de cada 30 minutos, crea una
segunda tarea programada/cron que corra el mismo comando pero con
`--report` en vez de sin flags.

### Veredicto tipo "value investing" (COMPRA / MANTENER / EVITAR)

```bash
python -m cassandra_bmv.run --config tickers.yaml --verdict
```

Traduce a un puntaje 0-100 los principios que suele usar el value
investing:

- **Valuación (45%):** qué tan barata está la emisora dentro de su propio
  rango "normal" de P/U y P/VL (entre más cerca del piso del rango, más
  puntos).
- **Calidad del negocio (40%):** ROE, margen neto y nivel de
  deuda/capital, usando los datos fundamentales que expone Yahoo Finance.
- **Generación de efectivo (15%):** rendimiento de flujo de efectivo
  libre sobre capitalización de mercado.
- **Penalización por estiramiento:** si el puntaje de estiramiento
  (`multiples.py`) es alto, se restan puntos — comprar algo que ya corrió
  mucho reduce el margen de seguridad, sin importar qué tan buena sea la
  empresa.

Con eso arma una etiqueta (`COMPRA (valor atractivo)`, `MANTENER /
vigilar`, `EVITAR por ahora`, o `SIN DATOS SUFICIENTES` si a Yahoo
Finance le faltan los fundamentales de esa emisora) y el desglose de cada
componente, para que tú decidas con el contexto completo.

> **Importante:** esto no es Warren Buffett ni asesoría financiera real —
> es una heurística cuantitativa personal inspirada en esos principios.
> Los datos fundamentales de Yahoo Finance para emisoras de la BMV a
> veces vienen incompletos, así que trátalo como punto de partida para
> tu propio análisis, no como la última palabra.

Al final de la corrida (después de mandar el veredicto detallado de cada
emisora) se manda un **mensaje resumen** agrupando todas las emisoras por
etiqueta y ordenadas de mayor a menor puntaje dentro de cada grupo, para
ver de un vistazo qué comprarías y qué no:

```
[RESUMEN VALUE] 8 emisoras analizadas

COMPRA (valor atractivo):
  - Banorte (GFNORTEO.MX) — 91/100
  - Walmex (WALMEX.MX) — 82/100

MANTENER / vigilar:
  - América Móvil (AMXL.MX) — 58/100

EVITAR por ahora:
  - CEMEX (CEMEXCPO.MX) — 22/100
```

### Correrlo por cron

En vez de `--loop-interval`, normalmente es más robusto dejar que `cron`
dispare una corrida a intervalos fijos (el estado persiste entre corridas
en `state.json`, así que la racha se mantiene):

```
# Cada día a las 9:05am hora de México, entre semana
5 9 * * 1-5 cd /ruta/a/PROYECTO && .venv/bin/python -m cassandra_bmv.run --config tickers.yaml >> cron.log 2>&1
```

### Notificaciones externas (opcional)

Configura las variables de entorno correspondientes antes de correr el
script:

- **Discord:** `DISCORD_WEBHOOK_URL` — URL de un webhook de canal.
- **Telegram:** `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` — token del bot
  (vía [@BotFather](https://t.me/BotFather)) y el chat al que quieres que
  te escriba.

Si no configuras nada, las alertas igual se imprimen en consola y se
guardan en `alerts.log`.

#### Paso a paso para Telegram

1. Abre Telegram y busca **@BotFather**. Mándale `/newbot`, dale un nombre
   y un username (debe terminar en `bot`, p. ej. `casandra_bmv_bot`).
   BotFather te regresa un token con forma `123456789:AAExxxxxxxxxxxxxxx`.
   Guárdalo — es secreto, no lo subas al repo ni lo compartas.
2. Mándale cualquier mensaje a tu bot recién creado (así Telegram sabe que
   quieres hablar con él).
3. Consigue tu `chat_id`: en el navegador visita
   `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` (con tu token en
   vez de `<TU_TOKEN>`) y busca el campo `"chat":{"id": ...}` en la
   respuesta. Si prefieres no hacerlo a mano, mándale un mensaje a
   [@userinfobot](https://t.me/userinfobot) y te da tu ID directamente.
4. Exporta las variables de entorno antes de correr el script:

   ```bash
   export TELEGRAM_BOT_TOKEN="123456789:AAExxxxxxxxxxxxxxx"
   export TELEGRAM_CHAT_ID="tu_chat_id"
   ```

5. Manda un mensaje de prueba sin esperar a que el mercado se estire:

   ```bash
   python -m cassandra_bmv.run --config tickers.yaml --test-notify
   ```

   Si todo está bien configurado, te debe llegar un mensaje de Casandra
   confirmando la conexión. Si quieres que la alerta persista entre
   sesiones/reinicios, agrega esas dos variables a tu `~/.bashrc`, a un
   archivo `.env` que cargues antes de correr el script, o al crontab
   (con `TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...` en la misma línea
   del cron job).

## Solución de problemas

Si `fetch.py` falla con errores de conexión hacia `*.finance.yahoo.com`,
revisa que tu red/proxy permita salir a Yahoo Finance: algunos entornos
corporativos o sandboxes bloquean ese dominio por política. El resto del
paquete (cálculo de múltiplos, rachas, redacción de Casandra) no depende de
red y se puede probar sin conexión.

## Pruebas

```bash
pip install pytest
pytest
```

Las pruebas cubren el cálculo de múltiplos, el manejo de rachas en
`state.py` y la escalada de drama en `voice.py`. No requieren red ni
`yfinance` instalado (sólo `fetch.py` depende de la librería, y se importa
de forma perezosa).
