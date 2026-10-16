# Mi Progreso · Paquete para desarrolladoras interesadas

**Versión:** 22.0 (versionCode 27) · **Paquete Android:** `com.zoidan.progreso` · **Plataforma:** Android 8.0+ (API 26–34)

Este paquete reúne todo lo necesario para evaluar, compilar, probar y continuar la app sin depender de su creador.

## Contenido

| Carpeta / archivo | Qué es |
|---|---|
| `01-RESUMEN-PRODUCTO.md` | Qué es la app, su núcleo, público, diferenciadores y estado de mercado |
| `02-ARQUITECTURA-TECNICA.md` | Cómo está construida: módulos, modelo de datos, puente nativo, compilación |
| `03-PROPIEDAD-INTELECTUAL.md` | Inventario de código, contenido y licencias de terceros, con riesgos a revisar |
| `04-ESTADO-RIESGOS-Y-HOJA-DE-RUTA.md` | Qué está verificado, qué no, deuda técnica y siguientes pasos sugeridos |
| `05-TRANSFERENCIA.md` | Lista de pasos para traspasar la app (código, firma, marca, tienda) |
| `apk/` | APK firmado listo para instalar y su huella SHA-256 |
| `codigo/` | Código fuente completo de la app (web + Android) con su script de compilación |
| `codigo/tests/e2e/` | 28 pruebas automáticas de extremo a extremo (Playwright) |
| `codigo/docs/` | Historial técnico versión por versión y protocolo de validación con usuarios |
| `capturas/` | Capturas de la versión actual (tema oscuro y Modo Ella) |

## Evaluarla en 10 minutos

1. Instala `apk/MiProgreso-20.0.apk` en un Android (permitir orígenes desconocidos).
2. Completa la bienvenida eligiendo **principiante**.
3. Abre la pantalla Hoy, empieza el entreno y registra un par de series.
4. Termina y revisa la pantalla de resultado: qué hiciste, qué mejoraste y tu siguiente objetivo.

## Compilar desde el código

```bash
cd codigo
./build.sh          # Java 17+, curl y python3. No requiere Android Studio.
```

Genera `dist/MiProgreso.apk`. Ver `02-ARQUITECTURA-TECNICA.md` para firma y llaves.

## Contacto del titular

Titular y creador: *(completar: nombre legal, correo, teléfono)*.
