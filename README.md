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
5. **`notify.py`** manda el mensaje por consola, a un archivo de log y,
   opcionalmente, a Discord o Telegram vía variables de entorno.
6. **`run.py`** amarra todo y guarda el estado para la siguiente corrida.

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
