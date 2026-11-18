#!/bin/bash
# ENTERGALACTIC - instalador para macOS (Photoshop CC 2018 o posterior)
# Uso: bash instalar_mac.sh            (modelos rápidos)
#      bash instalar_mac.sh --quality  (añade el modelo EDSR, ~115 MB)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../com.entergalactic.panel"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.entergalactic.panel"

echo "=== ENTERGALACTIC ==="
echo "Copiando el panel en: $DEST"
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"

echo "Activando extensiones sin firmar (PlayerDebugMode)..."
for v in 8 9 10 11 12; do defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1; done

PY=python3
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "[!] No se encontró python3. Instálalo (https://www.python.org o 'brew install python')."
  exit 1
fi
echo "Instalando dependencias de Python..."
"$PY" -m pip install --user --upgrade -r "$DEST/engine/requirements.txt"
mkdir -p "$HOME/Documents/ENTERGALACTIC/recetas" "$HOME/Documents/ENTERGALACTIC/perfiles"
echo "Descargando modelos de IA..."
"$PY" "$DEST/engine/download_models.py" "$@"

echo
echo "Listo. Reinicia Photoshop y abre: Ventana > Extensiones > ENTERGALACTIC"
echo "Si el panel no encuentra Python, pon en Ajustes la ruta de: $(command -v $PY)"
