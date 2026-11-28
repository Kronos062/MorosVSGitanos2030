"""Generate the cellar courtyard atlas for Jerez de la Frontera."""

import json
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps


SPRITES = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites"
WORLD = "worlds/jerez"
SIZE = 32
ALBERO = "#b59a6e"
OCHRE = "#c4a878"
BRICK = "#a57559"
BRICK_LIGHT = "#bc916e"
BRICK_DARK = "#755044"
LIME = "#d8caab"
LIME_SHADE = "#b9aa8e"
OAK = "#715545"
IRON = "#51484a"
VINE = "#5b7258"
SHADOW = (56, 41, 43, 115)


def save(name, image):
    relative = f"{WORLD}/{name}.png"
    path = SPRITES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    return relative


def patio(seed, worn=False):
    image = Image.new("RGB", (SIZE, SIZE), ALBERO)
    draw = ImageDraw.Draw(image)
    rng = Random(seed)
    for _ in range(29):
        x, y = rng.randrange(29), rng.randrange(32)
        draw.line((x, y, x + rng.randrange(1, 4), y),
                  fill=rng.choice(("#ae936b", "#bca078", "#b29870", "#bf9f70")))
    if worn:
        for x, y in ((4, 8), (10, 4), (16, 7), (24, 4), (17, 16), (22, 19), (7, 23)):
            draw.line((x, y + 2, x + 4, y + 2), fill="#a68c66")
            draw.line((x, y + 1, x + 4, y + 1), fill="#baa37c")
            draw.line((x + 1, y, x + 3, y), fill=OCHRE)
    return image


def vineyard(seed):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), "#596853")
    draw = ImageDraw.Draw(image)
    for y in range(SIZE):
        for x in range(SIZE):
            furrow = (x + y) % 16
            if furrow == 0:
                draw.point((x, y), fill="#515e4c")
            elif 2 <= furrow <= 5 and (x - y + seed) % 10 < 6:
                draw.point((x, y), fill=rng.choice(("#627357", "#6b785b", "#617154")))
    for _ in range(19):
        x, y = rng.randrange(29), rng.randrange(32)
        draw.line((x, y, x + rng.randrange(1, 3), y),
                  fill=rng.choice(("#6b795f", "#68775b", "#606e55", "#54634f")))
    return image


def wall(corner=False):
    image = patio(9).convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 1), fill=(0, 0, 0, 0))
    draw.rectangle((0, 2, 31, 12), fill=BRICK_DARK)
    draw.rectangle((0, 3, 31, 9), fill=LIME_SHADE)
    draw.line((0, 3, 31, 3), fill=LIME)
    draw.rectangle((0, 8, 31, 10), fill=BRICK)
    for x in range(0, 32, 8):
        draw.rectangle((x, 2, x + 5, 3), fill=BRICK_LIGHT)
        draw.line((x, 8, x, 10), fill=BRICK_DARK)
    if corner:
        draw.rectangle((0, 0, 1, 31), fill=(0, 0, 0, 0))
        draw.rectangle((2, 2, 12, 31), fill=BRICK_DARK)
        draw.rectangle((3, 3, 9, 31), fill=LIME_SHADE)
        draw.line((3, 3, 3, 31), fill=LIME)
        draw.rectangle((8, 3, 10, 31), fill=BRICK)
        for y in range(8, 32, 8):
            draw.line((8, y, 10, y), fill=BRICK_DARK)
        draw.rectangle((2, 2, 11, 11), fill=BRICK_LIGHT)
        draw.rectangle((3, 3, 10, 10), outline=LIME)
    return image


def path_tile():
    image = patio(11, worn=True)
    draw = ImageDraw.Draw(image)
    for y in (3, 25):
        draw.rectangle((0, y, 31, y + 3), fill=BRICK_DARK)
        draw.line((0, y, 31, y), fill=BRICK_LIGHT)
        for x in (1, 9, 17, 25):
            draw.point((x, y + 2), fill=LIME)
    return image


def rail(size, axis):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if axis == "v":
        draw.rectangle((3, 0, 10, 31), fill=BRICK_DARK)
        draw.rectangle((3, 0, 7, 31), fill=BRICK)
        draw.line((3, 0, 3, 31), fill=BRICK_LIGHT)
        for y in range(0, 32, 8):
            draw.rectangle((3, y, 7, y + 2), fill=LIME_SHADE)
    else:
        y = size[1] - 6 if axis == "n" else 0
        draw.rectangle((0, y, 31, y + 5), fill=BRICK_DARK)
        draw.rectangle((0, y, 31, y + 2), fill=BRICK)
        draw.line((0, y, 31, y), fill=BRICK_LIGHT)
        for x in range(2, 32, 8):
            draw.rectangle((x, y + 1, x + 2, y + 2), fill=LIME_SHADE)
    return image


def post():
    image = Image.new("RGBA", (18, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 16, 17, 27), fill=SHADOW)
    draw.rectangle((4, 6, 13, 23), fill=BRICK_DARK)
    draw.rectangle((4, 6, 10, 21), fill=BRICK)
    draw.line((5, 14, 10, 14), fill=BRICK_LIGHT)
    draw.polygon(((3, 7), (5, 3), (11, 3), (15, 7), (11, 10), (5, 10)), fill=LIME_SHADE)
    draw.line((5, 4, 11, 4), fill=LIME)
    return image


def gate(vertical=False):
    image = Image.new("RGBA", (16, 32) if vertical else (32, 30))
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((4, 0, 11, 31), fill=IRON)
        draw.line((5, 0, 5, 31), fill="#a08269")
        draw.line((9, 0, 9, 31), fill="#7b675a")
        for y in range(3, 32, 7):
            draw.line((4, y, 11, y), fill="#93745d")
            draw.point((7, y + 1), fill=LIME)
    else:
        for x in range(1, 32, 6):
            draw.rectangle((x, 6, x + 2, 25), fill=IRON)
            draw.line((x, 6, x, 24), fill="#a08269")
            draw.point((x + 1, 5), fill=LIME)
        for y in (9, 20):
            draw.rectangle((0, y, 31, y + 2), fill="#7b675a")
            draw.line((0, y, 31, y), fill="#ac8d72")
            for x in range(2, 32, 6):
                draw.point((x, y + 1), fill=LIME)
    return image


def barrel(draw, x, y, size=1):
    def point(dx, dy):
        return x + round(dx * size), y + round(dy * size)

    draw.polygon([point(dx, dy) for dx, dy in ((0, 5), (4, 1), (16, 1), (21, 5),
                 (22, 10), (19, 15), (3, 15), (0, 11))], fill="#493d37")
    draw.rectangle((*point(3, 3), *point(17, 12)), fill=OAK)
    draw.line((*point(4, 4), *point(17, 4)), fill="#ae8460")
    draw.line((*point(4, 8), *point(17, 8)), fill="#866149")
    draw.line((*point(5, 11), *point(16, 11)), fill="#594638")
    for dx in (5, 14):
        draw.line((*point(dx, 2), *point(dx, 13)), fill=IRON)
        draw.point(point(dx, 4), fill="#a8957e")
    draw.ellipse((*point(15, 2), *point(22, 14)), fill="#705142", outline="#b48b65")
    draw.point(point(19, 8), fill="#483a35")


def cellar(arcade=False):
    image = Image.new("RGBA", (80, 74))
    draw = ImageDraw.Draw(image)
    draw.polygon(((2, 53), (54, 47), (78, 61), (74, 68), (13, 73), (2, 66)), fill=SHADOW)
    if arcade:
        draw.polygon(((5, 22), (20, 13), (62, 13), (74, 25), (74, 57), (65, 64), (5, 64)),
                     fill=BRICK_DARK)
        draw.rectangle((6, 28, 64, 62), fill=LIME_SHADE)
        draw.polygon(((64, 29), (73, 25), (73, 56), (64, 61)), fill="#9d8a72")
        draw.polygon(((3, 23), (19, 11), (62, 11), (76, 23), (64, 30), (3, 30)), fill=BRICK)
        draw.line((6, 24, 72, 24), fill=BRICK_LIGHT)
        draw.line((5, 29, 64, 29), fill=BRICK_DARK)
        for x in (11, 28, 45):
            draw.polygon(((x, 60), (x, 43), (x + 2, 38), (x + 7, 35), (x + 12, 38),
                          (x + 14, 43), (x + 14, 60)), fill=BRICK_LIGHT)
            draw.polygon(((x + 2, 60), (x + 2, 44), (x + 4, 40), (x + 7, 38), (x + 10, 40),
                          (x + 12, 44), (x + 12, 60)), fill=IRON)
        barrel(draw, 29, 47, .62)
        draw.line((6, 62, 64, 62), fill=LIME)
    else:
        draw.polygon(((7, 27), (24, 12), (58, 12), (73, 25), (73, 55), (62, 64), (7, 64)),
                     fill=BRICK_DARK)
        draw.polygon(((7, 31), (28, 12), (50, 30), (50, 62), (7, 62)), fill=LIME)
        draw.polygon(((50, 30), (72, 25), (72, 55), (50, 62)), fill=LIME_SHADE)
        draw.polygon(((28, 11), (54, 8), (75, 24), (50, 32)), fill=BRICK)
        for y in (14, 19, 24):
            draw.line((31 + y - 14, y, 59 + y - 14, y), fill=BRICK_LIGHT)
        draw.line(((6, 32), (28, 11), (50, 32)), fill=BRICK_DARK, width=2)
        draw.line(((7, 30), (28, 11), (49, 30)), fill=BRICK_LIGHT)
        draw.ellipse((24, 22, 32, 30), fill=BRICK_LIGHT)
        draw.ellipse((26, 23, 30, 29), fill=IRON)
        draw.line((28, 24, 28, 28), fill=LIME_SHADE)
        draw.polygon(((17, 62), (17, 46), (20, 40), (28, 37), (36, 41), (40, 47), (40, 62)),
                     fill=BRICK_LIGHT)
        draw.polygon(((20, 62), (20, 47), (23, 43), (28, 40), (34, 43), (37, 48), (37, 62)),
                     fill="#645044")
        for x in (23, 27, 31, 35):
            draw.line((x, 48, x, 62), fill="#866b55")
        draw.point((31, 55), fill="#d0af76")
        for x, y in ((53, 38), (64, 35)):
            draw.rectangle((x, y, x + 5, y + 9), fill=BRICK_LIGHT)
            draw.rectangle((x + 1, y + 1, x + 4, y + 7), fill=IRON)
        draw.line((7, 62, 49, 62), fill=BRICK_LIGHT)
    return image


def casks():
    image = Image.new("RGBA", (51, 35))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 22, 50, 34), fill=SHADOW)
    draw.rectangle((3, 26, 44, 30), fill="#4b3f37")
    draw.line((4, 27, 43, 27), fill="#966e50")
    barrel(draw, 5, 12)
    barrel(draw, 24, 12)
    barrel(draw, 15, 1)
    return image


def well():
    image = Image.new("RGBA", (37, 32))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 18, 36, 31), fill=SHADOW)
    draw.polygon(((3, 13), (10, 7), (26, 7), (33, 13), (33, 23), (27, 27), (9, 27), (3, 23)),
                 fill=BRICK_DARK)
    draw.rectangle((8, 19, 28, 25), fill=BRICK)
    draw.polygon(((3, 13), (10, 7), (26, 7), (33, 13), (27, 20), (9, 20)), fill=LIME_SHADE)
    draw.polygon(((7, 13), (12, 9), (24, 9), (29, 13), (25, 17), (11, 17)), fill="#4e5a59")
    draw.line((12, 11, 23, 11), fill="#829489")
    draw.line((9, 16, 9, 4), fill=OAK, width=2)
    draw.line((27, 16, 27, 4), fill=OAK, width=2)
    draw.line((8, 4, 28, 4), fill="#a28264", width=2)
    draw.line((18, 5, 18, 13), fill="#c4aa82")
    return image


def trellis():
    image = Image.new("RGBA", (46, 31))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 17, 45, 30), fill=SHADOW)
    for x in (5, 22, 40):
        draw.rectangle((x, 6, x + 2, 25), fill=OAK)
        draw.line((x, 6, x, 23), fill="#ab8767")
    draw.line((5, 9, 42, 9), fill="#976f57", width=2)
    draw.line((5, 16, 42, 16), fill="#976f57", width=2)
    rng = Random(12)
    for x in range(7, 41, 4):
        y = rng.randrange(4, 10)
        draw.ellipse((x - 2, y, x + 5, y + 7), fill=VINE)
        draw.line((x, y + 2, x + 3, y + 2), fill="#809271")
        if x % 3 == 1:
            draw.point((x + 2, y + 6), fill="#87738a")
            draw.point((x + 2, y + 8), fill="#6d5b70")
    return image


def baskets():
    image = Image.new("RGBA", (33, 23))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 12, 32, 22), fill=SHADOW)
    for x, y, fruit in ((1, 6, "#796778"), (11, 2, "#7c8567"), (22, 6, "#776476")):
        draw.ellipse((x, y + 3, x + 10, y + 13), fill=OAK)
        draw.ellipse((x, y, x + 10, y + 8), fill="#bb9770")
        draw.ellipse((x + 2, y + 1, x + 8, y + 6), fill=fruit)
        draw.line((x + 2, y + 9, x + 8, y + 9), fill="#a88762")
        draw.point((x + 4, y + 2), fill=LIME_SHADE)
    return image


def main():
    straight, corner = wall(), wall(corner=True)
    passage = path_tile()
    side = rail((12, 32), "v")
    manifest = SPRITES / "manifest.json"
    catalog = json.loads(manifest.read_text(encoding="utf-8"))
    catalog["worlds"]["jerez"] = {
        "pixelScale": 2,
        "tile": SIZE,
        "islandMargin": {"x": 15, "y": 17},
        "floor": {
            "main": [save(f"albero_{i}", patio(i)) for i in range(3)],
            "worn": [save(f"albero_gastado_{i}", patio(i + 5, worn=True)) for i in range(2)],
        },
        "sea": [save(f"vina_{i}", vineyard(i)) for i in range(2)],
        "shore": {
            "n": save("tapia_n", straight),
            "e": save("tapia_e", straight.transpose(Image.Transpose.ROTATE_270)),
            "s": save("tapia_s", ImageOps.flip(straight)),
            "w": save("tapia_o", straight.transpose(Image.Transpose.ROTATE_90)),
            "nw": save("tapia_no", corner),
            "ne": save("tapia_ne", ImageOps.mirror(corner)),
            "sw": save("tapia_so", ImageOps.flip(corner)),
            "se": save("tapia_se", corner.transpose(Image.Transpose.ROTATE_180)),
        },
        "bridge": {
            "ew": [save("pasaje_eo", passage)],
            "ns": [save("pasaje_ns", passage.transpose(Image.Transpose.ROTATE_90))],
            "railN": save("borde_n", rail((32, 20), "n")),
            "railW": save("borde_o", side),
            "railE": save("borde_e", ImageOps.mirror(side)),
            "fascia": save("borde_s", rail((32, 8), "s")),
            "pile": save("pilar", post()),
            "gateH": save("reja_eo", gate()),
            "gateV": save("reja_ns", gate(vertical=True)),
        },
        "props": {
            "cornerTop": [
                {"image": save("bodega", cellar()), "foot": [38, 62]},
                {"image": save("galeria", cellar(arcade=True)), "foot": [39, 62]},
            ],
            "cornerBottom": [
                {"image": save("pozo", well()), "foot": [19, 26]},
                {"image": save("botas_apiladas", casks()), "foot": [26, 28]},
            ],
            "edge": [
                {"image": save("emparrado", trellis()), "foot": [23, 24]},
                {"image": save("cestas", baskets()), "foot": [16, 19]},
            ],
        },
    }
    manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
