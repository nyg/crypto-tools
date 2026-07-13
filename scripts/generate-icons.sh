#!/usr/bin/env bash
# Regenerates all app icons from the master SVGs:
#   assets/icon.svg    -> assets/icon.iconset/ (macOS), assets/icon.ico (Windows),
#                         public/apple-touch-icon.png
#   public/favicon.svg -> public/favicon.ico
# Requires librsvg (rsvg-convert) and ImageMagick (magick):
#   brew install librsvg imagemagick
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# macOS iconset (converted to .icns by electrobun via iconutil)
for s in 16 32 128 256 512; do
   rsvg-convert -w $s -h $s assets/icon.svg -o "assets/icon.iconset/icon_${s}x${s}.png"
done
rsvg-convert -w 32 -h 32 assets/icon.svg -o assets/icon.iconset/icon_16x16@2x.png
rsvg-convert -w 64 -h 64 assets/icon.svg -o assets/icon.iconset/icon_32x32@2x.png
rsvg-convert -w 256 -h 256 assets/icon.svg -o assets/icon.iconset/icon_128x128@2x.png
rsvg-convert -w 512 -h 512 assets/icon.svg -o assets/icon.iconset/icon_256x256@2x.png
rsvg-convert -w 1024 -h 1024 assets/icon.svg -o assets/icon.iconset/icon_512x512@2x.png

# Windows .ico
for s in 16 24 32 48 64 128 256; do
   rsvg-convert -w $s -h $s assets/icon.svg -o "$tmp/win_$s.png"
done
magick "$tmp"/win_{16,24,32,48,64,128,256}.png assets/icon.ico

# Favicon .ico (simplified mark)
for s in 16 32 48; do
   rsvg-convert -w $s -h $s public/favicon.svg -o "$tmp/fav_$s.png"
done
magick "$tmp"/fav_{16,32,48}.png public/favicon.ico

# Apple touch icon: full-bleed variant of the app icon (no squircle margins,
# iOS applies its own corner rounding)
sed 's/x="100" y="100" width="824" height="824" rx="185"/x="0" y="0" width="1024" height="1024" rx="0"/g' \
   assets/icon.svg > "$tmp/fullbleed.svg"
rsvg-convert -w 180 -h 180 "$tmp/fullbleed.svg" -o public/apple-touch-icon.png

echo "Done."
