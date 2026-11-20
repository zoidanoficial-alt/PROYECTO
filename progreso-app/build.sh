#!/usr/bin/env bash
# Compila Mi Progreso con Gradle (desde 29.0, por Health Connect en Android 8–13).
# Requisitos: JDK 17+, Android SDK (ANDROID_HOME o local.properties con sdk.dir).
# Usa ./gradlew (descarga Gradle 8.14.3) o el comando gradle del sistema si existe.
set -euo pipefail
cd "$(dirname "$0")"
OUT="dist/MiProgreso.apk"
KEYSTORE="${KEYSTORE:-keystore/miprogreso.p12}"
KEY_ALIAS="${KEY_ALIAS:-miprogreso}"
KEY_PASS="${KEY_PASS:-miprogreso}"
export KEYSTORE KEY_ALIAS KEY_PASS

if [ ! -f "$KEYSTORE" ]; then
  echo "Generando llave de firma en $KEYSTORE (guárdala: sin ella no se puede actualizar la app instalada)"
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -noprompt -storetype PKCS12 -keystore "$KEYSTORE" -alias "$KEY_ALIAS" \
    -storepass "$KEY_PASS" -keypass "$KEY_PASS" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mi Progreso"
fi
if [ ! -f local.properties ] && [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/android-sdk" ]; then echo "sdk.dir=$HOME/android-sdk" > local.properties; fi

if command -v gradle >/dev/null 2>&1; then GRADLE=gradle; else GRADLE=./gradlew; fi
echo "Compilando con $GRADLE…"
$GRADLE --no-daemon -q assembleRelease
mkdir -p dist
cp build/outputs/apk/release/MiProgreso-release.apk "$OUT"
SDK="${ANDROID_HOME:-$(sed -n 's/^sdk.dir=//p' local.properties 2>/dev/null)}"
BT=$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)
[ -n "$BT" ] && "$BT/apksigner" verify "$OUT" && { "$BT/aapt2" dump badging "$OUT" | head -1 || true; }
ls -lh "$OUT"
echo "Listo"
