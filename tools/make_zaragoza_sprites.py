"""Generate Zaragoza's pixel-art atlas and register the fifth map."""

import json
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps


SPRITES = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites"
WORLD = "worlds/zaragoza"
SIZE = 32
MORTAR = "#78584f"
BRICK = "#995f4e"
DARK_BRICK = "#654442"
PALE_BRICK = "#bb8a69"
SAND = "#d3b38c"
CERAMIC = "#527971"
CERAMIC_LIGHT = "#91a58a"
IRON = "#3d404a"
WATER = "#394953"
SHADOW = (44, 34, 44, 125)


def save(name, image):
    relative = f"{WORLD}/{name}.png"
    path = SPRITES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    return relative


def lozenge(draw, x, y, r, color):
    draw.polygon(((x, y - r), (x + r, y), (x, y + r), (x - r, y)), fill=color)


def paving(seed, inlay=False):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), MORTAR)
    draw = ImageDraw.Draw(image)
    shades = ("#9b7161", "#967064", "#9e7565", "#936b5f", "#a07767")
    for y in (0, 16):
        for x in (0, 16):
            draw.polygon(((x + 3, y), (x + 12, y), (x + 15, y + 3), (x + 15, y + 12),
                          (x + 12, y + 15), (x + 3, y + 15), (x, y + 12), (x, y + 3)),
                         fill=rng.choice(shades))
            draw.line((x + 4, y + 1, x + 11, y + 1), fill="#aa7f6d")
            draw.line((x + 4, y + 14, x + 11, y + 14), fill="#896155")
            draw.point((x + rng.randint(5, 10), y + 4), fill="#a9806d")
    for x in (0, 16, 32):
        for y in (0, 16, 32):
            lozenge(draw, x, y, 2, "#ab826a")
    if inlay:
        for x, y in ((8, 8), (24, 24)):
            lozenge(draw, x, y, 5, DARK_BRICK)
            lozenge(draw, x, y, 4, CERAMIC if seed % 2 else PALE_BRICK)
            lozenge(draw, x, y, 2, SAND)
            draw.point((x, y), fill=BRICK)
    return image


def river(seed):
    image = Image.new("RGB", (SIZE, SIZE), WATER)
    draw = ImageDraw.Draw(image)
    rng = Random(seed)
    for _ in range(11):
        x, y = rng.randrange(26), rng.randrange(32)
        draw.line((x, y, x + rng.randrange(2, 7), y),
                  fill=rng.choice(("#42565f", "#465a62", "#35444f", "#3d5058")))
    return image


def cornice(draw, x0, y, x1):
    draw.rectangle((x0, y, x1, y + 4), fill=DARK_BRICK)
    draw.line((x0, y, x1, y), fill=PALE_BRICK)
    for x in range(x0 + 1, x1 - 1, 4):
        draw.line((x, y + 2, x + 1, y + 2), fill=CERAMIC_LIGHT)


def wall(corner=False):
    image = paving(10).convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 1), fill=(0, 0, 0, 0))
    draw.rectangle((0, 2, 31, 12), fill=DARK_BRICK)
    draw.rectangle((0, 3, 31, 8), fill=BRICK)
    draw.line((0, 3, 31, 3), fill=PALE_BRICK)
    for x in (2, 10, 18, 26):
        draw.line((x, 4, x, 7), fill=MORTAR)
        lozenge(draw, x + 3, 8, 2, CERAMIC)
        draw.point((x + 3, 8), fill=SAND)
    draw.line((0, 11, 31, 11), fill=PALE_BRICK)
    if corner:
        draw.rectangle((0, 0, 1, 31), fill=(0, 0, 0, 0))
        draw.rectangle((2, 2, 12, 31), fill=DARK_BRICK)
        draw.rectangle((3, 3, 8, 31), fill=BRICK)
        draw.line((3, 3, 3, 31), fill=PALE_BRICK)
        for y in (10, 18, 26):
            draw.line((4, y + 1, 7, y + 1), fill=MORTAR)
            lozenge(draw, 8, y + 3, 2, CERAMIC)
            draw.point((8, y + 3), fill=SAND)
        draw.rectangle((2, 2, 11, 11), fill=PALE_BRICK)
        draw.rectangle((3, 3, 10, 10), outline=SAND)
        lozenge(draw, 6, 6, 2, CERAMIC)
    return image


def bridge():
    image = paving(5)
    draw = ImageDraw.Draw(image)
    for y in (2, 27):
        draw.rectangle((0, y, 31, y + 3), fill=DARK_BRICK)
        draw.line((0, y, 31, y), fill=PALE_BRICK)
        for x in range(2, 32, 6):
            draw.line((x, y + 2, x + 2, y + 2), fill=CERAMIC_LIGHT)
    return image


def parapet(size, orientation):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if orientation == "v":
        draw.rectangle((3, 0, 10, 31), fill=DARK_BRICK)
        draw.rectangle((3, 0, 7, 31), fill=BRICK)
        draw.line((3, 0, 3, 31), fill=PALE_BRICK)
        for y in range(2, 32, 8):
            draw.line((4, y, 6, y), fill=MORTAR)
            draw.point((8, y + 1), fill=CERAMIC_LIGHT)
    else:
        y = size[1] - 6 if orientation == "n" else 0
        draw.rectangle((0, y, 31, y + 5), fill=DARK_BRICK)
        draw.rectangle((0, y, 31, y + 2), fill=BRICK)
        draw.line((0, y, 31, y), fill=PALE_BRICK)
        for x in range(2, 32, 7):
            draw.line((x, y + 1, x, y + 3), fill=MORTAR)
            draw.point((x + 1, y + 4), fill=CERAMIC_LIGHT)
    return image


def support():
    image = Image.new("RGBA", (18, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 17, 17, 27), fill=SHADOW)
    draw.rectangle((3, 5, 14, 23), fill=DARK_BRICK)
    draw.rectangle((3, 5, 10, 21), fill=BRICK)
    draw.polygon(((2, 6), (5, 2), (11, 2), (15, 6), (11, 9), (5, 9)), fill=PALE_BRICK)
    draw.line((5, 3, 11, 3), fill=SAND)
    draw.line((3, 15, 10, 15), fill=MORTAR)
    draw.line((4, 17, 9, 17), fill=CERAMIC)
    return image


def gate(vertical=False):
    image = Image.new("RGBA", (16, 32) if vertical else (32, 30))
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((4, 0, 11, 31), fill=IRON)
        draw.line((5, 0, 5, 31), fill="#9b8268")
        draw.line((9, 0, 9, 31), fill="#73675d")
        for y in range(3, 32, 7):
            draw.line((4, y, 11, y), fill="#625951")
            draw.point((7, y + 1), fill=SAND)
    else:
        for x in range(1, 32, 6):
            draw.rectangle((x, 5, x + 2, 24), fill=IRON)
            draw.line((x, 5, x, 24), fill="#a98d72")
            lozenge(draw, x + 1, 5, 1, SAND)
        for y in (9, 19):
            draw.rectangle((0, y, 31, y + 2), fill="#777065")
            draw.line((0, y, 31, y), fill="#ab9479")
            for x in range(2, 32, 6):
                draw.point((x, y + 1), fill=SAND)
    return image


def tower(tall=True):
    image = Image.new("RGBA", (72, 77))
    draw = ImageDraw.Draw(image)
    draw.polygon(((7, 57), (50, 56), (71, 64), (68, 72), (15, 76), (2, 70)), fill=SHADOW)
    roof = 7 if tall else 17
    draw.polygon(((7, roof + 10), (48, roof + 7), (62, roof + 15), (62, 62), (49, 68), (7, 68)),
                 fill=DARK_BRICK)
    draw.rectangle((8, roof + 10, 48, 65), fill=BRICK)
    draw.polygon(((48, roof + 10), (61, roof + 15), (61, 60), (48, 65)), fill="#774b43")
    for y in range(roof + 14, 65, 5):
        draw.line((8, y, 47, y), fill="#87554a")
        for x in range(12 + y % 2 * 4, 48, 8):
            draw.line((x, y + 1, x, y + 4), fill="#8a594e")
    draw.polygon(((7, roof + 8), (18, roof + 1), (48, roof + 1), (61, roof + 10),
                  (49, roof + 17), (7, roof + 17)), fill=PALE_BRICK)
    draw.polygon(((12, roof + 8), (20, roof + 3), (46, roof + 3), (55, roof + 9),
                  (47, roof + 12), (12, roof + 12)), fill="#6f7770")
    draw.line((8, roof + 13, 48, roof + 13), fill=SAND)
    cornice(draw, 8, roof + 16, 48)
    for x in (9, 20, 32, 44):
        draw.rectangle((x, roof + 10, x + 4, roof + 14), fill=BRICK)
        draw.line((x, roof + 10, x + 4, roof + 10), fill=SAND)
    if tall:
        for x in (17, 31):
            draw.polygon(((x, 39), (x, 30), (x + 3, 25), (x + 7, 25), (x + 10, 30),
                          (x + 10, 39)), fill=PALE_BRICK)
            draw.polygon(((x + 2, 39), (x + 2, 31), (x + 5, 28), (x + 8, 31), (x + 8, 39)), fill=IRON)
    else:
        for x in range(14, 46, 8):
            lozenge(draw, x, 40, 3, CERAMIC)
            draw.point((x, 40), fill=SAND)
    cornice(draw, 8, 44, 48)
    for x in range(13, 48, 7):
        lozenge(draw, x, 50, 3, PALE_BRICK)
        draw.point((x, 50), fill=CERAMIC)
    draw.polygon(((22, 66), (22, 60), (25, 55), (29, 54), (33, 57), (35, 61), (35, 66)),
                 fill=PALE_BRICK)
    draw.polygon(((24, 66), (24, 60), (29, 56), (33, 61), (33, 66)), fill="#5a4842")
    draw.line((29, 62, 29, 65), fill="#a48769")
    draw.line((8, 65, 47, 65), fill=PALE_BRICK)
    return image


def arcade():
    image = Image.new("RGBA", (60, 50))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 30, 59, 49), fill=SHADOW)
    draw.polygon(((3, 11), (50, 11), (57, 17), (57, 37), (50, 42), (3, 42)), fill=DARK_BRICK)
    draw.rectangle((3, 12, 50, 40), fill=BRICK)
    cornice(draw, 3, 12, 50)
    for x in (7, 22, 37):
        draw.polygon(((x, 39), (x, 28), (x + 2, 23), (x + 6, 21),
                      (x + 10, 23), (x + 12, 28), (x + 12, 39)), fill=PALE_BRICK)
        draw.polygon(((x + 2, 39), (x + 2, 29), (x + 6, 24),
                      (x + 10, 29), (x + 10, 39)), fill=IRON)
        lozenge(draw, x + 6, 19, 2, CERAMIC)
    draw.rectangle((3, 39, 50, 41), fill=PALE_BRICK)
    return image


def planter():
    image = Image.new("RGBA", (39, 31))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 19, 38, 30), fill=SHADOW)
    draw.polygon(((2, 15), (34, 15), (37, 20), (33, 25), (7, 25), (2, 22)), fill=DARK_BRICK)
    draw.rectangle((3, 17, 34, 22), fill=BRICK)
    draw.line((4, 18, 33, 18), fill=PALE_BRICK)
    draw.line((5, 21, 32, 21), fill=CERAMIC_LIGHT)
    rng = Random(19)
    for x, y in ((9, 11), (18, 9), (27, 11)):
        draw.ellipse((x - 6, y - 5, x + 7, y + 7), fill="#52705c")
        for _ in range(8):
            px, py = x + rng.randrange(-4, 5), y + rng.randrange(-3, 5)
            draw.point((px, py), fill=rng.choice(("#799378", "#849d80", "#627d64")))
    return image


def glazed_panel():
    image = Image.new("RGBA", (42, 24))
    draw = ImageDraw.Draw(image)
    draw.rectangle((1, 2, 41, 23), fill=SHADOW)
    draw.rectangle((2, 2, 39, 20), fill=DARK_BRICK)
    draw.rectangle((4, 4, 37, 18), outline=PALE_BRICK)
    for x in (10, 20, 30):
        lozenge(draw, x, 11, 5, CERAMIC)
        lozenge(draw, x, 11, 3, CERAMIC_LIGHT)
        draw.rectangle((x - 1, 10, x + 1, 12), fill=SAND)
    return image


def lamp():
    image = Image.new("RGBA", (23, 29))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 20, 22, 28), fill=SHADOW)
    draw.line((11, 9, 11, 24), fill=IRON, width=2)
    draw.rectangle((8, 23, 15, 25), fill="#8e7566")
    draw.polygon(((6, 6), (11, 3), (16, 6), (16, 14), (11, 17), (6, 14)), fill=IRON)
    draw.rectangle((8, 7, 14, 13), fill="#bf8f54")
    draw.rectangle((10, 8, 12, 12), fill="#ebbe7e")
    draw.line((6, 6, 16, 6), fill="#a18569")
    return image


def main():
    straight, corner = wall(), wall(corner=True)
    lane = bridge()
    side = parapet((12, 32), "v")
    manifest = SPRITES / "manifest.json"
    catalog = json.loads(manifest.read_text(encoding="utf-8"))
    catalog["worlds"]["zaragoza"] = {
        "pixelScale": 2,
        "tile": SIZE,
        "islandMargin": {"x": 15, "y": 17},
        "floor": {
            "main": [save(f"pavimento_{i}", paving(i)) for i in range(3)],
            "detail": [save(f"sector_vidriado_{i}", paving(i, inlay=True)) for i in range(2)],
        },
        "sea": [save(f"rio_{i}", river(i)) for i in range(2)],
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
            "ew": [save("puente_eo", lane)],
            "ns": [save("puente_ns", lane.transpose(Image.Transpose.ROTATE_90))],
            "railN": save("pretil_n", parapet((32, 20), "n")),
            "railW": save("pretil_o", side),
            "railE": save("pretil_e", ImageOps.mirror(side)),
            "fascia": save("pretil_s", parapet((32, 8), "s")),
            "pile": save("pilar", support()),
            "gateH": save("reja_eo", gate()),
            "gateV": save("reja_ns", gate(vertical=True)),
        },
        "props": {
            "cornerTop": [
                {"image": save("torre_campanario", tower()), "foot": [33, 66]},
                {"image": save("torre_vidriada", tower(tall=False)), "foot": [33, 66]},
            ],
            "cornerBottom": [
                {"image": save("arqueria", arcade()), "foot": [27, 41]},
                {"image": save("jardinera", planter()), "foot": [19, 24]},
            ],
            "edge": [
                {"image": save("panel_vidriado", glazed_panel()), "foot": [21, 16]},
                {"image": save("farol", lamp()), "foot": [11, 25]},
            ],
        },
    }
    manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
