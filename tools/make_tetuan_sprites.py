"""Generate the pixel-art Tetuán atlas and update its manifest entry."""

import json
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps


SPRITES = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites"
WORLD = "worlds/tetuan"
SIZE = 32
GROUT = "#868a83"
SHADE = "#555f62"
LIME = "#cbc9b2"
EDGE = "#e1ddc4"
BLUE = "#4a737b"
GREEN = "#5b8374"
DARK = "#303e47"
SHADOW = (38, 46, 53, 95)


def save(name, image):
    relative = f"{WORLD}/{name}.png"
    path = SPRITES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    return relative


def stone(seed, worn=False):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), GROUT)
    draw = ImageDraw.Draw(image)
    shades = ("#a6aa9e", "#a5a79b", "#a2a79b", "#aaaca0", "#a1a697")
    for row in range(4):
        for col in range(-1, 4):
            x, y = col * 12 - row % 2 * 6, row * 8
            draw.polygon(((x + 1, y), (x + 9, y), (x + 11, y + 1), (x + 11, y + 6),
                          (x + 9, y + 7), (x + 1, y + 7), (x, y + 5), (x, y + 2)),
                         fill=rng.choice(shades))
            draw.line((x + 2, y + 1, x + 8, y + 1), fill="#afb3a6")
            draw.line((x + 3, y + 6, x + 8, y + 6), fill="#94998e")
            if rng.randrange(3) == 0:
                draw.point((x + 7, y + 3), fill="#aeb2a4")
    if worn:
        draw.line(((7, 27), (11, 24), (14, 24), (19, 19), (23, 19), (26, 17)), fill="#90968b")
    return image


def outside(seed):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), "#46545c")
    draw = ImageDraw.Draw(image)
    for _ in range(12):
        x, y = rng.randrange(28), rng.randrange(30)
        draw.line((x, y, x + rng.randrange(1, 4), y), fill=rng.choice(("#4b5b63", "#505e65", "#424f56")))
    return image


def wall(corner=False):
    image = stone(9).convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 1), fill=(0, 0, 0, 0))
    draw.rectangle((0, 2, 31, 13), fill=SHADE)
    draw.rectangle((0, 3, 31, 6), fill=LIME)
    draw.line((0, 3, 31, 3), fill=EDGE)
    draw.rectangle((0, 7, 31, 10), fill="#9eaa9b")
    draw.line((0, 11, 31, 11), fill=GREEN)
    draw.line((0, 14, 31, 14), fill="#7d877e")
    for x in range(2, 32, 8):
        draw.point((x, 9), fill=LIME)
        draw.point((x + 1, 10), fill="#627c70")
    if corner:
        draw.rectangle((0, 0, 1, 31), fill=(0, 0, 0, 0))
        draw.rectangle((2, 2, 13, 31), fill=SHADE)
        draw.rectangle((3, 3, 6, 31), fill=LIME)
        draw.line((3, 3, 3, 31), fill=EDGE)
        draw.rectangle((7, 6, 10, 31), fill="#9eaa9b")
        draw.line((11, 7, 11, 31), fill=GREEN)
        draw.rectangle((2, 2, 13, 12), fill="#b4b6a7")
        draw.rectangle((3, 3, 11, 10), outline=EDGE)
        draw.rectangle((6, 5, 9, 8), fill=GREEN)
    return image


def lane():
    image = stone(15)
    draw = ImageDraw.Draw(image)
    for y in (3, 26):
        draw.rectangle((0, y, 31, y + 2), fill=SHADE)
        draw.line((0, y, 31, y), fill=GREEN)
        for x in range(2, 32, 5):
            draw.point((x, y + 1), fill=LIME)
    return image


def parapet(size, axis):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if axis == "v":
        draw.rectangle((4, 0, 11, 31), fill=SHADE)
        draw.rectangle((4, 0, 8, 31), fill=LIME)
        draw.line((4, 0, 4, 31), fill=EDGE)
        for y in (0, 8, 16, 24):
            draw.line((6, y, 8, y), fill=GREEN)
    else:
        y = size[1] - 6 if axis == "n" else 0
        draw.rectangle((0, y, 31, y + 5), fill=SHADE)
        draw.rectangle((0, y, 31, y + 2), fill=LIME)
        draw.line((0, y, 31, y), fill=EDGE)
        for x in (2, 10, 18, 26):
            draw.line((x, y + 3, x + 2, y + 3), fill=GREEN)
    return image


def pier():
    image = Image.new("RGBA", (18, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 16, 16, 27), fill=SHADOW)
    draw.rectangle((3, 5, 13, 24), fill=SHADE)
    draw.rectangle((3, 5, 10, 21), fill="#979f93")
    draw.polygon(((2, 6), (5, 2), (11, 2), (15, 6), (11, 9), (5, 9)), fill=LIME)
    draw.line((5, 3, 11, 3), fill=EDGE)
    draw.line((4, 15, 10, 15), fill=GREEN)
    return image


def gate(vertical=False):
    image = Image.new("RGBA", (16, 32) if vertical else (32, 30))
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((4, 0, 11, 31), fill=DARK)
        draw.line((5, 0, 5, 31), fill=BLUE)
        draw.line((9, 0, 9, 31), fill="#7f9b94")
        for y in range(3, 32, 7):
            draw.line((5, y, 9, y), fill="#60766e")
            draw.point((7, y), fill=LIME)
    else:
        for x in range(1, 32, 6):
            draw.rectangle((x, 5, x + 2, 25), fill=DARK)
            draw.line((x, 5, x, 24), fill=BLUE)
            draw.point((x + 1, 4), fill=LIME)
        for y in (9, 20):
            draw.rectangle((0, y, 31, y + 2), fill="#637b71")
            draw.line((0, y, 31, y), fill="#8d9a86")
            for x in range(2, 32, 6):
                draw.point((x, y + 1), fill=LIME)
    return image


def house(trim, door, shutters, terrace=False):
    image = Image.new("RGBA", (72, 72))
    draw = ImageDraw.Draw(image)
    draw.polygon(((5, 51), (58, 49), (71, 56), (71, 64), (14, 71), (3, 65)), fill=SHADOW)
    draw.polygon(((2, 12), (57, 12), (68, 24), (68, 56), (59, 62), (2, 62)), fill=SHADE)
    draw.rectangle((3, 25, 58, 60), fill="#c5c6b2")
    draw.polygon(((58, 25), (66, 22), (66, 55), (58, 60)), fill="#9ba89d")
    draw.polygon(((2, 12), (54, 12), (66, 22), (58, 27), (2, 27)), fill="#9caba0")
    draw.polygon(((4, 11), (54, 11), (61, 17), (61, 21), (5, 21)), fill="#85958e")
    draw.rectangle((2, 9, 56, 13), fill=LIME)
    draw.line((2, 9, 54, 9), fill=EDGE)
    draw.rectangle((2, 9, 5, 25), fill=LIME)
    draw.polygon(((56, 10), (68, 20), (68, 26), (61, 26), (61, 20), (54, 14)), fill=LIME)
    draw.rectangle((2, 22, 60, 27), fill=LIME)
    draw.line((3, 22, 59, 22), fill=EDGE)
    draw.line((3, 28, 57, 28), fill="#a4aea0")
    for x in range(5, 56, 6):
        draw.point((x, 26), fill="#728980")
    draw.rectangle((3, 52, 58, 60), fill=trim)
    draw.line((3, 52, 57, 52), fill="#8fa797")
    for x in (10, 44):
        draw.rectangle((x, 34, x + 10, 45), fill=SHADE)
        draw.rectangle((x + 1, 35, x + 9, 43), fill=shutters)
        draw.line((x + 5, 35, x + 5, 44), fill=DARK)
        draw.line((x, 40, x + 9, 40), fill="#9eb5a9")
        draw.line((x - 1, 46, x + 11, 46), fill=EDGE)
    draw.polygon(((22, 60), (22, 42), (24, 37), (30, 33), (34, 33), (40, 38), (42, 42), (42, 60)),
                 fill=EDGE)
    draw.polygon(((25, 60), (25, 43), (27, 39), (32, 36), (37, 40), (39, 43), (39, 60)),
                 fill=door)
    for x in (27, 31, 35):
        draw.line((x, 43, x, 59), fill="#655547")
    draw.line((26, 46, 38, 46), fill="#99836a")
    draw.line((26, 54, 38, 54), fill="#887561")
    draw.point((35, 51), fill="#dac293")
    draw.rectangle((22, 60, 42, 62), fill="#969b8e")
    draw.line((21, 60, 43, 60), fill=EDGE)
    if terrace:
        draw.polygon(((8, 6), (39, 6), (47, 12), (47, 22), (9, 22), (8, 18)), fill=SHADE)
        draw.rectangle((9, 5, 39, 19), fill="#bfc5b1")
        draw.polygon(((39, 5), (45, 10), (45, 19), (39, 20)), fill="#909f95")
        draw.line((9, 5, 39, 5), fill=EDGE)
        draw.line((9, 19, 39, 19), fill=trim)
        for x in (16, 28):
            draw.rectangle((x, 10, x + 5, 16), fill=SHADE)
            draw.line((x + 1, 11, x + 4, 11), fill=shutters)
        draw.rectangle((43, 29, 55, 33), fill="#96ac99")
        draw.line((43, 29, 54, 29), fill=EDGE)
    else:
        draw.line((12, 16, 31, 16), fill="#a6b1a3")
        draw.line((36, 18, 52, 18), fill="#748981")
    return image


def well():
    image = Image.new("RGBA", (38, 31))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 14, 37, 30), fill=SHADOW)
    draw.polygon(((3, 11), (9, 5), (28, 5), (34, 11), (34, 20), (28, 26), (8, 26), (3, 21)),
                 fill=SHADE)
    draw.rectangle((8, 17, 28, 24), fill=GREEN)
    draw.polygon(((3, 11), (9, 5), (28, 5), (34, 11), (28, 19), (8, 19)), fill=LIME)
    draw.polygon(((7, 11), (11, 8), (26, 8), (30, 11), (26, 16), (10, 16)), fill="#50757c")
    draw.line((12, 10, 22, 10), fill="#83a8a1")
    draw.line((17, 13, 25, 13), fill="#719590")
    return image


def potted_tree(seed):
    rng = Random(seed)
    image = Image.new("RGBA", (34, 44))
    draw = ImageDraw.Draw(image)
    draw.ellipse((2, 29, 33, 42), fill=SHADOW)
    draw.polygon(((9, 29), (25, 29), (24, 39), (21, 41), (13, 41), (10, 38)), fill="#987865")
    draw.rectangle((8, 29, 26, 32), fill="#b89478")
    draw.line((11, 35, 23, 35), fill=EDGE)
    draw.line((17, 15, 17, 30), fill="#685c4c", width=2)
    draw.polygon(((2, 18), (4, 10), (10, 7), (12, 3), (22, 2), (30, 8), (33, 15), (30, 23),
                  (24, 26), (17, 24), (10, 27), (4, 24)), fill="#587765")
    for _ in range(27):
        x, y = rng.randrange(7, 28), rng.randrange(8, 22)
        draw.line((x, y, x + 1, y), fill=rng.choice(("#6c8a70", "#78947a", "#8da088")))
    return image


def pottery():
    image = Image.new("RGBA", (31, 24))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 13, 30, 23), fill=SHADOW)
    for x, y, color, light in ((0, 4, BLUE, "#86a4a8"), (10, 0, GREEN, "#a0b19a"),
                                (20, 7, "#a3836a", "#c9a78a")):
        draw.ellipse((x, y + 4, x + 10, y + 15), fill=color, outline=SHADE)
        draw.ellipse((x + 2, y + 6, x + 7, y + 11), fill=light)
        draw.rectangle((x + 3, y + 2, x + 7, y + 5), fill=color)
        draw.line((x + 3, y + 2, x + 7, y + 2), fill=LIME)
    return image


def mosaic():
    image = Image.new("RGBA", (34, 22))
    draw = ImageDraw.Draw(image)
    draw.rectangle((1, 1, 33, 21), fill=SHADE)
    draw.rectangle((2, 2, 31, 19), fill=LIME)
    draw.rectangle((4, 4, 29, 17), outline=GREEN)
    for x in (8, 17, 26):
        draw.polygon(((x, 6), (x + 4, 10), (x, 15), (x - 4, 10)), fill=BLUE)
        draw.rectangle((x - 1, 9, x + 1, 11), fill=EDGE)
    return image


def main():
    straight, corner = wall(), wall(corner=True)
    passage = lane()
    side = parapet((12, 32), "v")
    manifest = SPRITES / "manifest.json"
    catalog = json.loads(manifest.read_text(encoding="utf-8"))
    catalog["worlds"]["tetuan"] = {
        "pixelScale": 2,
        "tile": SIZE,
        "islandMargin": {"x": 15, "y": 17},
        "floor": {
            "main": [save(f"losa_{i}", stone(i)) for i in range(3)],
            "worn": [save("losa_gastada", stone(17, worn=True))],
        },
        "sea": [save(f"exterior_{i}", outside(i)) for i in range(2)],
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
            "ew": [save("calle_eo", passage)],
            "ns": [save("calle_ns", passage.transpose(Image.Transpose.ROTATE_90))],
            "railN": save("pretil_n", parapet((32, 20), "n")),
            "railW": save("pretil_o", side),
            "railE": save("pretil_e", ImageOps.mirror(side)),
            "fascia": save("pretil_s", parapet((32, 8), "s")),
            "pile": save("pilar", pier()),
            "gateH": save("reja_eo", gate()),
            "gateV": save("reja_ns", gate(vertical=True)),
        },
        "props": {
            "cornerTop": [
                {"image": save("casa_azul", house(BLUE, "#755c49", "#547b80")), "foot": [35, 61]},
                {"image": save("casa_verde", house(GREEN, "#806b51", "#648a76", terrace=True)), "foot": [35, 61]},
            ],
            "cornerBottom": [
                {"image": save("brocal", well()), "foot": [19, 24]},
                {"image": save("arbol", potted_tree(9)), "foot": [17, 39]},
            ],
            "edge": [
                {"image": save("ceramica", pottery()), "foot": [15, 19]},
                {"image": save("mosaico", mosaic()), "foot": [17, 16]},
            ],
        },
    }
    manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
