# Pruebas de extremo a extremo

Las pruebas usan Playwright con Chromium y cargan la app web (`assets/www`) en un servidor local en el puerto 8765. Simulan a una persona tocando la pantalla, con un tamaño de 393 × 851 (Android típico).

```bash
cd tests/e2e
npm init -y && npm i playwright && npx playwright install chromium
./run-all.sh
```

- `v9`–`v28`: un archivo por versión con los flujos que esa versión agregó. Todos se vuelven a correr en cada versión (regresión).
- `v28.mjs`: flujo completo 20.0. Bienvenida → día de descanso → primer entreno guiado → resultado → segundo día con el objetivo calculado → progreso → reporte anónimo → ajustar rutina.
- `v28r.mjs`: lo mismo en Modo Ella.
- `persist.mjs`: los datos sobreviven a cerrar y reabrir la app.
- `ovf.mjs <ancho> <look> <zoom>`: busca elementos que se salgan de la pantalla con letra grande.

Las capturas se guardan en `out/`.

**Aviso esperado:** en v14 aparece `Blocked call to navigator.vibrate…`. Es propio del navegador de pruebas y no es un error de la app.
