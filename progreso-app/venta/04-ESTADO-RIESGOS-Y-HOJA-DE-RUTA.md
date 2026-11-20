# Estado, riesgos y hoja de ruta

## Verificado
- Compila y firma con `build.sh` (versión 20.0, versionCode 25, minSdk 26, targetSdk 34).
- 28 pruebas de extremo a extremo pasan sin errores: los flujos de las versiones 9 a 22 (incluidas la adaptación a Planet Fitness y el kit del competidor), Modo Ella, la persistencia de datos y que nada se salga de la pantalla con letra grande en 320, 360 y 393 px.
- Flujo principal 20.0 probado con reloj simulado: bienvenida → descanso → primer entreno guiado → resultado → objetivo calculado el siguiente día → progreso → ajuste de rutina.

## No verificado
- **Funcionamiento en teléfonos reales:** solo se probó en Chromium de escritorio con tamaño de celular. Faltan pruebas en dispositivos (especialmente Xiaomi y Samsung) de notificaciones, alarmas, cámara, GPS y guardado de archivos.
- **Comprensión y retención con usuarios:** el rediseño 17.0.1–20.0 no se ha probado con personas. Ver `codigo/docs/VALIDACION.md`.
- **Accesibilidad con lector de pantalla (TalkBack).**
- **Rendimiento con años de datos.**

## Riesgos técnicos y deuda
| Tema | Detalle | Esfuerzo estimado |
|---|---|---|
| Almacenamiento | `localStorage` (~5 MB) con un solo JSON; se compacta, pero con muchos datos se queda corto | Medio: migrar a IndexedDB o SQLite |
| Sin respaldo en la nube | Si se pierde el teléfono se pierden los datos, salvo que se haya exportado una copia | Medio/alto: sincronización opcional (requiere backend y cuentas) |
| Código global sin módulos | ~10 800 líneas en scripts que comparten ámbito global; `app.js` tiene 3 150 líneas | Medio: modularizar (ES modules) y añadir pruebas unitarias |
| Compilación artesanal | `build.sh` genera APK, no AAB; Google Play exige AAB | Bajo/medio: proyecto Gradle equivalente |
| Permiso `USE_EXACT_ALARM` | Google Play lo restringe a apps de alarma y calendario; puede rechazar la app | Bajo: cambiar a `setWindow` sin alarma exacta o justificarlo |
| Llave de firma expuesta | Ver PI y transferencia | Bajo: llave nueva + Play App Signing |
| Solo Android | Sin versión iOS | Alto: Capacitor o equivalente (la base web facilita el puerto) |
| Contenido de marcas de terceros | Planet Fitness, Tom Holland, etc. | Bajo: renombrar |

## Hoja de ruta sugerida
1. **Validación (2–4 semanas):** prueba con 5–8 personas y 2–4 semanas de uso real con 10–20 personas, siguiendo `VALIDACION.md`.
2. **Listo para tienda (2–3 semanas):** limpiar contenido de marcas, aviso de privacidad, AAB con Gradle, llave nueva, revisión de permisos, pruebas en dispositivos y ficha de Play.
3. **Robustez:** migrar a IndexedDB, respaldo opcional en la nube y analítica opcional con consentimiento.
4. **Negocio:** freemium (avanzado, análisis y exportación de pago), licencia o marca blanca para gimnasios, contenido de entrenadores.
5. **iOS** con la misma base web.
