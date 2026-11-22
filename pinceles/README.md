# Pinceles FOTONEANDO para Photoshop

63 pinceles cinematográficos para Photoshop CC 2018 o posterior, en seis paquetes: Piel, Luz, Atmósfera, Partículas, Texturas y Medios.

## Instalar

1. Descarga y descomprime **pinceles-fotoneando.zip**.
2. En Photoshop: **Archivo › Secuencias de comandos › Explorar…** y elige **instalar_pinceles.jsx**.
3. El script crea los 63 pinceles en uno o dos minutos. Aparecen al final de **Ventana › Pinceles**, con el prefijo **FT**; por ejemplo, «FT Luz · God Rays».
4. Opcional: para tenerlos en un archivo **.abr** y compartirlos, ve a **Edición › Ajustes preestablecidos › Gestor de ajustes preestablecidos**, selecciona los pinceles FT y pulsa **Guardar conjunto**.

En la carpeta **puntas** están también los PNG originales en alta resolución, hasta 2000 px. Puedes crear un pincel a mano con cualquiera de ellos: ábrelo y ve a **Edición › Definir valor de pincel**.

## Cómo usarlos

Pinta siempre en una **capa nueva**. Así puedes bajar la opacidad, desenfocar o borrar sin tocar la foto.

Casi todos los pinceles son «sellos»: **haz un clic** para estampar, o pinta con un **espaciado alto** (Ventana › Ajustes de pincel › Espaciado 100–150%). Con el espaciado de 25% que trae Photoshop por defecto, los sellos se amontonan. Las excepciones son *Neon Glow*, *Beauty Soft*, *Skin Highlight*, *Skin Shadow* y *Bounce Light*, que funcionan bien como trazo continuo.

| Paquete | Modo de fusión de la capa | Color y consejo |
|---|---|---|
| **Piel** · texturas (Skin Texture Fine, Pore Scatter, Skin Grain, Micro Wrinkle, Imperfection) | Luz suave o Superponer, opacidad 10–30% | Gris oscuro o el tono de la piel un poco más oscuro. Devuelve textura a la piel que quedó plástica tras el retoque |
| **Piel** · Freckle Natural | Multiplicar, 20–50% | Marrón cálido. Varía el tamaño entre clic y clic |
| **Piel** · Beauty Soft, Skin Highlight, Skin Shadow | Luz suave (luces y sombras) o Color (maquillaje) | Blanco cálido para luces, marrón frío para sombras: dodge & burn orgánico |
| **Luz** | Trama o Sobreexponer color (lineal) | Elige el color de la luz: ámbar para Window Light y Sunset Glow, azul para Blue Hour, rosa o turquesa para Neon. Duplica la capa y desenfócala para más brillo |
| **Atmósfera** · niebla, bruma, humo, vapor | Normal o Trama, opacidad 20–60% | Blanco o gris azulado. Haz varios clics a distintos tamaños para que no se vea repetido |
| **Atmósfera** · Heat Distortion Texture | Úsalo como mapa | Píntalo en un documento aparte y úsalo con Filtro › Distorsionar › Desplazar para simular el calor |
| **Partículas** · chispas, brasas, fuego, polvo mágico y dorado | Sobreexponer color (lineal) | Naranja para fuego, dorado para Gold Dust. Añade un estilo de capa «Resplandor exterior» |
| **Partículas** · nieve, lluvia, gotas, salpicadura | Trama | Blanco. Aplica Desenfoque de movimiento a la lluvia según la dirección del viento |
| **Partículas** · Debris | Normal | Negro o el color del entorno |
| **Partículas** · Bokeh | Trama, y luego desenfoque gaussiano leve | Colores de las luces de la escena |
| **Texturas** y **Medios** · grano, ruido, rayones, polvo, papel, óxido | Superponer o Luz suave para el grano; Trama para polvo y rayones claros; Multiplicar para los oscuros | Gris medio para el grano. Estampa un clic grande que cubra la foto |

### Paquete Medios

Combinaciones listas de grano, polvo y rayones:

| Pincel | Inspirado en |
|---|---|
| Kodak 35mm | Película de 35 mm: grano medio y polvo ligero |
| Cine 16mm | Grano grueso de 16 mm, algunos rayones y polvo |
| Vintage Film | Película vieja: grano, rayones, pelos y polvo |
| High ISO | Ruido digital de ISO alto, con un bandeo leve |
| Analog Dirty | Película muy sucia: polvo, rayones y manchas |
| Editorial Grain | Grano fino y parejo, de revista |

## Regenerar o modificar

`python generar_pinceles.py [carpeta] --muestra hoja.jpg` vuelve a crear todas las puntas. Necesita numpy y opencv-python. Cada pincel es una función del script: cambia la densidad, el tamaño o la forma y vuelve a generarlos.
