# Resultados y rankings de HYROX: qué APIs existen (investigación del 19 nov 2026)

## Conclusión

**HYROX no publica una API oficial de resultados ni de rankings en tiempo real.** Los resultados oficiales viven en el portal de cronometraje [results.hyrox.com](https://results.hyrox.com/). Ahí se consulta un atleta o una carrera a la vez y no hay exportación masiva. Todo lo que ofrece "tiempo real" o "rankings globales" lo hace un tercero a partir de ese portal.

## Opciones encontradas

| Opción | Tipo | Acceso | Notas |
|---|---|---|---|
| [results.hyrox.com](https://results.hyrox.com/) | Oficial (portal web) | Público, sin API | Fuente primaria. La app enlaza aquí. |
| [Pyrox](https://vmatei2.github.io/pyrox-client/) | Librería Python + servidor MCP, MIT | Sin cuenta ni clave | Más de 1.2 M de filas publicadas. Las divisiones (Open, Pro, Doubles, Relay) no se mezclan. Es un dataset histórico, no en vivo. |
| [Hyrox Result API](https://hyroxresultapi.com/) | API REST comercial | Bearer token, planes de pago | Temporadas, eventos, resultados por división, búsqueda de atletas, parciales y estadísticas. Los parciales avanzados requieren el plan "Scale". |
| [Apify · HYROX Race Results](https://apify.com/maximedupre/hyrox-race-results/api) y [otro actor](https://apify.com/jungle_synthesizer/hyrox-race-results-scraper/api) | Scrapers de results.hyrox.com | Cuenta y token de Apify, ~USD 0.90 por 1,000 resultados | Ranking, tiempos y las 8 estaciones. |
| [Guía: datos de HYROX con Python](https://jamesiv.es/blog/python/2026/03/19/gathering-hyrox-race-insights-with-python/) | Blog técnico | — | Describe la falta de API y la consulta atleta por atleta. |

**Términos de uso:** no revisamos los términos de results.hyrox.com sobre extracción automatizada. Todas las opciones de terceros heredan los errores de la fuente.

## Qué hace la app (27.0)

- **Mis carreras:**
  - Desde Competiciones → evento → *Registrar mi resultado* se guardan el tiempo, la posición, la categoría, los 16 parciales y las sensaciones.
  - En HYROX la carrera entra a HYROX Lab como simulación medida.
  - Los parciales de cada estación entran como pruebas, divididos entre 1.08 para compararlos con pruebas aisladas.
- **Comparación entre atletas:** contra un atleta de referencia que el usuario captura desde results.hyrox.com. Muestra los 16 parciales lado a lado y dónde se pierde más tiempo.
- **Rankings de México y del mundo:** la app muestra `data/leaderboards.json` solo si existe. Hoy no existe, y en su lugar aparece un aviso honesto con el enlace al portal oficial. No se muestran tablas inventadas.

## Cómo conectar rankings reales

1. Elegir un proveedor y revisar sus términos. La opción más formal es Hyrox Result API, con contrato y token. Pyrox sirve para datos históricos sin costo.
2. Agregar un adaptador en `events/` que escriba `assets/www/data/leaderboards.json` con este formato:
   `{ generatedAt, source, sourceUrl, boards: [{ title, region: 'MX'|'world', division, season, rows: [{ rank, name, country, time /* segundos */ }] }] }`
3. Guardar la clave como secreto del repositorio (`HYROX_RESULT_API_KEY`) y ejecutarlo en el job programado `events.yml`.

No escribimos el adaptador porque no pudimos leer la documentación de endpoints de esos proveedores desde este entorno, y no queremos inventar rutas de API.

**"Tiempo real" de verdad** (durante una carrera) solo lo puede dar el cronometraje oficial, y no está expuesto públicamente.
