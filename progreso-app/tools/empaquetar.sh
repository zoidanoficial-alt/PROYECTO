#!/usr/bin/env bash
# Arma el paquete para desarrolladoras interesadas en adquirir la app:
# documentos de venta, APK con huella, código fuente (sin llave de firma ni archivos generados),
# pruebas y capturas. Resultado: dist/MiProgreso-<versión>-paquete.zip
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
VER=$(grep -o 'versionName="[^"]*"' AndroidManifest.xml | cut -d'"' -f2)
NAME="MiProgreso-$VER-paquete"
TMP=$(mktemp -d); PKG="$TMP/$NAME"
mkdir -p "$PKG/apk" "$PKG/codigo" "$PKG/capturas"

cp venta/*.md "$PKG/"
cp dist/MiProgreso.apk "$PKG/apk/MiProgreso-$VER.apk"
( cd "$PKG/apk" && sha256sum "MiProgreso-$VER.apk" > SHA256.txt )

# Código: todo lo versionado de la app, menos la llave de firma y los documentos de venta
git ls-files -z . | grep -zv -e '^keystore/' -e '^dist/' -e '^venta/' -e '^build/' \
  | xargs -0 -I{} cp --parents "{}" "$PKG/codigo/"
mkdir -p "$PKG/codigo/keystore"
echo "La llave de firma original no se incluye. Si esta carpeta está vacía, build.sh genera una llave nueva aquí al compilar. Para publicar usa tu propia llave (KEYSTORE, KEY_ALIAS y KEY_PASS) y Play App Signing; ver 05-TRANSFERENCIA.md." > "$PKG/codigo/keystore/LEEME.txt"

cp dist/captura-20.0-*.png dist/captura-$VER-*.png "$PKG/capturas/" 2>/dev/null || true

rm -f "dist/$NAME.zip"
( cd "$TMP" && zip -qr9 "$ROOT/dist/$NAME.zip" "$NAME" )
rm -rf "$TMP"
echo "Listo: dist/$NAME.zip ($(du -h "dist/$NAME.zip" | cut -f1))"
