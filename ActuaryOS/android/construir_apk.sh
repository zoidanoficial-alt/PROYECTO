#!/usr/bin/env bash
# Compila, empaqueta y firma la APK de ActuaryOS.
#   ./construir_apk.sh            → salida/ActuaryOS-<versión>.apk
# Requiere Java 17+ y las herramientas de herramientas/obtener_herramientas.sh.
set -euo pipefail
# Los pasos de Java no usan la red; se evita el ruido de JAVA_TOOL_OPTIONS en la salida.
unset JAVA_TOOL_OPTIONS
cd "$(dirname "$0")"
H="${HERRAMIENTAS:-$HOME/.cache/actuaryos-android}"
[ -x "$H/aapt2" ] || HERRAMIENTAS="$H" bash herramientas/obtener_herramientas.sh
VERSION=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' app/AndroidManifest.xml)
CLAVE="${CLAVE_ALMACEN:-actuaryos-prueba}"
ALMACEN="${ALMACEN:-clave-prueba.p12}"
OBRA=compilacion
rm -rf "$OBRA" && mkdir -p "$OBRA"/{res,gen,clases,dex} salida

echo "1/6 Recursos"
"$H/aapt2" compile --dir app/res -o "$OBRA/res/recursos.zip"
"$H/aapt2" link -o "$OBRA/base.apk" -I "$H/android.jar" \
  --manifest app/AndroidManifest.xml -A app/assets \
  --java "$OBRA/gen" --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$(sed -n 's/.*android:versionCode="\([^"]*\)".*/\1/p' app/AndroidManifest.xml)" \
  --version-name "$VERSION" -0 www \
  "$OBRA/res/recursos.zip"

echo "2/6 Java"
javac -nowarn --release 8 -encoding UTF-8 -cp "$H/android.jar" -d "$OBRA/clases" \
  $(find app/src "$OBRA/gen" -name '*.java') 2>&1 | grep -v "^warning: \[options\]" || true
ls "$OBRA/clases/com/actuaryos/app/MainActivity.class" >/dev/null

echo "3/6 Dex"
java -cp "$H/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 \
  --output="$OBRA/dex/classes.dex" "$OBRA/clases"

echo "4/6 Empaquetado"
cp "$OBRA/base.apk" "$OBRA/sin-firma.apk"
(cd "$OBRA/dex" && zip -q -X ../sin-firma.apk classes.dex)

echo "5/6 Firma"
if [ ! -f "$ALMACEN" ]; then
  keytool -genkeypair -keystore "$ALMACEN" -storetype PKCS12 -storepass "$CLAVE" -keypass "$CLAVE" \
    -alias actuaryos -keyalg RSA -keysize 3072 -validity 10000 \
    -dname "CN=ActuaryOS prueba, O=ActuaryOS, C=MX" || true
fi
javac -nowarn -cp "$H/apksig.jar" -d "$OBRA" herramientas/Firmar.java
APK="salida/ActuaryOS-$VERSION.apk"
# apksig 2.3.0 consulta clases internas del JDK al inicializarse.
java --add-exports java.base/sun.security.x509=ALL-UNNAMED -cp "$H/apksig.jar:$OBRA" Firmar "$OBRA/sin-firma.apk" "$APK" "$ALMACEN" actuaryos "$CLAVE"

echo "6/6 Verificación"
"$H/aapt2" dump badging "$APK" | grep -E "^(package|sdkVersion|targetSdkVersion|application-label:|launchable-activity)"
ls -l "$APK"
sha256sum "$APK"
