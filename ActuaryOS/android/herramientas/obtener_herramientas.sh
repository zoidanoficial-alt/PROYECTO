#!/usr/bin/env bash
# Descarga las herramientas mínimas para compilar la APK sin Android Studio.
# Fuentes: espejo de Maven Central (android.jar de Robolectric, dx, apksig) y npm (aapt2).
set -euo pipefail
DEST="${HERRAMIENTAS:-$HOME/.cache/actuaryos-android}"
MAVEN="${MAVEN:-https://maven-central.storage-download.googleapis.com/maven2}"
mkdir -p "$DEST"
cd "$DEST"

bajar() { [ -s "$2" ] || { echo "→ $2"; curl -fsSL -o "$2.tmp" "$1" && mv "$2.tmp" "$2"; }; }

# android.jar (API 34) con resources.arsc: el paquete android-all de Robolectric.
bajar "$MAVEN/org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar" android.jar
# dx (convierte .class a .dex), versión de AOSP reempaquetada.
bajar "$MAVEN/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar" dx.jar
# apksig: la librería de apksigner (firma v1/v2).
bajar "$MAVEN/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar" apksig.jar
# aapt2 (Linux x64) desde el paquete npm aaptjs3.
if [ ! -x aapt2 ]; then
  echo "→ aapt2"
  tmp=$(mktemp -d)
  curl -fsSL https://registry.npmjs.org/aaptjs3/-/aaptjs3-2.0.2.tgz | tar xz -C "$tmp"
  cp "$tmp/package/bin/x64/linux/aapt2" aapt2 && chmod +x aapt2
  rm -rf "$tmp"
fi
./aapt2 version
echo "Herramientas listas en $DEST"
