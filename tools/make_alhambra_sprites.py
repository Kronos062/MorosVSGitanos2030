"""Generate Alhambra's 32 px atlas and register it without touching other worlds."""

import json
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps


SPRITES = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites"
WORLD = "worlds/alhambra"
SIZE = 32
STONE = "#92675f"
JOINT = "#79534f"
SEAM = "#a87969"
WATER = "#29464d"
SHADOW = "#54403e"
CAP = "#b1846e"
TILE = "#5c827e"
IVORY = "#c9ab85"


def save(name, image):
    relative = f"{WORLD}/{name}.png"
    path = SPRITES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    return relative


def patio(seed, ornament=False):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), JOINT)
    draw = ImageDraw.Draw(image)
    shades = (STONE, "#976d62", "#8c625a", "#996d60", "#91645b")
    for row in range(4):
        for col in range(-1, 3):
            x, y = col * 16 - row % 2 * 8, row * 8
            draw.rectangle((x, y, x + 14, y + 6), fill=rng.choice(shades))
            draw.line((x + 1, y, x + 13, y), fill=SEAM if ornament else "#a17465")
            draw.point((x + 3, y + 4), fill="#a7796a")
    if ornament:
        draw.rectangle((10, 10, 21, 21), fill=SHADOW)
        draw.rectangle((11, 11, 20, 20), fill="#6a827b")
        draw.polygon(((15, 12), (17, 12), (17, 14), (19, 14), (19, 17),
                      (17, 17), (17, 19), (15, 19), (15, 17), (13, 17), (13, 14),
                      (15, 14)), fill=IVORY)
        draw.rectangle((15, 15, 17, 17), fill="#785658")
    return image


def water(seed):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), WATER)
    draw = ImageDraw.Draw(image)
    for _ in range(11):
        x, y = rng.randrange(0, 26), rng.randrange(1, 31)
        draw.line((x, y, x + rng.randrange(2, 7), y),
                  fill=rng.choice(("#314f55", "#36545a", "#2d4a50")))
    return image


def parapet(corner=False):
    image = patio(0)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 5), fill=SHADOW)
    draw.rectangle((0, 1, 31, 3), fill=CAP)
    draw.line((0, 1, 31, 1), fill="#c8a080")
    draw.rectangle((0, 6, 31, 11), fill="#734c49")
    draw.line((0, 12, 31, 12), fill="#bc9171")
    draw.line((0, 13, 31, 13), fill=SHADOW)
    for x in range(0, 32, 8):
        draw.rectangle((x, 6, x + 6, 10), fill="#9b7061")
        draw.point((x + 3, 7), fill=IVORY)
        draw.line((x + 2, 11, x + 4, 11), fill=TILE)
    if corner:
        draw.rectangle((0, 0, 6, 31), fill=SHADOW)
        draw.rectangle((1, 1, 3, 31), fill=CAP)
        for y in range(8, 32, 8):
            draw.rectangle((4, y, 8, y + 5), fill="#9b7061")
            draw.point((6, y + 2), fill=IVORY)
        draw.rectangle((0, 0, 9, 8), fill=CAP)
        draw.rectangle((1, 1, 8, 6), outline=IVORY)
        draw.rectangle((3, 2, 6, 5), fill="#93695e")
    return image


def passage():
    image = patio(8)
    draw = ImageDraw.Draw(image)
    for y in (3, 27):
        draw.rectangle((0, y, 31, y + 2), fill=SHADOW)
        for x in range(1, 32, 4):
            draw.line((x, y + 1, x + 1, y + 1), fill=TILE if x % 8 == 1 else IVORY)
    return image


def railing(size, vertical=False, fascia=False):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((3, 0, 10, 31), fill=SHADOW)
        draw.rectangle((3, 0, 7, 31), fill=CAP)
        draw.line((3, 0, 3, 31), fill=IVORY)
        for y in range(0, 32, 8):
            draw.line((4, y, 8, y), fill="#885a50")
    else:
        y = 0 if fascia else size[1] - 7
        draw.rectangle((0, y, 31, y + 6), fill=SHADOW)
        draw.rectangle((0, y, 31, y + 3), fill=CAP)
        draw.line((0, y, 31, y), fill=IVORY)
        for x in range(0, 32, 8):
            draw.line((x, y + 1, x, y + 4), fill="#885a50")
    return image


def gate(size, vertical=False):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((5, 0, 11, 31), fill="#3c3541")
        draw.line((6, 0, 6, 31), fill="#a47c56")
        draw.line((10, 0, 10, 31), fill="#6a5550")
        for y in range(2, 32, 6):
            draw.line((5, y, 11, y), fill="#8c6752")
    else:
        for x in range(1, 32, 6):
            draw.rectangle((x, 4, x + 2, 23), fill="#3c3541")
            draw.line((x, 4, x, 21), fill="#b68e60")
            draw.point((x + 1, 3), fill=IVORY)
        draw.rectangle((0, 7, 31, 9), fill="#6a5550")
        draw.rectangle((0, 19, 31, 22), fill="#795a49")
        draw.line((0, 19, 31, 19), fill="#a47c56")
    return image


def buttress():
    image = Image.new("RGBA", (18, 28))
    draw = ImageDraw.Draw(image)
    draw.polygon(((0, 7), (15, 7), (17, 11), (17, 24), (12, 27), (1, 24)), fill=SHADOW)
    draw.rectangle((2, 5, 14, 20), fill=STONE)
    draw.polygon(((1, 5), (4, 1), (13, 1), (16, 5), (13, 9), (4, 9)), fill=CAP)
    draw.line((4, 2, 13, 2), fill=IVORY)
    draw.line((2, 13, 14, 13), fill=JOINT)
    draw.line((3, 19, 12, 19), fill=SEAM)
    return image


def arch():
    image = Image.new("RGBA", (53, 65))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 53, 52, 64), fill=(41, 30, 37, 115))
    silhouette = ((4, 58), (4, 8), (8, 4), (12, 4), (12, 1), (41, 1), (41, 4),
                  (45, 4), (49, 8), (49, 58), (37, 58), (37, 33), (41, 27),
                  (40, 21), (35, 15), (27, 11), (18, 15), (13, 21), (12, 27),
                  (16, 33), (16, 58))
    draw.polygon(silhouette, fill="#976b5c")
    draw.line(((7, 54), (7, 9), (13, 6), (13, 3), (39, 3), (39, 6), (45, 9), (45, 54)),
              fill=IVORY, width=2)
    draw.line(((16, 47), (16, 32), (12, 27), (13, 21), (18, 15),
               (27, 11), (35, 15), (40, 21), (41, 27), (37, 33), (37, 47)),
              fill="#d9b99a", width=2)
    draw.rectangle((9, 7, 43, 10), fill="#b48a6f")
    for x in range(11, 42, 3):
        draw.point((x, 8), fill="#e1ba92")
    for x in (6, 39):
        draw.rectangle((x, 38, x + 7, 54), fill="#557777")
        for y in range(40, 55, 4):
            draw.polygon(((x + 3, y - 1), (x + 5, y + 1), (x + 3, y + 3), (x + 1, y + 1)),
                         fill=IVORY)
        draw.rectangle((x - 1, 55, x + 8, 58), fill=CAP)
        draw.line((x - 1, 55, x + 8, 55), fill=IVORY)
    draw.line((48, 13, 48, 57), fill="#664947")
    draw.line((15, 35, 15, 56), fill="#765052")
    return image


def planter(seed):
    rng = Random(seed)
    image = Image.new("RGBA", (32, 30))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 20, 31, 29), fill=(38, 34, 35, 120))
    draw.polygon(((2, 13), (27, 13), (30, 19), (26, 25), (6, 25), (1, 20)), fill=SHADOW)
    draw.rectangle((2, 17, 28, 22), fill=CAP)
    draw.rectangle((4, 18, 26, 20), fill=TILE)
    for x in range(5, 25, 4):
        draw.point((x, 19), fill=IVORY)
    draw.polygon(((4, 17), (6, 6), (14, 2), (24, 5), (28, 15), (25, 18), (8, 19)), fill="#3e5041")
    for _ in range(25):
        x, y = rng.randrange(7, 25), rng.randrange(7, 17)
        draw.line((x, y, x + 1, y), fill=rng.choice(("#546751", "#687a60", "#74856a")))
    return image


def basin():
    image = Image.new("RGBA", (24, 22))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 8, 23, 21), fill=(36, 31, 39, 110))
    draw.polygon(((2, 8), (7, 3), (17, 3), (21, 8), (21, 14), (17, 18), (6, 18), (2, 14)),
                 fill=SHADOW)
    draw.polygon(((2, 8), (7, 3), (17, 3), (21, 8), (17, 14), (6, 14)), fill=IVORY)
    draw.polygon(((5, 8), (8, 5), (16, 5), (18, 8), (16, 12), (7, 12)), fill="#456f74")
    draw.line((9, 7, 15, 7), fill="#81a39a")
    draw.point((11, 9), fill="#91aaa0")
    return image


def main():
    straight = parapet()
    corner = parapet(corner=True)
    bridge = passage()
    rail_side = railing((12, 32), vertical=True)
    manifest = SPRITES / "manifest.json"
    catalog = json.loads(manifest.read_text(encoding="utf-8"))
    catalog["worlds"]["alhambra"] = {
        "pixelScale": 2,
        "tile": SIZE,
        "islandMargin": {"x": 15, "y": 17},
        "floor": {
            "main": [save(f"patio_{i}", patio(i)) for i in range(3)],
            "detail": [save("alicatado", patio(4, ornament=True))],
        },
        "sea": [save(f"alberca_{i}", water(i)) for i in range(2)],
        "shore": {
            "n": save("muro_n", straight),
            "e": save("muro_e", straight.transpose(Image.Transpose.ROTATE_270)),
            "s": save("muro_s", ImageOps.flip(straight)),
            "w": save("muro_o", straight.transpose(Image.Transpose.ROTATE_90)),
            "nw": save("muro_no", corner),
            "ne": save("muro_ne", ImageOps.mirror(corner)),
            "sw": save("muro_so", ImageOps.flip(corner)),
            "se": save("muro_se", corner.transpose(Image.Transpose.ROTATE_180)),
        },
        "bridge": {
            "ew": [save("paso_eo", bridge)],
            "ns": [save("paso_ns", bridge.transpose(Image.Transpose.ROTATE_90))],
            "railN": save("pretil_n", railing((32, 20))),
            "railW": save("pretil_o", rail_side),
            "railE": save("pretil_e", ImageOps.mirror(rail_side)),
            "fascia": save("pretil_s", railing((32, 8), fascia=True)),
            "pile": save("contrafuerte", buttress()),
            "gateH": save("reja_eo", gate((32, 30))),
            "gateV": save("reja_ns", gate((16, 32), vertical=True)),
        },
        "props": {
            "cornerTop": [{"image": save("arco", arch()), "foot": [26, 59]}],
            "cornerBottom": [{"image": save("arrayan", planter(7)), "foot": [16, 25]}],
            "edge": [{"image": save("fuente", basin()), "foot": [12, 18]}],
        },
    }
    manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
