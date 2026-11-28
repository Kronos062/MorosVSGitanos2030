"""Generate the Mercadillo pixel atlas and its manifest entry."""

import json
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps


SPRITES = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites"
WORLD = "worlds/mercadillo"
SIZE = 32
EARTH = "#594e45"
MORTAR = "#8a7967"
WOOD = "#79523b"
WOOD_DARK = "#3d3230"
WOOD_LIGHT = "#b4875b"
IRON = "#4b4c50"
SHADOW = (40, 32, 32, 125)


def save(name, image):
    relative = f"{WORLD}/{name}.png"
    path = SPRITES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    return relative


def paving(seed, worn=False):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), MORTAR)
    draw = ImageDraw.Draw(image)
    colors = ("#9a8773", "#9c8975", "#968472", "#a08d77", "#94826f")
    for row in range(4):
        y = row * 8
        offset = (row % 2) * 5
        for col in range(-1, 4):
            x = col * 11 - offset
            color = rng.choice(colors)
            draw.polygon(((x + 1, y), (x + 8, y), (x + 10, y + 2), (x + 10, y + 5),
                          (x + 8, y + 7), (x + 1, y + 7), (x, y + 5), (x, y + 2)),
                         fill=color)
            draw.line((x + 2, y + 1, x + 7, y + 1), fill="#a28e78")
            draw.line((x + 3, y + 6, x + 7, y + 6), fill="#8f7c69")
            if rng.randrange(5) == 0:
                draw.point((x + 7, y + 3), fill="#a7957e")
    if worn:
        draw.line(((6, 29), (10, 25), (16, 24), (20, 18), (28, 17)), fill="#897665")
        draw.line(((9, 27), (7, 23), (3, 23)), fill="#8c7a67")
    return image


def ground(seed):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), EARTH)
    draw = ImageDraw.Draw(image)
    for _ in range(24):
        x, y = rng.randrange(30), rng.randrange(32)
        draw.line((x, y, x + rng.randrange(1, 4), y),
                  fill=rng.choice(("#615549", "#64584e", "#514843", "#6a5b4d")))
    return image


def boundary(corner=False):
    image = paving(12).convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 5), fill=(0, 0, 0, 0))
    draw.rectangle((0, 6, 31, 11), fill="#5a4841")
    draw.line((0, 7, 31, 7), fill="#b09373")
    draw.line((0, 8, 31, 8), fill="#9c8068")
    draw.line((0, 12, 31, 12), fill="#8e7460")
    for x in (0, 8, 16, 24):
        draw.line((x, 8, x, 11), fill="#6a5549")
    if corner:
        draw.rectangle((0, 0, 5, 31), fill=(0, 0, 0, 0))
        draw.rectangle((6, 6, 11, 31), fill="#5a4841")
        draw.line((7, 7, 7, 31), fill="#b09373")
        draw.line((8, 8, 8, 31), fill="#9c8068")
        for y in (16, 24):
            draw.line((8, y, 11, y), fill="#6a5549")
        draw.rectangle((5, 5, 12, 12), fill="#745e4e")
        draw.rectangle((6, 6, 11, 11), outline="#b29978")
        draw.point((8, 8), fill="#957862")
    return image


def lane():
    image = paving(7)
    draw = ImageDraw.Draw(image)
    for y in (1, 28):
        draw.rectangle((0, y, 31, y + 2), fill="#7a6452")
        draw.line((0, y, 31, y), fill="#ba9c79")
        for x in (0, 8, 16, 24):
            draw.point((x, y + 1), fill="#d3b18a")
    return image


def fence(size, axis):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if axis == "v":
        draw.rectangle((4, 0, 8, 31), fill=WOOD_DARK)
        draw.rectangle((4, 0, 6, 31), fill=WOOD)
        draw.line((4, 0, 4, 31), fill=WOOD_LIGHT)
        for y in (2, 12, 22):
            draw.rectangle((2, y, 8, y + 3), fill="#765741")
            draw.point((3, y), fill="#c19c70")
    else:
        y = size[1] - 5 if axis == "n" else 0
        draw.rectangle((0, y, 31, y + 4), fill=WOOD_DARK)
        draw.line((0, y, 31, y), fill=WOOD_LIGHT)
        draw.line((0, y + 1, 31, y + 1), fill=WOOD)
        for x in (2, 12, 22):
            draw.rectangle((x, max(0, y - 3), x + 2, y + 3), fill="#765741")
            draw.point((x + 1, max(0, y - 3)), fill="#c19c70")
    return image


def barrier(vertical=False):
    image = Image.new("RGBA", (16, 32) if vertical else (32, 30))
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((4, 0, 11, 31), fill=WOOD_DARK)
        draw.line((5, 0, 5, 31), fill=WOOD_LIGHT)
        for y in (3, 13, 23):
            draw.rectangle((4, y, 11, y + 3), fill=IRON)
            draw.point((5, y + 1), fill="#c3a77d")
    else:
        for x in range(1, 32, 7):
            draw.rectangle((x, 6, x + 3, 26), fill=WOOD_DARK)
            draw.line((x, 5, x, 24), fill=WOOD_LIGHT)
        draw.rectangle((0, 10, 31, 14), fill=WOOD)
        draw.rectangle((0, 20, 31, 24), fill=WOOD)
        for x in (2, 12, 22, 30):
            draw.rectangle((x, 10, x + 1, 13), fill=IRON)
            draw.point((x, 11), fill="#c3a77d")
    return image


def bollard():
    image = Image.new("RGBA", (18, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 14, 16, 25), fill=SHADOW)
    draw.rectangle((4, 6, 12, 20), fill="#655b55")
    draw.polygon(((3, 7), (6, 3), (11, 3), (14, 7), (11, 10), (6, 10)), fill="#968574")
    draw.line((6, 4, 11, 4), fill="#b5a38a")
    draw.line((5, 9, 5, 19), fill="#857768")
    return image


def stall(roof, stripe, shade, goods):
    image = Image.new("RGBA", (67, 60))
    draw = ImageDraw.Draw(image)
    draw.ellipse((2, 39, 65, 58), fill=SHADOW)
    draw.rounded_rectangle((6, 27, 60, 52), radius=2, fill=WOOD_DARK)
    draw.rectangle((9, 29, 57, 48), fill="#936b47")
    for y in (34, 44):
        draw.line((9, y, 57, y), fill="#6b4937")
    for x in (7, 56):
        draw.rectangle((x, 19, x + 3, 53), fill="#4e392f")
        draw.line((x, 20, x, 51), fill=WOOD_LIGHT)
    draw.rectangle((10, 30, 56, 40), fill="#6c4a32")
    for col, (base, light) in enumerate(goods):
        x = 13 + col * 14
        draw.rectangle((x, 31, x + 11, 43), fill=WOOD_DARK)
        draw.rectangle((x + 1, 32, x + 10, 40), fill=WOOD)
        for dx, dy in ((2, 5), (4, 3), (7, 4), (8, 7), (5, 7)):
            draw.rectangle((x + dx, 29 + dy, x + dx + 2, 31 + dy), fill=base)
            draw.point((x + dx, 29 + dy), fill=light)
        draw.line((x + 1, 42, x + 10, 42), fill=WOOD_LIGHT)
    draw.rectangle((8, 45, 58, 47), fill="#c09b6c")
    draw.polygon(((10, 3), (55, 3), (65, 22), (65, 28), (1, 28), (1, 22)), fill=shade)
    draw.polygon(((11, 4), (54, 4), (63, 21), (3, 21)), fill=roof)
    for x in (14, 26, 38, 50):
        drift = (x - 32) // 4
        draw.polygon(((x, 4), (x + 6, 4), (x + 7 + drift, 21), (x - 1 + drift, 21)), fill=stripe)
        draw.rectangle((x - 1 + drift, 22, x + 7 + drift, 26), fill=stripe)
    draw.line((4, 21, 62, 21), fill="#d5b394")
    for x in range(3, 64, 8):
        draw.rectangle((x, 25, x + 4, 28), fill=shade)
        draw.line((x, 28, x + 4, 28), fill="#4c3937")
    return image


def cart():
    image = Image.new("RGBA", (40, 32))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 18, 39, 31), fill=SHADOW)
    for x in (5, 25):
        draw.ellipse((x, 16, x + 10, 28), fill=WOOD_DARK)
        draw.ellipse((x + 2, 18, x + 8, 26), outline=WOOD_LIGHT)
        draw.line((x + 5, 18, x + 5, 26), fill=WOOD_LIGHT)
        draw.line((x + 2, 22, x + 8, 22), fill=WOOD_LIGHT)
    draw.polygon(((3, 5), (30, 5), (37, 12), (30, 22), (3, 18)), fill=WOOD_DARK)
    draw.polygon(((5, 6), (29, 6), (34, 12), (29, 17), (5, 15)), fill=WOOD)
    for x in range(6, 28, 5):
        draw.line((x, 7, x + 2, 15), fill=WOOD_LIGHT)
    draw.line((28, 17, 38, 20), fill=WOOD_LIGHT, width=2)
    return image


def sacks():
    image = Image.new("RGBA", (34, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 17, 33, 27), fill=SHADOW)
    for x, y in ((13, 2), (22, 9), (1, 6)):
        draw.ellipse((x, y + 4, x + 12, y + 17), fill="#9a7659", outline="#654e44")
        draw.ellipse((x + 2, y + 6, x + 8, y + 14), fill="#b79571")
        draw.rectangle((x + 5, y + 1, x + 8, y + 5), fill="#a58567")
        draw.line((x + 4, y + 4, x + 9, y + 4), fill=WOOD_DARK)
        draw.point((x + 6, y + 3), fill="#d0b592")
    return image


def rug():
    image = Image.new("RGBA", (42, 23))
    draw = ImageDraw.Draw(image)
    draw.rectangle((1, 4, 40, 22), fill=SHADOW)
    for y in range(3, 20, 3):
        draw.line((0, y, 41, y), fill="#dcc09b")
    draw.rectangle((3, 2, 38, 20), fill="#745052")
    draw.rectangle((4, 3, 37, 19), outline="#bd9874")
    draw.rectangle((7, 6, 34, 16), fill="#a46c62")
    for x in (12, 20, 28):
        draw.polygon(((x, 7), (x + 4, 11), (x, 15), (x - 4, 11)), fill="#c8a17b")
        draw.line((x - 1, 11, x + 1, 11), fill="#62726b")
    return image


def spices():
    image = Image.new("RGBA", (35, 23))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 12, 34, 22), fill=SHADOW)
    for x, y, color, light in ((0, 5, "#9d5f48", "#cd855c"), (10, 1, "#ad8948", "#d5b66e"),
                                (22, 5, "#77815d", "#a3ae76")):
        draw.ellipse((x, y + 4, x + 12, y + 15), fill="#674a39")
        draw.ellipse((x, y, x + 12, y + 9), fill="#ad8b61")
        draw.ellipse((x + 2, y + 1, x + 10, y + 7), fill=color)
        draw.line((x + 4, y + 3, x + 8, y + 3), fill=light)
    return image


def main():
    straight, corner = boundary(), boundary(corner=True)
    passage = lane()
    side = fence((12, 32), "v")
    palette_red = (("#a35347", "#da8c62"), ("#778b59", "#a5ae65"), ("#ce9b4b", "#e6bd69"))
    palette_green = (("#a37b4f", "#cfa56a"), ("#b85d4f", "#e09c6d"), ("#778b59", "#a5ae65"))
    manifest = SPRITES / "manifest.json"
    catalog = json.loads(manifest.read_text(encoding="utf-8"))
    catalog["worlds"]["mercadillo"] = {
        "pixelScale": 2,
        "tile": SIZE,
        "islandMargin": {"x": 15, "y": 17},
        "floor": {
            "main": [save(f"adoquin_{i}", paving(i)) for i in range(3)],
            "worn": [save("adoquin_gastado", paving(19, worn=True))],
        },
        "sea": [save(f"tierra_{i}", ground(i)) for i in range(2)],
        "shore": {
            "n": save("bordillo_n", straight),
            "e": save("bordillo_e", straight.transpose(Image.Transpose.ROTATE_270)),
            "s": save("bordillo_s", ImageOps.flip(straight)),
            "w": save("bordillo_o", straight.transpose(Image.Transpose.ROTATE_90)),
            "nw": save("bordillo_no", corner),
            "ne": save("bordillo_ne", ImageOps.mirror(corner)),
            "sw": save("bordillo_so", ImageOps.flip(corner)),
            "se": save("bordillo_se", corner.transpose(Image.Transpose.ROTATE_180)),
        },
        "bridge": {
            "ew": [save("calle_eo", passage)],
            "ns": [save("calle_ns", passage.transpose(Image.Transpose.ROTATE_90))],
            "railN": save("cerca_n", fence((32, 20), "n")),
            "railW": save("cerca_o", side),
            "railE": save("cerca_e", ImageOps.mirror(side)),
            "fascia": save("cerca_s", fence((32, 8), "s")),
            "pile": save("bolardo", bollard()),
            "gateH": save("barrera_eo", barrier()),
            "gateV": save("barrera_ns", barrier(vertical=True)),
        },
        "props": {
            "cornerTop": [
                {"image": save("puesto_rojo", stall("#a74f47", "#dfad81", "#713e39", palette_red)), "foot": [33, 53]},
                {"image": save("puesto_verde", stall("#617e72", "#d0b38a", "#445c58", palette_green)), "foot": [33, 53]},
            ],
            "cornerBottom": [
                {"image": save("carretilla", cart()), "foot": [19, 26]},
                {"image": save("sacos", sacks()), "foot": [17, 23]},
            ],
            "edge": [
                {"image": save("alfombra", rug()), "foot": [21, 16]},
                {"image": save("especias", spices()), "foot": [17, 18]},
            ],
        },
    }
    manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
