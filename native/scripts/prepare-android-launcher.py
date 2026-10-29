"""Package the owner-supplied logo without redrawing, tinting or generative edits.

Only the decorative rounded panel rim is trimmed. Extend its existing edge pixels
into Android's masking/overscan area; preserve every logo/lettering feature.
Run with Python + Pillow. Does not change iOS, splash, or notification icons.
"""
from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
SIZE = 1024
SOURCE = ASSETS / 'branding/android-launcher-source.png'
# The 1254px original has transparent canvas, rounded corners and a baked-in rim.
# This rectangle is inside that decorative panel; all logo/text remains intact.
CROP = (95, 155, 1155, 1125)
SCALE = 0.57
CENTER = (640, 750)


def generate():
    source = Image.open(SOURCE).convert('RGBA')
    assert source.size == (1254, 1254)
    cropped = source.crop(CROP)
    artwork = cropped.convert('RGB')
    # Extend around the original rounded top corners before flattening; do not
    # turn their transparency into black pixels or retain a second launcher mask.
    for y in range(cropped.height):
        opaque = [x for x in range(cropped.width) if cropped.getpixel((x, y))[3] >= 245]
        assert opaque
        first, last = opaque[0], opaque[-1]
        for x in range(first):
            artwork.putpixel((x, y), artwork.getpixel((first, y)))
        for x in range(last + 1, cropped.width):
            artwork.putpixel((x, y), artwork.getpixel((last, y)))
    width, height = round(artwork.width * SCALE), round(artwork.height * SCALE)
    artwork = artwork.resize((width, height), Image.Resampling.LANCZOS)
    left = round(SIZE / 2 + (CROP[0] - CENTER[0]) * SCALE)
    top = round(SIZE / 2 + (CROP[1] - CENTER[1]) * SCALE)
    foreground = Image.new('RGBA', (SIZE, SIZE))
    foreground.paste(artwork, (left, top))
    # Nearest-edge extension adds only existing background colors/landscape edges.
    # No inset rounded square, shadow, border, second logo or synthetic artwork.
    background = Image.new('RGB', (SIZE, SIZE))
    for y in range(SIZE):
        sy = min(max(y - top, 0), height - 1)
        row = artwork.crop((0, sy, width, sy + 1))
        background.paste(row, (left, y))
        background.paste(row.crop((0, 0, 1, 1)).resize((left, 1)), (0, y))
        background.paste(row.crop((width - 1, 0, width, 1)).resize((SIZE - left - width, 1)), (left + width, y))
    foreground.save(ASSETS / 'adaptive-icon-foreground.png', optimize=True)
    background.save(ASSETS / 'adaptive-icon-background.png', optimize=True)
    # Pre-adaptive Android only. Keep the shared/iOS icon.png untouched.
    visible = round(SIZE * 72 / 108)
    inset = (SIZE - visible) // 2
    background.crop((inset, inset, inset + visible, inset + visible)).resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(ASSETS / 'android-icon.png', optimize=True)


if __name__ == '__main__':
    generate()
