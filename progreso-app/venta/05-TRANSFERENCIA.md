# Transferencia de la app

Lista para traspasar la app a una desarrolladora compradora. Se completa en el orden indicado.

## 1. Antes de negociar
- [ ] Firmar un acuerdo de confidencialidad (NDA) antes de compartir el código.
- [ ] Compartir primero solo `01-RESUMEN-PRODUCTO.md`, capturas y el APK para evaluación.
- [ ] Definir qué se vende: código, marca, contenido y derechos de explotación (exclusivos o no), y si el titular seguirá involucrado (soporte, transición).

## 2. Entrega del código
- [ ] Entregar `codigo/` completo o transferir el repositorio de GitHub (Settings → Transfer ownership).
- [ ] El repositorio actual también contiene un proyecto ajeno a la app (`cassandra_bmv`). Al transferir, separar `progreso-app` en un repositorio propio.
- [ ] Confirmar que la compradora puede compilar con `./build.sh` y correr `tests/e2e/run-all.sh`.

## 3. Llave de firma
- [ ] **Generar una llave nueva** para la compradora, o que la compradora use la suya. La llave actual (`keystore/miprogreso.p12`, contraseña pública) no debe usarse para publicar.
- [ ] Quitar `keystore/` y la contraseña del README del repositorio que se entregue.
- [ ] Si se publica en Google Play, activar **Play App Signing**: Google guarda la llave de la app y la compradora solo maneja una llave de subida.
- [ ] Nota: quien tenga instalado el APK actual no podrá actualizar a una versión firmada con otra llave. Hoy no hay usuarios publicados, así que el cambio no afecta a nadie.

## 4. Identidad de la app
- [ ] Decidir el nombre del paquete. `com.zoidan.progreso` puede mantenerse o cambiarse a uno de la compradora (`AndroidManifest.xml` y carpeta `src/com/...`).
- [ ] Decidir el nombre comercial y verificar la marca ante el IMPI.
- [ ] Entregar el logo en alta resolución y los archivos de diseño, si existen.

## 5. Contenido y legal
- [ ] Resolver los puntos ⚠ de `03-PROPIEDAD-INTELECTUAL.md` (marcas de terceros, origen de documentos).
- [ ] Contrato de cesión de derechos patrimoniales de autor sobre el código y el contenido propio (Ley Federal del Derecho de Autor, México), con declaración de que el titular es el autor o tiene los derechos.
- [ ] Redactar el aviso de privacidad para tiendas.

## 6. Cierre
- [ ] Sesión técnica de traspaso (1–2 h) recorriendo `02-ARQUITECTURA-TECNICA.md`.
- [ ] Periodo de soporte acordado (p. ej. 30 días para dudas).
- [ ] Huella SHA-256 del APK entregado (`apk/SHA256.txt`) para confirmar que es la versión evaluada.
