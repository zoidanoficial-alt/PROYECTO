# Motor de competiciones (Global Sports Events Intelligence Engine)

La app es offline-first y no tiene backend. Por eso el motor tiene dos piezas que se comunican por un archivo público y versionado:

```
 Fuentes oficiales ─┐                                  ┌─> data/events.json (catálogo publicado, con fuentes)
 Sitemaps / calendarios ─┤ discover.mjs ─> .state ─> build.mjs ─┤
 Búsqueda autorizada (Brave API) ─┘   (fetch responsable)   (dedup · verificación ·  └─> review.md (control de calidad)
                                                              agenda · cambios)
 App (events.js): copia incluida offline + descarga del catálogo publicado (GET, sin datos del usuario)
```

## Piezas

| Archivo | Qué hace |
|---|---|
| `sources.json` | Registro de fuentes: página con enlaces a eventos y JSON-LD, sitemap o ICS. Incluye las plantillas de búsqueda (disciplina × país/ciudad × año) y los dominios oficiales. |
| `lib/fetcher.mjs` | HTTP responsable: respeta robots.txt, un pedido cada 2 s por host, caché con ETag y Last-Modified, reintentos con backoff exponencial (429, 5xx y `Retry-After`) y log JSONL. |
| `lib/extract.mjs` | Extractores sin dependencias: schema.org `Event` y `SportsEvent` en JSON-LD (incluye `@graph`, precios, disponibilidad y estado), iCalendar y sitemaps. |
| `lib/classify.mjs` | Detecta la disciplina por palabras clave en español e inglés y la distancia en running. |
| `lib/normalize.mjs` | Normaliza nombres y ciudades (por ejemplo, CDMX = Ciudad de México = Mexico City) y genera las claves. |
| `lib/dedup.mjs` | Fusiona automáticamente solo con un identificador fuerte (URL oficial canónica o id externo). Si coinciden deporte, ciudad, fecha (±3 días) y nombre, propone un posible duplicado y lo manda a revisión. |
| `lib/verify.mjs` | Calcula el nivel de verificación, la confianza, el estado y la frecuencia de revisión. |
| `lib/disciplines.mjs` | Registro extensible de disciplinas: agregar un deporte es agregar una entrada. |
| `discover.mjs` | Descubre eventos desde las fuentes registradas y vuelve a revisar los eventos cuya revisión ya toca. Con `BRAVE_API_KEY` también busca en la web y rota las consultas. Sin clave, no busca: no se raspan buscadores. |
| `build.mjs` | Junta las fuentes manuales y las descubiertas, deduplica, verifica, agenda la siguiente revisión, registra los cambios contra la versión anterior y arma la cola de control de calidad. Si nada cambió, no republica. |
| `manual/*.json` | Altas manuales con evidencia (URL, método y fecha consultada). |
| `test/engine.test.mjs` | 10 pruebas: alias, duplicados, fusión, verificación, frecuencia de revisión, JSON-LD, ICS, robots.txt y clasificación. |
| `../.github/workflows/events.yml` | Ejecución diaria: pruebas, descubrimiento, construcción y publicación del catálogo. |

## Reglas de verificación (nunca se infiere)

| Estado | Cuándo |
|---|---|
| `officially_confirmed` | La fecha se leyó de la página oficial del organizador (JSON-LD o revisión humana). |
| `verified` | El texto de la página oficial se vio por otra vía (por ejemplo, el extracto de un buscador) y otra fuente o la URL oficial lo respaldan. |
| `partially_verified` | Dos fuentes secundarias coinciden, o una secundaria más la URL oficial conocida. |
| `unconfirmed` | Una sola fuente secundaria. |

- **Fechas:** `dateType` distingue `official`, `estimated` y `historical`. Una edición pasada nunca se presenta como futura. Por ejemplo, el Maratón CDMX aparece solo como 2026 histórico, porque no hay fecha 2027 publicada.
- **Fuentes en desacuerdo:** si las fuentes dan fechas distintas, la confianza baja y el evento va a revisión.
- **Estado del evento:** pasa a finalizado solo por fecha. Cancelado o pospuesto, solo si la fuente lo dice.

## Frecuencia de revisión

| Situación | Revisión |
|---|---|
| Faltan 14 días o menos | Diaria |
| Inscripción abierta | Cada 3 días |
| La inscripción abre en 30 días o menos | Cada 2 días |
| Sin confirmar o parcial | Semanal |
| Confirmado | Cada 14 días |
| Finalizado | Cada 3 días durante 30 días, buscando resultados; luego nunca |

## Estado actual (19 nov 2026)

- **Catálogo inicial:** 10 eventos con evidencia real (5 de HYROX, 2 de running, 1 de triatlón y 2 de fitness competitivo).
- **Ninguno está como `officially_confirmed`:** desde este entorno no se pudo abrir hyrox.com ni otros sitios oficiales. El job programado (con internet) los promoverá al leer su JSON-LD.
- **Fuentes de `sources.json`:** están marcadas `tested: false`; su primer run real dirá cuáles traen datos estructurados.
- **Búsqueda web:** necesita el secreto `BRAVE_API_KEY` en el repositorio.
- **Programación del job:** GitHub ejecuta los workflows programados solo desde la rama por defecto. Hoy es `claude/bmv-cassandra-alerts-app-9fx3wl`, de otro proyecto. Para activarlo: mergear a la rama por defecto (o cambiarla) y apuntar `EV_REMOTE` en `assets/www/events.js` a esa rama.
- **Notificaciones de novedades:** la app las detecta al descargar el catálogo; no hay descarga en segundo plano. Los recordatorios por fecha (objetivo a 90/30/14/7/1 días y cierre de inscripción) sí son notificaciones locales programadas.
