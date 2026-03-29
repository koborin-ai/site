#!/usr/bin/env bash
set -euo pipefail

SCALE="${MERMAID_SCALE:-4}"
BG="${MERMAID_BG:-white}"
TARGET="${1:-}"

generate_png() {
  local src="$1"
  local base dir zone topic png_dir png

  base="$(basename "${src%.mmd}")"
  dir="$(dirname "$src")"
  zone="$(basename "$(dirname "$(dirname "$dir")")")"
  topic="$(basename "$dir")"
  png_dir="$(dirname "$(dirname "$dir")")/images/${topic}"
  png="${png_dir}/${base}.png"

  mkdir -p "$png_dir"
  echo "  ${src} -> ${png}"
  mmdc -i "$src" -o "$png" -s "$SCALE" -b "$BG"
}

if [[ -n "$TARGET" && -f "$TARGET" ]]; then
  echo "Generating single diagram (scale=${SCALE}, bg=${BG}):"
  generate_png "$TARGET"
elif [[ -n "$TARGET" && -d "$TARGET" ]]; then
  echo "Generating diagrams in ${TARGET} (scale=${SCALE}, bg=${BG}):"
  while IFS= read -r -d '' f; do
    generate_png "$f"
  done < <(find "$TARGET" -name '*.mmd' -print0)
else
  echo "Generating all diagrams (scale=${SCALE}, bg=${BG}):"

  while IFS= read -r -d '' f; do
    generate_png "$f"
  done < <(find docs -name '*.mmd' -print0 2>/dev/null)
fi

echo "Done."
