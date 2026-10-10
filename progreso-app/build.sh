#!/usr/bin/env bash
# Compila Mi Progreso en un APK firmado sin Android Studio ni el SDK oficial.
# Requisitos: Java 17+ (javac, keytool), curl, python3. Las herramientas
# (aapt2, dx, apksig y las clases de Android) se bajan de Maven Central.
set -euo pipefail

cd "$(dirname "$0")"
ROOT=$(pwd)
TOOLS="$ROOT/.tools"
BUILD="$ROOT/build"
OUT="$ROOT/dist/MiProgreso.apk"
M=https://repo1.maven.org/maven2

KEYSTORE="${KEYSTORE:-$ROOT/keystore/miprogreso.p12}"
KEY_ALIAS="${KEY_ALIAS:-miprogreso}"
KEY_PASS="${KEY_PASS:-miprogreso}"

fetch() {  # fetch <ruta-maven> <archivo>
  [ -f "$TOOLS/$2" ] || { echo "Descargando $2"; curl -sSfL -o "$TOOLS/$2.part" "$M/$1" && mv "$TOOLS/$2.part" "$TOOLS/$2"; }
}

mkdir -p "$TOOLS"
fetch org/apktool/apktool-lib/3.0.3/apktool-lib-3.0.3.jar apktool-lib.jar
fetch com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dx.jar
fetch com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig.jar
fetch org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar android-all.jar

if [ ! -x "$TOOLS/aapt2" ]; then
  python3 - "$TOOLS" <<'PY'
import sys, zipfile, os
tools = sys.argv[1]
with zipfile.ZipFile(os.path.join(tools, "apktool-lib.jar")) as z:
    for src, dst in [("prebuilt/linux/aapt2", "aapt2"), ("prebuilt/android-framework.jar", "android-framework.jar")]:
        with open(os.path.join(tools, dst), "wb") as f:
            f.write(z.read(src))
os.chmod(os.path.join(tools, "aapt2"), 0o755)
PY
fi

rm -rf "$BUILD" && mkdir -p "$BUILD/classes" "$(dirname "$OUT")"

echo "1/5 Recursos (aapt2)"
"$TOOLS/aapt2" compile --dir res -o "$BUILD/res.zip"
"$TOOLS/aapt2" link -o "$BUILD/base.apk" \
  -I "$TOOLS/android-framework.jar" \
  --manifest AndroidManifest.xml \
  -A assets \
  "$BUILD/res.zip"

echo "2/5 Java"
javac --release 8 -nowarn -Xlint:-options -encoding UTF-8 \
  -classpath "$TOOLS/android-all.jar" \
  -d "$BUILD/classes" $(find src -name '*.java')

echo "3/5 Dex"
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=26 --output="$BUILD/classes.dex" "$BUILD/classes"

python3 - "$BUILD" <<'PY'
import sys, zipfile, os
b = sys.argv[1]
with zipfile.ZipFile(os.path.join(b, "base.apk"), "a", zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(b, "classes.dex"), "classes.dex")
PY

echo "4/5 Firma"
if [ ! -f "$KEYSTORE" ]; then
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -noprompt -storetype PKCS12 -keystore "$KEYSTORE" \
    -alias "$KEY_ALIAS" -storepass "$KEY_PASS" -keypass "$KEY_PASS" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mi Progreso"
fi
mkdir -p "$BUILD/signer"
javac -nowarn -cp "$TOOLS/apksig.jar" -d "$BUILD/signer" tools/SignApk.java
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED \
  -cp "$BUILD/signer:$TOOLS/apksig.jar" SignApk "$KEYSTORE" "$KEY_ALIAS" "$KEY_PASS" "$BUILD/base.apk" "$OUT"

echo "5/5 Listo"
"$TOOLS/aapt2" dump badging "$OUT" | head -3
ls -lh "$OUT"
