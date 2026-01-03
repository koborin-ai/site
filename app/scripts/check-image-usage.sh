#!/bin/bash
# Check for improper image usage in MDX files
# This script detects raw <img> tags with imported image sources,
# which bypass Astro's image optimization.

set -e

CONTENT_DIR="src/content/docs"
ERRORS_FOUND=0

echo "Checking for improper image usage in MDX files..."
echo ""

# Pattern 1: <img src={something.src} - bypasses image optimization
if grep -rn '<img[^>]*src={[^}]*\.src}' "$CONTENT_DIR" --include="*.mdx" 2>/dev/null; then
    echo ""
    echo "ERROR: Found raw <img> tags using imported image .src property."
    echo "       This bypasses Astro's image optimization."
    echo ""
    echo "FIX: Use the <Image> component instead:"
    echo "     import { Image } from 'astro:assets';"
    echo "     import myImage from '../../assets/path/to/image.png';"
    echo "     <Image src={myImage} alt=\"...\" width={600} />"
    echo ""
    ERRORS_FOUND=1
fi

# Pattern 2: Large images in assets directory (>500KB source files)
echo "Checking for oversized source images (>500KB)..."
LARGE_IMAGES=$(find src/assets -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \) -size +500k 2>/dev/null || true)

if [ -n "$LARGE_IMAGES" ]; then
    echo ""
    echo "WARNING: Found large source images (>500KB):"
    echo "$LARGE_IMAGES" | while read -r file; do
        SIZE=$(du -h "$file" | cut -f1)
        echo "  - $file ($SIZE)"
    done
    echo ""
    echo "Consider resizing these images before committing."
    echo "They will be optimized at build time, but smaller sources improve build speed."
    echo ""
    # Warning only, not an error (Astro will optimize them)
fi

if [ $ERRORS_FOUND -eq 1 ]; then
    echo "Image usage check failed. Please fix the errors above."
    exit 1
fi

echo "Image usage check passed."
exit 0

