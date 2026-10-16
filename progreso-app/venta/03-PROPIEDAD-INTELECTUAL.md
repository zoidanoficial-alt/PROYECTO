# Propiedad intelectual y licencias

Inventario preparado para la revisión (due diligence). **No es asesoría legal:** antes de firmar, conviene que un abogado de PI revise los puntos marcados ⚠.

## Lo que es propio del titular
- Código de la app: JavaScript, CSS, HTML, Java y el script de compilación.
- Diseño de la experiencia, textos en español, lógica de progresión, "Tu camino", sesión guiada, Modo Ella.
- Logo (versión turquesa/naranja y versión rosa) e identidad visual.
- Lista de ejercicios de pecho con peso libre (`pecho.js`), generada del archivo `ejercicios_pecho_peso_libre.xlsx` que aportó el titular. ⚠ Confirmar que el titular es autor de ese archivo o tiene derecho a usarlo.
- Nombre comercial "Mi Progreso". ⚠ Sin registro de marca ante el IMPI; es un nombre descriptivo y probablemente usado por otras apps. Verificar disponibilidad antes de comercializarlo.

## Componentes de terceros (licencias permisivas)
| Componente | Uso | Licencia | Archivo de licencia |
|---|---|---|---|
| Inter (tipografía) | Toda la interfaz | SIL Open Font License 1.1 | `assets/www/fonts/LICENSE-Inter.txt` |
| Lucide (iconos) | Iconos lineales | ISC | `assets/www/fonts/LICENSE-Lucide.txt` |
| jsPDF | Reporte PDF | MIT | `assets/www/vendor/LICENSE-jspdf.txt` |
| jsPDF-AutoTable | Tablas del PDF | MIT | `assets/www/vendor/LICENSE-jspdf-autotable.txt` |
| Free Exercise DB (fotos e info de ejercicios) | 203 fotos de inicio/final | Unlicense (dominio público) | Indicado en `data.js` |
| Herramientas de compilación (aapt2, dx, apksig, android-all) | Solo compilar, no se distribuyen | Apache 2.0 | Se descargan de Maven Central |

Todas permiten uso comercial. MIT, ISC y OFL piden conservar el aviso de licencia, y los archivos ya están incluidos.

## Contenido de terceros a revisar ⚠
| Contenido | Dónde | Riesgo | Recomendación |
|---|---|---|---|
| **Planet Fitness** (nombre, catálogo de máquinas, preset "Planet Fitness") | `pf.js`, `data.js`, bienvenida | Uso de marca registrada; puede sugerir afiliación | Renombrar a "Gimnasio comercial" o similar, o conseguir autorización |
| **Rutina "Tom Holland para Spider-Man"** | `retos.js`, `data.js` | Nombre de una persona famosa y de un personaje de Marvel/Sony (derecho de imagen y marcas) | Quitar los nombres y dejar la rutina genérica |
| Fórmulas y reglas inspiradas en libros de fitness (p. ej. calorías "peso en lb × 12/15/17", "Gym Bible") | `data.js`, `app.js` | Las fórmulas no tienen derechos de autor, pero los textos o nombres de métodos podrían tenerlos | Revisar que los textos sean redacción propia y no citar marcas de libros |
| **Programas y 15 sesiones "inspirados en Arnold", "en Chris Bumstead (CBUM)" y "en Tom Holland"** (21.0–22.0) | `compite.js` (`COMP_NAMES`) | **CBUM es marca registrada** de CBUM Fitness USA LLC, que incluye servicios de entrenamiento, y él tiene una app que compite con esta. El nombre, la firma y la imagen de Arnold también se licencian como marca | Antes de vender o publicar, renombrar (p. ej. "Clásico de los 70", "Classic Physique moderno") en `COMP_NAMES`; el contenido son rutinas publicadas, que se pueden conservar |
| Retos con nombres de benchmarks conocidos (p. ej. "Cindy") | `retos.js` | Nombres asociados a marcas de entrenamiento | Renombrar si se comercializa |
| Información de informes que mandaron al titular (catálogo PF, PDF del entrenamiento) | `pf.js`, `retos.js` | Origen y derechos del documento no documentados | Confirmar la fuente o reescribir |

## Datos personales
- La app no recopila datos en servidores. Todo vive en el teléfono.
- Maneja datos sensibles **localmente**: peso, medidas, fotos corporales y ciclo menstrual (este último con consentimiento explícito y opcional).
- El reporte de uso anónimo solo sale si la persona lo comparte manualmente, y no incluye nombre, peso, medidas, fotos ni ciclo.
- Para publicar en tiendas hace falta un **aviso de privacidad** conforme a la LFPDPPP (México) y la sección de seguridad de datos de Google Play. No existe todavía.

## Llave de firma ⚠
La llave con la que se firma el APK (`keystore/miprogreso.p12`) está **dentro del repositorio** y su contraseña está escrita en el README. Cualquiera con acceso al repositorio puede firmar versiones que se instalen encima de la app. Ver `05-TRANSFERENCIA.md`.
