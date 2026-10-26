# Panel de administración de Tiempo de Gracia (Google Sheets)

Con este panel, la **cuenta de Google administradora** controla el sitio y la app desde un solo Google Sheet:

| Hoja | Para qué sirve |
|---|---|
| **Eventos** | Agregar, cambiar o quitar eventos. La app avisa a todos cuando aparece uno nuevo. |
| **Cápsulas** | Enlaces de Shorts (sección TG) y Reels (sección Transforma). |
| **Ministerios** | La lista de la página Ministerios. |
| **Oración** | Llegan solas las peticiones de oración y los agradecimientos. |
| **Primer paso** | Llegan solas las personas que vienen por primera vez. |
| **Transforma** | Llegan solos los jóvenes nuevos. |
| **Servir** | Llegan solas las personas que quieren servir en un ministerio. |
| **Configuración** | Correos que reciben un aviso cuando llega algo nuevo. |

Instalarlo toma unos 10 minutos y se hace **una sola vez**.

---

## 1. Crear el Google Sheet
1. Entra a **https://sheets.new** con la **cuenta de Google de la iglesia** (esa será la cuenta administradora).
2. Ponle de nombre **Tiempo de Gracia – Panel**.

## 2. Pegar el programa
1. En el Sheet: menú **Extensiones → Apps Script**.
2. Borra todo lo que aparece en el editor.
3. Copia **todo** el contenido del archivo `admin/Codigo.gs` y pégalo.
   (Está en https://github.com/zoidanoficial-alt/PROYECTO/blob/gh-pages/admin/Codigo.gs, botón **Copy raw file**.)
4. Pulsa el ícono de **guardar** 💾.

## 3. Preparar las hojas
1. Regresa al Sheet y **recarga la página**. Aparece un menú nuevo: **Tiempo de Gracia**.
2. Menú **Tiempo de Gracia → Preparar hojas (solo la primera vez)**.
3. Google pedirá permiso: **Continuar → elige la cuenta → Configuración avanzada → Ir a (nombre del proyecto) → Permitir**.
   (El aviso de "app no verificada" es normal: el programa es tuyo y solo usa tu Sheet y tu correo).
4. Se crean todas las hojas, con el evento de The Chosen y los ministerios de ejemplo.

## 4. Publicarlo en internet
1. En Apps Script: botón azul **Implementar → Nueva implementación**.
2. En el engranaje ⚙️ de "Tipo", elige **Aplicación web**.
3. Llena así:
   - **Ejecutar como:** Yo (la cuenta de la iglesia)
   - **Quién tiene acceso:** Cualquier usuario
4. **Implementar** → copia la **URL de la aplicación web** (termina en `/exec`).
5. **Mándame esa URL** y yo la conecto al sitio y a la app. (O pégala tú en `config.json`, en `"api": ""`.)

> "Cualquier usuario" solo permite **leer** Eventos, Cápsulas y Ministerios y **enviar** formularios.
> Nadie puede leer las peticiones de oración ni los datos de las personas desde internet: eso solo se ve dentro del Sheet.

---

## Uso diario

**Agregar un evento:** en la hoja *Eventos*, escribe una fila nueva:
- **Fecha** (por ejemplo 2026-11-20), **Hora** opcional (19:00), **Título**, **Descripción**, **Lugar**.
- **Video** opcional: pega el enlace de YouTube.
- **¿Publicado?** = Sí. El **ID se llena solo** al escribir el título.
- Para ocultar un evento sin borrarlo: **¿Publicado?** = No.
- El sitio se actualiza en un minuto; la app avisa del evento nuevo en las siguientes horas.

**Peticiones y personas nuevas:** llegan como filas nuevas con fecha y **Estado = Nuevo**.
Cambia el estado a **En proceso** o **Atendido** y usa **Notas del equipo** para dar seguimiento.

**Recibir un correo con cada formulario:** en *Configuración*, en `correo_avisos`, escribe uno o varios correos separados por coma.

**Descargar los datos:** **Archivo → Descargar → Microsoft Excel o CSV**, o filtra por fecha o estado.

**Dar acceso a pastores o líderes:** botón **Compartir** del Sheet → agrega su correo como **Editor**.
Ojo: quien tenga el archivo ve **todas** las hojas, incluidas las peticiones de oración. Compártelo solo con personas de confianza.

## Reglas para no romper nada
- **No cambies el orden de las columnas** ni borres la fila de encabezados.
- **No cambies los nombres de las hojas.**
- Si algún día cambias el código en Apps Script: **Implementar → Administrar implementaciones → ✏️ → Versión: nueva → Implementar** (así la URL no cambia).

## Privacidad
Las hojas guardan datos personales (nombres, celulares, peticiones de oración y datos de menores en Transforma).
Los formularios piden aceptar que la iglesia guarde los datos solo para dar seguimiento. Antes de abrirlo al público,
conviene publicar un **aviso de privacidad** de la iglesia (Ley Federal de Protección de Datos Personales).
