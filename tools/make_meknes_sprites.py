"""Generate the Meknes pixel atlas and register the sixth map."""

import json
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps


SPRITES = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites"
WORLD = "worlds/meknes"
SIZE = 32
SAND = "#b19a75"
LIME = "#d2b88c"
CLAY = "#a27a5a"
DARK_CLAY = "#715846"
OLIVE = "#656a53"
TILE = "#486e61"
TILE_LIGHT = "#789783"
IRON = "#4b4a43"
SHADOW = (58, 46, 41, 107)


def save(name, image):
    relative = f"{WORLD}/{name}.png"
    path = SPRITES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    return relative


def courtyard(seed, worn=False):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), SAND)
    draw = ImageDraw.Draw(image)
    for _ in range(26):
        x, y = rng.randrange(28), rng.randrange(32)
        d = rng.choice((1, 1, 2, 3))
        draw.line((x, y, x + d, y), fill=rng.choice(("#a58e6d", "#b8a17e", "#a99270", "#b5a080")))
    for _ in range(3):
        x, y = rng.randrange(2, 29), rng.randrange(2, 29)
        draw.line((x, y, x + 2, y), fill="#9c886d")
        draw.point((x + 1, y - 1), fill="#c6ad87")
    if worn:
        draw.line(((3, 25), (8, 23), (14, 24), (20, 20), (27, 20)), fill="#a68f6d")
        draw.line(((7, 27), (13, 26), (18, 26), (23, 22)), fill="#ba9f79")
    return image


def scrub(seed):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), OLIVE)
    draw = ImageDraw.Draw(image)
    for _ in range(24):
        x, y = rng.randrange(30), rng.randrange(32)
        draw.line((x, y, x + rng.randrange(1, 3), y),
                  fill=rng.choice(("#6e7359", "#70745d", "#5f654e", "#74775d")))
    for x, y in ((8, 10), (24, 23)):
        if rng.randrange(2):
            draw.line(((x - 2, y + 1), (x, y), (x, y - 2)), fill="#788066")
            draw.point((x + 1, y - 1), fill="#859075")
    return image


def wall(corner=False):
    image = courtyard(15).convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 1), fill=(0, 0, 0, 0))
    draw.rectangle((0, 2, 31, 13), fill=DARK_CLAY)
    draw.rectangle((0, 4, 31, 10), fill=CLAY)
    draw.line((0, 5, 31, 5), fill=LIME)
    draw.line((0, 9, 31, 9), fill="#b08a68")
    for x in range(0, 32, 8):
        draw.rectangle((x, 2, x + 4, 5), fill="#c4a27b")
        draw.line((x, 2, x + 4, 2), fill=LIME)
        draw.point((x + 6, 8), fill=DARK_CLAY)
    draw.line((0, 12, 31, 12), fill="#9b7455")
    if corner:
        draw.rectangle((0, 0, 1, 31), fill=(0, 0, 0, 0))
        draw.rectangle((2, 2, 13, 31), fill=DARK_CLAY)
        draw.rectangle((4, 4, 10, 31), fill=CLAY)
        draw.line((5, 5, 5, 31), fill=LIME)
        for y in (8, 16, 24):
            draw.rectangle((2, y, 5, y + 4), fill="#c4a27b")
            draw.line((2, y, 2, y + 4), fill=LIME)
        draw.rectangle((2, 2, 12, 12), fill="#b3906d")
        draw.rectangle((3, 3, 11, 10), outline=LIME)
        draw.rectangle((6, 5, 9, 8), fill=DARK_CLAY)
    return image


def causeway():
    image = courtyard(10)
    draw = ImageDraw.Draw(image)
    for y in (3, 25):
        draw.rectangle((0, y, 31, y + 3), fill=DARK_CLAY)
        draw.line((0, y, 31, y), fill="#bea17a")
        for x in (2, 10, 18, 26):
            draw.line((x, y + 2, x + 3, y + 2), fill=TILE_LIGHT)
    for x, y in ((7, 13), (20, 15)):
        draw.line((x, y, x + 4, y - 1), fill="#9d8466")
    return image


def guardwall(size, direction):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if direction == "v":
        draw.rectangle((3, 0, 10, 31), fill=DARK_CLAY)
        draw.rectangle((3, 0, 7, 31), fill=CLAY)
        draw.line((3, 0, 3, 31), fill=LIME)
        for y in range(1, 32, 8):
            draw.rectangle((2, y, 5, y + 3), fill="#c0a17c")
            draw.line((2, y, 2, y + 3), fill=LIME)
    else:
        y = size[1] - 6 if direction == "n" else 0
        draw.rectangle((0, y, 31, y + 5), fill=DARK_CLAY)
        draw.rectangle((0, y, 31, y + 2), fill=CLAY)
        draw.line((0, y, 31, y), fill=LIME)
        for x in range(1, 32, 8):
            draw.rectangle((x, max(0, y - 2), x + 4, y + 1), fill="#c0a17c")
            draw.line((x, max(0, y - 2), x + 4, max(0, y - 2)), fill=LIME)
    return image


def pier():
    image = Image.new("RGBA", (18, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 17, 17, 27), fill=SHADOW)
    draw.rectangle((3, 6, 14, 23), fill=DARK_CLAY)
    draw.rectangle((4, 6, 10, 22), fill=CLAY)
    draw.line((4, 15, 10, 15), fill="#bc966f")
    draw.polygon(((2, 7), (5, 3), (11, 3), (15, 7), (11, 10), (5, 10)), fill="#c5a47d")
    draw.line((5, 4, 11, 4), fill=LIME)
    return image


def gate(vertical=False):
    image = Image.new("RGBA", (16, 32) if vertical else (32, 30))
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((4, 0, 11, 31), fill=IRON)
        draw.line((5, 0, 5, 31), fill=TILE_LIGHT)
        draw.line((9, 0, 9, 31), fill=TILE)
        for y in range(3, 32, 7):
            draw.line((4, y, 11, y), fill="#8a795c")
            draw.point((7, y + 1), fill=LIME)
    else:
        for x in range(1, 32, 6):
            draw.rectangle((x, 6, x + 3, 25), fill=IRON)
            draw.line((x, 6, x, 24), fill=TILE_LIGHT)
            draw.point((x + 1, 5), fill=LIME)
        for y in (10, 20):
            draw.rectangle((0, y, 31, y + 2), fill="#8a795c")
            draw.line((0, y, 31, y), fill="#bc9e72")
            for x in range(2, 32, 6):
                draw.point((x, y + 1), fill=LIME)
    return image


def tile_band(draw, x0, y, x1):
    draw.rectangle((x0, y, x1, y + 4), fill=TILE)
    for x in range(x0 + 2, x1 - 1, 4):
        draw.polygon(((x, y), (x + 2, y + 2), (x, y + 4), (x - 2, y + 2)), fill=TILE_LIGHT)
        draw.point((x, y + 2), fill=LIME)


def city_gate():
    image = Image.new("RGBA", (83, 76))
    draw = ImageDraw.Draw(image)
    draw.polygon(((1, 60), (58, 55), (81, 64), (78, 72), (9, 75)), fill=SHADOW)
    draw.polygon(((4, 13), (65, 12), (77, 22), (77, 60), (69, 68), (4, 68)), fill=DARK_CLAY)
    draw.rectangle((5, 15, 68, 66), fill=CLAY)
    draw.polygon(((68, 16), (76, 22), (76, 59), (68, 65)), fill="#876649")
    draw.rectangle((8, 19, 63, 60), fill="#bb976e")
    draw.rectangle((7, 13, 67, 19), fill=LIME)
    draw.line((8, 14, 66, 14), fill="#e3c79d")
    for x in (8, 20, 32, 44, 56):
        draw.rectangle((x, 9, x + 6, 14), fill="#bd9a72")
        draw.line((x, 9, x + 6, 9), fill=LIME)
    draw.rectangle((17, 22, 56, 62), outline=LIME)
    tile_band(draw, 17, 24, 56)
    for x in (18, 52):
        draw.rectangle((x, 29, x + 3, 62), fill=TILE)
        for y in range(31, 61, 4):
            draw.point((x + 1, y), fill=LIME)
    draw.polygon(((23, 66), (23, 45), (22, 41), (24, 36), (29, 31), (37, 28), (45, 32),
                  (50, 38), (51, 42), (49, 46), (49, 66)), fill=LIME)
    draw.polygon(((27, 66), (27, 46), (25, 42), (28, 36), (37, 32), (45, 36), (48, 42),
                  (45, 46), (45, 66)), fill="#495d50")
    draw.line((36, 37, 36, 65), fill="#314740")
    for x in (30, 33, 40, 43):
        draw.line((x, 45, x, 63), fill="#627868")
    draw.point((34, 55), fill=LIME)
    draw.point((39, 55), fill=LIME)
    for x in (8, 58):
        draw.rectangle((x, 38, x + 6, 64), fill="#af8b66")
        draw.line((x + 1, 38, x + 1, 62), fill=LIME)
        draw.rectangle((x - 1, 63, x + 7, 66), fill="#c6a87b")
    draw.line((7, 66, 65, 66), fill=LIME)
    return image


def granary():
    image = Image.new("RGBA", (77, 64))
    draw = ImageDraw.Draw(image)
    draw.polygon(((5, 46), (53, 43), (76, 51), (72, 59), (13, 63)), fill=SHADOW)
    draw.polygon(((5, 18), (56, 13), (71, 23), (71, 48), (62, 56), (5, 56)), fill=DARK_CLAY)
    draw.rectangle((6, 20, 61, 53), fill=CLAY)
    draw.polygon(((61, 22), (70, 23), (70, 47), (61, 53)), fill="#89694f")
    draw.polygon(((6, 18), (17, 10), (56, 10), (70, 22), (61, 27), (6, 27)), fill="#b69774")
    draw.line((7, 20, 59, 20), fill=LIME)
    draw.line((11, 15, 59, 15), fill="#cfb088")
    draw.rectangle((6, 26, 61, 28), fill="#c9a67b")
    for x in (12, 28, 44):
        draw.polygon(((x, 52), (x, 40), (x + 2, 34), (x + 7, 31), (x + 12, 34),
                      (x + 14, 40), (x + 14, 52)), fill="#c5a47e")
        draw.polygon(((x + 2, 52), (x + 2, 40), (x + 4, 36), (x + 7, 34),
                      (x + 10, 36), (x + 12, 40), (x + 12, 52)), fill="#625446")
        draw.line((x + 4, 43, x + 10, 43), fill="#836951")
    draw.line((7, 53, 60, 53), fill=LIME)
    return image


def basin():
    image = Image.new("RGBA", (42, 31))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 15, 41, 30), fill=SHADOW)
    draw.polygon(((3, 11), (10, 6), (32, 6), (38, 11), (38, 20), (30, 26), (9, 26), (3, 20)),
                 fill=DARK_CLAY)
    draw.rectangle((8, 17, 31, 23), fill=CLAY)
    tile_band(draw, 9, 19, 31)
    draw.polygon(((4, 11), (10, 6), (32, 6), (37, 11), (31, 18), (9, 18)), fill=LIME)
    draw.polygon(((8, 11), (12, 8), (30, 8), (33, 11), (29, 15), (11, 15)), fill="#567c78")
    draw.line((13, 10, 27, 10), fill="#95aaa0")
    draw.line((19, 13, 28, 13), fill="#759890")
    return image


def cypress():
    image = Image.new("RGBA", (29, 45))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 33, 28, 44), fill=SHADOW)
    draw.rectangle((10, 31, 18, 41), fill=CLAY)
    draw.rectangle((8, 31, 20, 34), fill="#c4a57c")
    draw.line((14, 13, 14, 32), fill=DARK_CLAY, width=2)
    draw.polygon(((6, 29), (7, 22), (9, 19), (9, 13), (12, 8), (14, 2), (17, 5), (20, 14),
                  (20, 19), (23, 25), (20, 30), (14, 31), (9, 31)), fill="#526d56")
    rng = Random(13)
    for _ in range(28):
        x, y = rng.randrange(11, 18), rng.randrange(11, 29)
        draw.point((x, y), fill=rng.choice(("#69836a", "#789177", "#647e61")))
    return image


def floor_panel():
    image = Image.new("RGBA", (37, 23))
    draw = ImageDraw.Draw(image)
    draw.rectangle((1, 2, 36, 22), fill=SHADOW)
    draw.rectangle((2, 2, 34, 19), fill=DARK_CLAY)
    draw.rectangle((3, 3, 33, 18), outline="#bd9e74")
    for y in (6, 11):
        tile_band(draw, 5, y, 31)
    return image


def urns():
    image = Image.new("RGBA", (33, 25))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 13, 32, 24), fill=SHADOW)
    for x, y, color, light in ((1, 5, TILE, TILE_LIGHT), (11, 1, CLAY, LIME),
                                (22, 8, "#6d7961", "#a2a684")):
        draw.ellipse((x, y + 4, x + 10, y + 15), fill=color, outline=DARK_CLAY)
        draw.ellipse((x + 2, y + 6, x + 6, y + 11), fill=light)
        draw.rectangle((x + 3, y + 2, x + 7, y + 5), fill=color)
        draw.line((x + 3, y + 2, x + 7, y + 2), fill=LIME)
    return image


def main():
    straight, corner = wall(), wall(corner=True)
    route = causeway()
    side = guardwall((12, 32), "v")
    manifest = SPRITES / "manifest.json"
    catalog = json.loads(manifest.read_text(encoding="utf-8"))
    catalog["worlds"]["meknes"] = {
        "pixelScale": 2,
        "tile": SIZE,
        "islandMargin": {"x": 15, "y": 17},
        "floor": {
            "main": [save(f"patio_{i}", courtyard(i)) for i in range(3)],
            "worn": [save(f"patio_gastado_{i}", courtyard(i + 6, worn=True)) for i in range(2)],
        },
        "sea": [save(f"exterior_{i}", scrub(i)) for i in range(2)],
        "shore": {
            "n": save("muralla_n", straight),
            "e": save("muralla_e", straight.transpose(Image.Transpose.ROTATE_270)),
            "s": save("muralla_s", ImageOps.flip(straight)),
            "w": save("muralla_o", straight.transpose(Image.Transpose.ROTATE_90)),
            "nw": save("muralla_no", corner),
            "ne": save("muralla_ne", ImageOps.mirror(corner)),
            "sw": save("muralla_so", ImageOps.flip(corner)),
            "se": save("muralla_se", corner.transpose(Image.Transpose.ROTATE_180)),
        },
        "bridge": {
            "ew": [save("camino_eo", route)],
            "ns": [save("camino_ns", route.transpose(Image.Transpose.ROTATE_90))],
            "railN": save("pretil_n", guardwall((32, 20), "n")),
            "railW": save("pretil_o", side),
            "railE": save("pretil_e", ImageOps.mirror(side)),
            "fascia": save("pretil_s", guardwall((32, 8), "s")),
            "pile": save("pilar", pier()),
            "gateH": save("reja_eo", gate()),
            "gateV": save("reja_ns", gate(vertical=True)),
        },
        "props": {
            "cornerTop": [
                {"image": save("puerta_monumental", city_gate()), "foot": [38, 66]},
                {"image": save("granero", granary()), "foot": [37, 54]},
            ],
            "cornerBottom": [
                {"image": save("estanque", basin()), "foot": [20, 25]},
                {"image": save("cipres", cypress()), "foot": [14, 40]},
            ],
            "edge": [
                {"image": save("panel_ceramico", floor_panel()), "foot": [18, 16]},
                {"image": save("tinajas", urns()), "foot": [17, 20]},
            ],
        },
    }
    manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
