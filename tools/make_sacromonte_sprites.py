"""Generate the Sacromonte pixel atlas and register the seventh map."""

import json
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps


SPRITES = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites"
WORLD = "worlds/sacromonte"
SIZE = 32
CLAY = "#a38472"
ROCK = "#946c68"
ROCK_LIGHT = "#b48a79"
ROCK_DARK = "#6a5260"
LIME = "#d7bb9d"
RIM = "#e0c6a8"
PURPLE = "#57495b"
GLOW = "#e6a46e"
FOLIAGE = "#5b7968"
SHADOW = (53, 39, 52, 120)


def save(name, image):
    relative = f"{WORLD}/{name}.png"
    path = SPRITES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    return relative


def terrace(seed, cobbled=False):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), CLAY)
    draw = ImageDraw.Draw(image)
    for _ in range(20):
        x, y = rng.randrange(28), rng.randrange(32)
        draw.line((x, y, x + rng.randrange(1, 4), y),
                  fill=rng.choice(("#a88a76", "#ae8e78", "#9b7c6c", "#9f806e")))
    for _ in range(3):
        x, y = rng.randrange(28), rng.randrange(2, 30)
        draw.line((x, y, x + 2, y), fill="#937669")
        draw.point((x + 1, y - 1), fill="#bf9e82")
    if cobbled:
        for x, y in ((3, 9), (11, 5), (14, 12), (23, 8), (26, 14), (10, 19)):
            draw.line((x, y + 2, x + 4, y + 2), fill="#927365")
            draw.line((x + 1, y, x + 3, y), fill="#b9967e")
            draw.line((x, y + 1, x + 4, y + 1), fill="#ad8b76")
    return image


def hillside(seed):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), PURPLE)
    draw = ImageDraw.Draw(image)
    for _ in range(8):
        x, y = rng.randrange(25), rng.randrange(2, 31)
        length = rng.randrange(3, 8)
        draw.line((x, y, x + length, y - length // 3), fill=rng.choice(("#645366", "#6b5868", "#5f5062")))
    for _ in range(20):
        x, y = rng.randrange(28), rng.randrange(32)
        draw.line((x, y, x + rng.randrange(1, 4), y),
                  fill=rng.choice(("#6a5b6c", "#726171", "#544759", "#635465")))
    return image


def ridge(corner=False):
    image = terrace(12).convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 2), fill=(0, 0, 0, 0))
    draw.polygon(((0, 6), (6, 4), (10, 5), (15, 3), (21, 3), (27, 6), (31, 6),
                  (31, 13), (24, 14), (15, 13), (7, 15), (0, 13)), fill=ROCK_DARK)
    draw.line(((0, 7), (6, 5), (10, 6), (15, 4), (21, 4), (27, 7), (31, 7)), fill=ROCK_LIGHT)
    draw.line(((0, 9), (6, 7), (11, 8), (16, 6), (22, 6), (28, 9), (31, 9)), fill=ROCK)
    draw.line(((2, 12), (9, 12), (15, 10), (22, 11), (27, 12)), fill="#86666a")
    if corner:
        draw.rectangle((0, 0, 2, 31), fill=(0, 0, 0, 0))
        draw.polygon(((3, 9), (9, 4), (13, 6), (14, 15), (12, 20), (13, 25), (12, 31),
                      (4, 31), (4, 24), (5, 19), (3, 14)), fill=ROCK_DARK)
        draw.line(((4, 10), (9, 6), (12, 7), (11, 17), (9, 22), (10, 27), (9, 31)), fill=ROCK_LIGHT)
        draw.point((9, 9), fill=LIME)
    return image


def lane():
    image = terrace(8, cobbled=True)
    draw = ImageDraw.Draw(image)
    for y in (3, 25):
        draw.rectangle((0, y, 31, y + 2), fill=ROCK_DARK)
        draw.line((0, y, 31, y), fill=ROCK_LIGHT)
        for x in (0, 8, 17, 25):
            draw.point((x, y + 2), fill=LIME)
    return image


def ledge(size, axis):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if axis == "v":
        draw.rectangle((3, 0, 10, 31), fill=ROCK_DARK)
        draw.line((3, 0, 3, 31), fill=ROCK_LIGHT)
        draw.line((6, 0, 6, 31), fill=ROCK)
        for y in range(3, 32, 8):
            draw.line((4, y, 8, y), fill="#a17a70")
    else:
        y = size[1] - 6 if axis == "n" else 0
        draw.rectangle((0, y, 31, y + 5), fill=ROCK_DARK)
        draw.line((0, y, 31, y), fill=ROCK_LIGHT)
        for x in range(2, 32, 7):
            draw.line((x, y + 2, x + 2, y + 2), fill=ROCK)
    return image


def boulder():
    image = Image.new("RGBA", (18, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 16, 17, 27), fill=SHADOW)
    draw.polygon(((1, 15), (4, 8), (8, 4), (13, 6), (15, 11), (17, 17), (13, 23), (5, 23)),
                 fill=ROCK_DARK)
    draw.polygon(((2, 15), (5, 8), (9, 5), (13, 7), (14, 14), (10, 18), (5, 18)), fill=ROCK)
    draw.line(((5, 10), (9, 7), (12, 8)), fill=ROCK_LIGHT)
    return image


def gate(vertical=False):
    image = Image.new("RGBA", (16, 32) if vertical else (32, 30))
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((4, 0, 11, 31), fill="#584341")
        draw.line((5, 0, 5, 31), fill="#bd9579")
        draw.line((9, 0, 9, 31), fill="#89685a")
        for y in range(3, 32, 7):
            draw.line((4, y, 11, y), fill="#81665c")
            draw.point((7, y + 1), fill=GLOW)
    else:
        for x in range(1, 32, 6):
            draw.rectangle((x, 6, x + 3, 25), fill="#584341")
            draw.line((x, 6, x, 24), fill="#bc9579")
            draw.point((x + 1, 5), fill="#c8a48a")
        for y in (10, 20):
            draw.rectangle((0, y, 31, y + 2), fill="#89695a")
            draw.line((0, y, 31, y), fill="#bc967b")
            for x in range(2, 32, 6):
                draw.point((x, y + 1), fill=GLOW)
    return image


def cave(wooden=False):
    image = Image.new("RGBA", (79, 73))
    draw = ImageDraw.Draw(image)
    draw.polygon(((3, 51), (59, 52), (76, 59), (78, 65), (13, 72), (1, 66)), fill=SHADOW)
    draw.polygon(((1, 51), (4, 34), (12, 24), (16, 17), (27, 13), (32, 7),
                  (45, 4), (55, 7), (59, 11), (70, 16), (75, 32), (77, 50), (72, 60),
                  (63, 62), (6, 62)), fill=ROCK_DARK)
    draw.polygon(((2, 49), (7, 32), (16, 22), (22, 19), (27, 15), (34, 9), (45, 6),
                  (54, 9), (58, 13), (68, 17), (72, 29), (70, 44), (63, 51), (6, 54)), fill=ROCK)
    draw.line(((8, 31), (16, 24), (24, 21), (34, 12), (46, 9), (58, 15), (66, 18)), fill=ROCK_LIGHT)
    draw.line(((11, 34), (19, 28), (35, 24), (49, 14), (58, 18), (65, 22)), fill="#a87f74")
    draw.line(((6, 47), (13, 41), (20, 40), (31, 35), (51, 30), (62, 26), (70, 30)), fill=ROCK_LIGHT)
    if wooden:
        draw.rectangle((53, 5, 62, 19), fill="#997f76")
        draw.polygon(((50, 5), (56, 1), (63, 2), (65, 5), (62, 8), (50, 8)), fill=LIME)
        draw.rectangle((51, 6, 58, 17), fill=LIME)
        draw.line((51, 7, 51, 17), fill=RIM)
        draw.line((54, 4, 61, 4), fill=ROCK_DARK)
    draw.polygon(((15, 61), (15, 45), (19, 37), (25, 32), (33, 29), (46, 30),
                  (54, 34), (61, 42), (62, 59), (58, 63), (18, 64)), fill="#bea08b")
    draw.polygon(((17, 60), (17, 45), (22, 38), (28, 34), (36, 32), (46, 33),
                  (53, 37), (59, 44), (59, 60), (56, 62), (19, 62)), fill=LIME)
    draw.line(((18, 46), (23, 39), (28, 35), (37, 33), (46, 34), (53, 38)), fill=RIM)
    draw.polygon(((31, 62), (31, 47), (34, 42), (39, 40), (45, 41), (50, 46),
                  (50, 62)), fill=PURPLE)
    if wooden:
        draw.rectangle((34, 47, 47, 60), fill="#75584d")
        for x in (36, 40, 44):
            draw.line((x, 47, x, 60), fill="#94715b")
        draw.line((35, 51, 47, 51), fill="#b08367")
        draw.point((44, 55), fill=GLOW)
    else:
        draw.polygon(((33, 53), (33, 47), (36, 43), (45, 43), (48, 47), (48, 50),
                      (44, 49), (40, 53), (36, 51)), fill="#b5705f")
        draw.line((35, 46, 36, 50), fill="#d79574")
        draw.line((44, 45, 45, 49), fill="#d79574")
    draw.rectangle((21, 48, 26, 54), fill="#756568")
    draw.rectangle((22, 49, 25, 53), fill=GLOW)
    draw.line((21, 55, 26, 55), fill=RIM)
    draw.line((30, 62, 50, 62), fill="#946f65")
    draw.line((33, 64, 48, 64), fill=RIM)
    return image


def prickly_pear():
    image = Image.new("RGBA", (42, 35))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 21, 40, 34), fill=SHADOW)
    for x, y, w, h, lit in ((9, 15, 9, 13, False), (24, 14, 10, 14, False),
                             (17, 11, 10, 18, True), (8, 7, 9, 12, True),
                             (27, 7, 9, 10, True), (16, 3, 9, 12, True)):
        draw.ellipse((x, y, x + w, y + h), fill=FOLIAGE if lit else "#4c675f", outline="#435850")
        draw.line((x + 2, y + 4, x + 2, y + 7), fill="#8a9a7b")
        draw.point((x + 5, y + 5), fill="#b4ac86")
        draw.point((x + 4, y + 8), fill="#9ba688")
    for x, y in ((11, 8), (28, 8), (19, 4)):
        draw.ellipse((x, y - 2, x + 3, y + 1), fill="#b67e76")
        draw.point((x + 1, y - 2), fill="#d59686")
    return image


def stone_steps():
    image = Image.new("RGBA", (41, 29))
    draw = ImageDraw.Draw(image)
    draw.ellipse((2, 15, 40, 28), fill=SHADOW)
    for row in range(4):
        x, y = 4 - row, 4 + row * 4
        draw.polygon(((x + 4, y), (x + 30, y), (x + 35, y + 3), (x + 35, y + 6),
                      (x, y + 6), (x, y + 3)), fill=ROCK_DARK)
        draw.polygon(((x + 4, y), (x + 30, y), (x + 35, y + 3), (x, y + 3)), fill=ROCK_LIGHT)
        draw.line((x + 3, y + 2, x + 31, y + 2), fill=LIME)
    return image


def lantern():
    image = Image.new("RGBA", (24, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 13, 23, 27), fill=(219, 144, 96, 85))
    draw.ellipse((3, 19, 21, 27), fill=SHADOW)
    draw.line((12, 8, 12, 24), fill="#69514e", width=2)
    draw.rectangle((8, 22, 15, 24), fill="#957061")
    draw.polygon(((6, 6), (12, 2), (17, 6), (17, 14), (12, 17), (6, 14)), fill=PURPLE)
    draw.rectangle((8, 7, 15, 13), fill=GLOW)
    draw.rectangle((10, 8, 13, 12), fill="#f8cf93")
    draw.line((6, 6, 17, 6), fill="#9c7868")
    return image


def jugs():
    image = Image.new("RGBA", (33, 24))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 12, 32, 23), fill=SHADOW)
    for x, y, color, light in ((0, 5, "#9f6e67", "#c58b78"), (10, 1, "#aa866f", "#d6ad85"),
                                (21, 7, "#648070", "#99a385")):
        draw.ellipse((x, y + 4, x + 11, y + 15), fill=color, outline=ROCK_DARK)
        draw.ellipse((x + 2, y + 6, x + 7, y + 11), fill=light)
        draw.rectangle((x + 3, y + 2, x + 8, y + 5), fill=color)
        draw.line((x + 3, y + 2, x + 8, y + 2), fill=LIME)
    return image


def main():
    straight, corner = ridge(), ridge(corner=True)
    passage = lane()
    side = ledge((12, 32), "v")
    manifest = SPRITES / "manifest.json"
    catalog = json.loads(manifest.read_text(encoding="utf-8"))
    catalog["worlds"]["sacromonte"] = {
        "pixelScale": 2,
        "tile": SIZE,
        "islandMargin": {"x": 15, "y": 17},
        "floor": {
            "main": [save(f"tierra_{i}", terrace(i)) for i in range(3)],
            "worn": [save(f"empedrado_{i}", terrace(i + 5, cobbled=True)) for i in range(2)],
        },
        "sea": [save(f"ladera_{i}", hillside(i)) for i in range(2)],
        "shore": {
            "n": save("corte_n", straight),
            "e": save("corte_e", straight.transpose(Image.Transpose.ROTATE_270)),
            "s": save("corte_s", ImageOps.flip(straight)),
            "w": save("corte_o", straight.transpose(Image.Transpose.ROTATE_90)),
            "nw": save("corte_no", corner),
            "ne": save("corte_ne", ImageOps.mirror(corner)),
            "sw": save("corte_so", ImageOps.flip(corner)),
            "se": save("corte_se", corner.transpose(Image.Transpose.ROTATE_180)),
        },
        "bridge": {
            "ew": [save("vereda_eo", passage)],
            "ns": [save("vereda_ns", passage.transpose(Image.Transpose.ROTATE_90))],
            "railN": save("borde_n", ledge((32, 20), "n")),
            "railW": save("borde_o", side),
            "railE": save("borde_e", ImageOps.mirror(side)),
            "fascia": save("borde_s", ledge((32, 8), "s")),
            "pile": save("roca", boulder()),
            "gateH": save("barrera_eo", gate()),
            "gateV": save("barrera_ns", gate(vertical=True)),
        },
        "props": {
            "cornerTop": [
                {"image": save("cueva_cortina", cave()), "foot": [39, 63]},
                {"image": save("cueva_madera", cave(wooden=True)), "foot": [39, 63]},
            ],
            "cornerBottom": [
                {"image": save("escalones", stone_steps()), "foot": [20, 23]},
                {"image": save("chumbera", prickly_pear()), "foot": [21, 28]},
            ],
            "edge": [
                {"image": save("candil", lantern()), "foot": [12, 24]},
                {"image": save("cantaros", jugs()), "foot": [16, 21]},
            ],
        },
    }
    manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
