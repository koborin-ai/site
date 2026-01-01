#!/bin/bash
# Optimize OG images: resize to 1200px width and convert to WebP
# This script is run during CI/CD builds to automatically optimize images

set -e

OG_DIR="public/og"

if [ ! -d "$OG_DIR" ]; then
  echo "No OG directory found at $OG_DIR, skipping optimization"
  exit 0
fi

echo "Optimizing OG images in $OG_DIR..."

# Process PNG and JPEG files
for img in "$OG_DIR"/*.png "$OG_DIR"/*.jpg "$OG_DIR"/*.jpeg; do
  # Skip if no files match the pattern
  [ -e "$img" ] || continue
  
  # Skip if WebP version already exists and is newer
  filename=$(basename "$img")
  name="${filename%.*}"
  webp_file="$OG_DIR/${name}.webp"
  
  if [ -f "$webp_file" ] && [ "$webp_file" -nt "$img" ]; then
    echo "Skipping $filename (WebP already up to date)"
    continue
  fi
  
  echo "Processing $filename..."
  
  # Get current dimensions
  dimensions=$(file "$img" | grep -oE '[0-9]+ x [0-9]+' | head -1)
  width=$(echo "$dimensions" | cut -d'x' -f1 | tr -d ' ')
  
  # Create temp file for resized image
  temp_file=$(mktemp /tmp/og-XXXXXX.png)
  
  # Resize if width > 1200
  if [ -n "$width" ] && [ "$width" -gt 1200 ]; then
    echo "  Resizing from ${width}px to 1200px..."
    # Use ImageMagick if available, otherwise use cwebp's resize
    if command -v convert &> /dev/null; then
      convert "$img" -resize 1200x "$temp_file"
    else
      # cwebp doesn't resize, so we'll just use the original
      cp "$img" "$temp_file"
    fi
  else
    cp "$img" "$temp_file"
  fi
  
  # Convert to WebP
  cwebp -q 85 "$temp_file" -o "$webp_file" 2>/dev/null
  
  # Clean up
  rm -f "$temp_file"
  
  # Report size reduction
  original_size=$(stat -f%z "$img" 2>/dev/null || stat -c%s "$img" 2>/dev/null)
  webp_size=$(stat -f%z "$webp_file" 2>/dev/null || stat -c%s "$webp_file" 2>/dev/null)
  reduction=$((100 - (webp_size * 100 / original_size)))
  echo "  Created ${name}.webp (${reduction}% smaller)"
done

echo "OG image optimization complete!"

