#!/bin/bash
# Check for improper image usage in MDX files
# This script detects patterns that bypass Astro's image optimization
# or cause layout shifts (CLS).

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

# Pattern 2: Markdown image syntax with relative paths to src/assets
# These should use <Image> component for explicit width control
echo "Checking for Markdown image syntax with asset paths..."
MARKDOWN_ASSETS=$(grep -rn '!\[.*\](\.\..*assets.*\.\(png\|jpg\|jpeg\|webp\))' "$CONTENT_DIR" --include="*.mdx" 2>/dev/null || true)

if [ -n "$MARKDOWN_ASSETS" ]; then
    echo ""
    echo "ERROR: Found Markdown image syntax referencing src/assets/ images:"
    echo "$MARKDOWN_ASSETS"
    echo ""
    echo "       Markdown syntax doesn't allow explicit width control."
    echo "       Use <Image> component for better performance:"
    echo ""
    echo "FIX: Replace ![alt](../../../assets/...) with:"
    echo "     import { Image } from 'astro:assets';"
    echo "     import myImage from '../../../assets/path/to/image.png';"
    echo "     <Image src={myImage} alt=\"...\" width={600} quality={80} />"
    echo ""
    ERRORS_FOUND=1
fi

# Pattern 3: OG images without width/height attributes (causes CLS)
echo "Checking for OG images without size attributes..."
# Find <img> tags with /og/ path but missing width or height
OG_WITHOUT_SIZE=$(grep -rn '<img[^>]*/og/[^>]*>' "$CONTENT_DIR" --include="*.mdx" 2>/dev/null | grep -v 'width=' || true)

if [ -n "$OG_WITHOUT_SIZE" ]; then
    echo ""
    echo "ERROR: Found OG images without width/height attributes:"
    echo "$OG_WITHOUT_SIZE"
    echo ""
    echo "       Missing dimensions cause Cumulative Layout Shift (CLS)."
    echo ""
    echo "FIX: Add width and height attributes:"
    echo '     <img src="/og/my-image.png" alt="og" width="750" height="396" fetchpriority="high" style="width: 100%; height: auto;" />'
    echo ""
    ERRORS_FOUND=1
fi

# Pattern 4: Markdown image syntax for OG images (should use <img> with size)
echo "Checking for Markdown OG images..."
MARKDOWN_OG=$(grep -rn '!\[.*\](/og/.*\.\(png\|jpg\|jpeg\|webp\))' "$CONTENT_DIR" --include="*.mdx" 2>/dev/null || true)

if [ -n "$MARKDOWN_OG" ]; then
    echo ""
    echo "ERROR: Found Markdown image syntax for OG images:"
    echo "$MARKDOWN_OG"
    echo ""
    echo "       Markdown syntax cannot specify dimensions, causing CLS."
    echo ""
    echo "FIX: Use <img> tag with explicit dimensions:"
    echo '     <img src="/og/my-image.png" alt="og" width="750" height="396" fetchpriority="high" style="width: 100%; height: auto;" />'
    echo ""
    ERRORS_FOUND=1
fi

# Pattern 5: Large images in assets directory (>500KB source files)
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
