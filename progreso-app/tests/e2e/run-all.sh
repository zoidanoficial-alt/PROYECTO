#!/usr/bin/env bash
# Regresión completa de Mi Progreso (Playwright + Chromium).
# Uso: cd tests/e2e && npm i playwright && npx playwright install chromium && ./run-all.sh
set -u
cd "$(dirname "$0")"
mkdir -p out
WWW="$(cd ../../assets/www && pwd)"
( cd "$WWW" && python3 -m http.server 8765 >/dev/null 2>&1 ) & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
cd out
fail=0
for t in ${TESTS:-v9 v10 v11 v12 v13 v14 v15 v15b v16 v17 v18 v19 v20 v21 v22 v23 v24 v25 v26 v27 v27b v27c v28 v28r v29 v30 v31 persist}; do
  res=$(timeout 240 node ../$t.mjs 2>&1)
  last=$(echo "$res" | grep -oE '(ERRORS|errors) \[.*\]|[]}] \[.*\]$' | tail -1)
  if echo "$res" | grep -qE '^\S*Error|TypeError|Timeout' || [ -z "$last" ]; then echo "FALLA $t"; echo "$res" | tail -5; fail=1; else echo "ok    $t  $last" | cut -c1-160; fi
done
[ -n "${TESTS:-}" ] && exit $fail
for a in "320 '' 1.4" "393 rosa 1.4" "360 '' 1.3"; do eval node ../ovf.mjs $a | tail -1; done
exit $fail
