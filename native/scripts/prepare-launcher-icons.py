"""Package the complete owner-approved icon composition for Android and iOS.

Pillow required. No redrawing, recoloring, edge stretching or generative edits.
Only transparent outer canvas is trimmed; the rounded panel remains intact.
"""
from pathlib import Path
from math import hypot
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / 'assets'
SIZE = 1024
SOURCE = ASSETS / 'branding/android-launcher-source.png'
# Alpha >=16 bounds exclude almost invisible stray pixels in transparent canvas.
CONTENT = (77, 108, 1177, 1156)


def outline(art):
    alpha = art.getchannel('A')
    points = []
    for y in range(art.height):
        bounds = alpha.crop((0, y, art.width, y + 1)).point(lambda a: 255 if a >= 16 else 0).getbbox()
        if bounds:
            points.extend([(bounds[0] - art.width / 2, y - art.height / 2),
                           (bounds[2] - 1 - art.width / 2, y - art.height / 2)])
    return points


def layer(art, scale):
    resized = art.resize((round(art.width * scale), round(art.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE))
    canvas.paste(resized, ((SIZE - resized.width) // 2, (SIZE - resized.height) // 2))
    return canvas


def generate():
    source = Image.open(SOURCE).convert('RGBA')
    assert source.size == (1254, 1254)
    art = source.crop(CONTENT)
    points = outline(art)
    background = Image.open(ASSETS / 'branding/launcher-background.png').convert('RGBA')
    assert background.size == (SIZE, SIZE)
    # Largest proportional iOS placement retaining the full rounded panel under
    # a conservative rounded-square mask. Padding is background, never black.
    corner = SIZE * .225
    def fits(s):
        return all(hypot(max(abs(x * s) - (SIZE / 2 - corner), 0),
                         max(abs(y * s) - (SIZE / 2 - corner), 0)) <= corner - 4
                   for x, y in points)
    low, high = 0., min(SIZE / art.width, SIZE / art.height)
    for _ in range(24):
        middle = (low + high) / 2
        if fits(middle):
            low = middle
        else:
            high = middle
    icon = Image.alpha_composite(background, layer(art, low)).convert('RGB')
    icon.save(ASSETS / 'icon.png', optimize=True)
    icon.save(ASSETS / 'android-icon.png', optimize=True)
    # Owner approved iPhone-sized artwork on Android, including cropping by
    # circular OEM masks. Put the same composition in the 72dp visible viewport
    # of a 108dp adaptive layer; do not shrink it to the former 66dp safe circle.
    visible = round(SIZE * 72 / 108)
    inset = (SIZE - visible) // 2
    foreground = Image.new('RGBA', (SIZE, SIZE))
    foreground.paste(icon.resize((visible, visible), Image.Resampling.LANCZOS), (inset, inset))
    foreground.save(ASSETS / 'adaptive-icon-foreground.png', optimize=True)
    background.convert('RGB').save(ASSETS / 'adaptive-icon-background.png', optimize=True)
    print(f'Android visible composition matches iOS; {visible}px viewport in {SIZE}px adaptive layer. Circular mask cropping approved.')


if __name__ == '__main__':
    generate()
