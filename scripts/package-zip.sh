#!/bin/bash
# Empaqueta NEXUS Trader AI para GitHub, excluyendo artefactos locales
set -e
cd /home/z/my-project

VERSION=$(grep -o '"version": "[^"]*"' package.json | head -1 | cut -d'"' -f4)
OUT="download/nexus-trader-ai-v${VERSION}.zip"
echo "Empaquetando versión ${VERSION} → ${OUT}"
rm -f download/nexus-trader-ai*.zip

zip -r "$OUT" . \
  -x "node_modules/*" \
  -x ".next/*" \
  -x "db/custom.db" \
  -x "db/*.db" \
  -x ".env" \
  -x "*.log" \
  -x "dev.log" \
  -x "server.log" \
  -x ".zscripts/*" \
  -x ".z-ai-config*" \
  -x ".claude/*" \
  -x "download/*" \
  -x "skills/*" \
  -x "tests/*" \
  -x "examples/*" \
  -x "mini-services/*" \
  -x "worklog.md" \
  -x ".git/*" \
  -x "Caddyfile" \
  -x "bun.lock" \
  > /dev/null

echo "=== Contenido del ZIP ==="
unzip -l "$OUT" | tail -3
echo
unzip -l "$OUT" | grep -cE "^\s+[0-9]+" | head -1
echo "archivos incluidos (aprox)"
ls -lh "$OUT" | awk '{print "Tamaño:", $5}'
