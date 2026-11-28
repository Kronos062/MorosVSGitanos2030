"""Generate the blue medina atlas and register Chefchaouen."""

import json
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageOps


SPRITES = Path(__file__).resolve().parents[1] / "public" / "assets" / "sprites"
WORLD = "worlds/chefchaouen"
SIZE = 32
GROUT = "#6b8197"
STONE = "#7992a9"
PALE = "#adc5d6"
BLUE = "#658cbb"
BLUE_DARK = "#3d5d86"
INDIGO = "#304364"
WHITE = "#d3d9d5"
POT = "#a77966"
LEAF = "#688b71"
SHADOW = (36, 46, 68, 120)


def save(name, image):
    relative = f"{WORLD}/{name}.png"
    path = SPRITES / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    return relative


def cobble(seed, worn=False):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), GROUT)
    draw = ImageDraw.Draw(image)
    tones = (STONE, "#758da3", "#7e96aa", "#748ca5", "#8097ae")
    for row in range(4):
        y = row * 8
        for col in range(-1, 4):
            x = col * 11 - row % 2 * 5
            draw.polygon(((x + 1, y), (x + 8, y), (x + 10, y + 2), (x + 10, y + 5),
                          (x + 8, y + 7), (x + 1, y + 7), (x, y + 5), (x, y + 2)),
                         fill=rng.choice(tones))
            draw.line((x + 2, y + 1, x + 7, y + 1), fill="#8ba0b3")
            draw.line((x + 3, y + 6, x + 7, y + 6), fill="#6d839c")
            if rng.randrange(5) == 0:
                draw.point((x + 7, y + 3), fill="#93a8b8")
    if worn:
        draw.line(((3, 23), (7, 22), (11, 24), (18, 22), (24, 17), (27, 17)), fill="#687f94")
        draw.point((11, 23), fill=PALE)
    return image


def hillside(seed):
    rng = Random(seed)
    image = Image.new("RGB", (SIZE, SIZE), "#394b5d")
    draw = ImageDraw.Draw(image)
    for _ in range(16):
        x, y = rng.randrange(27), rng.randrange(2, 31)
        width = rng.randrange(2, 6)
        draw.line((x, y, x + width, y - width // 3),
                  fill=rng.choice(("#405568", "#485e70", "#35485a", "#3e5364")))
    for _ in range(2):
        x, y = rng.randrange(3, 28), rng.randrange(3, 28)
        if rng.randrange(3) != 0:
            draw.polygon(((x - 2, y), (x, y - 2), (x + 3, y - 1), (x + 2, y + 1)),
                         fill="#4e626b")
            draw.point((x, y - 1), fill="#5c7377")
    return image


def wall(corner=False):
    image = cobble(9).convert("RGBA")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 31, 1), fill=(0, 0, 0, 0))
    draw.rectangle((0, 2, 31, 13), fill=INDIGO)
    draw.rectangle((0, 3, 31, 8), fill=BLUE)
    draw.line((0, 3, 31, 3), fill=PALE)
    draw.line((0, 9, 31, 9), fill=WHITE)
    draw.line((0, 10, 31, 10), fill=BLUE_DARK)
    for x in range(2, 32, 8):
        draw.line((x, 6, x + 2, 6), fill="#82a4c5")
        draw.point((x + 1, 12), fill="#5b799b")
    if corner:
        draw.rectangle((0, 0, 1, 31), fill=(0, 0, 0, 0))
        draw.rectangle((2, 2, 13, 31), fill=INDIGO)
        draw.rectangle((3, 3, 8, 31), fill=BLUE)
        draw.line((3, 3, 3, 31), fill=PALE)
        draw.line((9, 8, 9, 31), fill=WHITE)
        draw.rectangle((2, 2, 11, 11), fill=BLUE_DARK)
        draw.rectangle((3, 3, 10, 10), outline=PALE)
        draw.rectangle((5, 5, 8, 8), fill=BLUE)
    return image


def lane():
    image = cobble(11)
    draw = ImageDraw.Draw(image)
    for y in (3, 25):
        draw.rectangle((0, y, 31, y + 3), fill=BLUE_DARK)
        draw.line((0, y, 31, y), fill=PALE)
        for x in range(2, 32, 8):
            draw.line((x, y + 2, x + 3, y + 2), fill="#7e9cbe")
    return image


def ledge(size, axis):
    image = Image.new("RGBA", size)
    draw = ImageDraw.Draw(image)
    if axis == "v":
        draw.rectangle((3, 0, 10, 31), fill=INDIGO)
        draw.rectangle((3, 0, 7, 31), fill=BLUE)
        draw.line((3, 0, 3, 31), fill=PALE)
        for y in range(3, 32, 8):
            draw.line((4, y, 6, y), fill=WHITE)
    else:
        y = size[1] - 6 if axis == "n" else 0
        draw.rectangle((0, y, 31, y + 5), fill=INDIGO)
        draw.rectangle((0, y, 31, y + 2), fill=BLUE)
        draw.line((0, y, 31, y), fill=PALE)
        for x in range(2, 32, 8):
            draw.line((x, y + 3, x + 2, y + 3), fill="#94afd0")
    return image


def pier():
    image = Image.new("RGBA", (18, 28))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 16, 17, 27), fill=SHADOW)
    draw.rectangle((3, 6, 14, 23), fill=INDIGO)
    draw.rectangle((4, 6, 10, 21), fill=BLUE_DARK)
    draw.line((4, 16, 10, 16), fill=BLUE)
    draw.polygon(((2, 7), (5, 3), (11, 3), (15, 7), (11, 10), (5, 10)), fill=PALE)
    draw.line((5, 4, 11, 4), fill=WHITE)
    return image


def gate(vertical=False):
    image = Image.new("RGBA", (16, 32) if vertical else (32, 30))
    draw = ImageDraw.Draw(image)
    if vertical:
        draw.rectangle((4, 0, 11, 31), fill=INDIGO)
        draw.line((5, 0, 5, 31), fill=PALE)
        draw.line((9, 0, 9, 31), fill=BLUE)
        for y in range(3, 32, 7):
            draw.line((4, y, 11, y), fill=BLUE_DARK)
            draw.point((7, y + 1), fill=WHITE)
    else:
        for x in range(1, 32, 6):
            draw.rectangle((x, 6, x + 2, 25), fill=INDIGO)
            draw.line((x, 6, x, 24), fill=PALE)
            draw.point((x + 1, 5), fill=WHITE)
        for y in (9, 20):
            draw.rectangle((0, y, 31, y + 2), fill=BLUE_DARK)
            draw.line((0, y, 31, y), fill=BLUE)
            for x in range(2, 32, 6):
                draw.point((x, y + 1), fill=WHITE)
    return image


def flowerpot(draw, x, y, bloom):
    draw.polygon(((x + 1, y + 7), (x + 10, y + 7), (x + 9, y + 12), (x + 3, y + 12)),
                 fill="#835f59")
    draw.rectangle((x, y + 7, x + 10, y + 8), fill=POT)
    draw.line((x + 3, y + 9, x + 7, y + 9), fill="#c28c71")
    draw.ellipse((x, y + 1, x + 10, y + 7), fill="#557561")
    draw.line((x + 2, y + 3, x + 8, y + 3), fill=LEAF)
    for dx, dy in ((2, 2), (5, 0), (8, 3)):
        draw.rectangle((x + dx, y + dy, x + dx + 1, y + dy + 1), fill=bloom)
        draw.point((x + dx, y + dy), fill="#e7bba6")


def house(terrace=False):
    image = Image.new("RGBA", (77, 75))
    draw = ImageDraw.Draw(image)
    draw.polygon(((4, 51), (57, 52), (75, 61), (73, 68), (15, 74), (3, 67)), fill=SHADOW)
    draw.polygon(((4, 14), (54, 13), (69, 24), (69, 59), (57, 66), (4, 66)), fill=INDIGO)
    draw.rectangle((5, 23, 56, 63), fill=BLUE if terrace else "#82a5ca")
    draw.polygon(((56, 24), (68, 23), (68, 58), (56, 63)), fill=BLUE_DARK)
    draw.polygon(((4, 13), (49, 13), (68, 23), (56, 28), (4, 28)), fill="#5178a4")
    draw.polygon(((8, 14), (48, 14), (59, 20), (55, 23), (8, 23)), fill="#7389a0")
    draw.rectangle((4, 12, 53, 15), fill=PALE)
    draw.line((5, 12, 52, 12), fill=WHITE)
    draw.rectangle((4, 23, 56, 27), fill=PALE)
    draw.line((5, 23, 55, 23), fill=WHITE)
    draw.polygon(((53, 13), (69, 22), (69, 25), (55, 18)), fill="#91adca")
    draw.rectangle((5, 52, 56, 63), fill="#527eaa" if terrace else "#6791bc")
    draw.line((6, 52, 54, 52), fill="#98b7cf")
    for x in (10, 45):
        draw.rectangle((x, 35, x + 8, 46), fill=PALE)
        draw.rectangle((x + 1, 36, x + 7, 45), fill=INDIGO)
        draw.line((x + 4, 36, x + 4, 45), fill="#88a7c6")
        draw.line((x - 1, 47, x + 9, 47), fill=WHITE)
    draw.polygon(((22, 64), (22, 44), (24, 39), (31, 34), (38, 37), (43, 44), (43, 64)), fill=WHITE)
    draw.polygon(((25, 64), (25, 45), (28, 40), (32, 38), (37, 41), (40, 45), (40, 64)),
                 fill="#3b5f9b" if terrace else "#4a72a9")
    for x in (27, 31, 35, 38):
        draw.line((x, 46, x, 63), fill="#365681")
    draw.line((26, 49, 39, 49), fill="#7399c4")
    draw.line((26, 57, 39, 57), fill="#7399c4")
    draw.point((37, 54), fill="#deb997")
    draw.rectangle((21, 63, 44, 65), fill=PALE)
    draw.line((22, 63, 43, 63), fill=WHITE)
    if terrace:
        draw.polygon(((11, 7), (36, 7), (45, 13), (45, 22), (12, 22)), fill=BLUE_DARK)
        draw.rectangle((12, 6, 37, 20), fill="#92afd0")
        draw.line((12, 6, 37, 6), fill=PALE)
        draw.line((13, 20, 36, 20), fill=WHITE)
        for x in (17, 28):
            draw.rectangle((x, 11, x + 5, 17), fill=INDIGO)
        flowerpot(draw, 45, 46, "#bd8593")
    else:
        flowerpot(draw, 8, 47, "#bb7584")
        flowerpot(draw, 45, 50, "#c68c82")
    return image


def stairs():
    image = Image.new("RGBA", (49, 38))
    draw = ImageDraw.Draw(image)
    draw.ellipse((3, 22, 48, 37), fill=SHADOW)
    for row in range(5):
        x, y = 6 - row, 5 + row * 5
        draw.polygon(((x + 4, y), (x + 35, y), (x + 42, y + 3), (x + 42, y + 8),
                      (x, y + 8), (x, y + 3)), fill=BLUE_DARK)
        draw.polygon(((x + 4, y), (x + 35, y), (x + 42, y + 3), (x, y + 3)), fill=BLUE)
        draw.line((x + 2, y + 3, x + 39, y + 3), fill=PALE)
        draw.line((x + 4, y + 6, x + 37, y + 6), fill="#5478a1")
    flowerpot(draw, 4, 1, "#bc8291")
    return image


def pots():
    image = Image.new("RGBA", (37, 26))
    draw = ImageDraw.Draw(image)
    draw.ellipse((1, 11, 36, 25), fill=SHADOW)
    flowerpot(draw, 13, 1, "#bb7584")
    flowerpot(draw, 3, 7, "#b68b9a")
    flowerpot(draw, 24, 8, "#bb7f7b")
    return image


def textile():
    image = Image.new("RGBA", (40, 24))
    draw = ImageDraw.Draw(image)
    draw.rectangle((1, 3, 39, 23), fill=SHADOW)
    for y in range(3, 20, 3):
        draw.line((0, y, 39, y), fill="#d6baa7")
    draw.rectangle((3, 2, 36, 21), fill="#826c8d")
    draw.rectangle((5, 4, 34, 19), outline="#c9a79c")
    for x in (10, 20, 30):
        draw.polygon(((x, 7), (x + 4, 11), (x, 16), (x - 4, 11)), fill="#b98291")
        draw.point((x, 11), fill=WHITE)
    return image


def jars():
    image = Image.new("RGBA", (31, 25))
    draw = ImageDraw.Draw(image)
    draw.ellipse((0, 13, 30, 24), fill=SHADOW)
    for x, y, color in ((0, 5, "#6387b3"), (10, 1, "#8f9fb1"), (20, 8, "#886b80")):
        draw.ellipse((x, y + 4, x + 10, y + 15), fill=color, outline=INDIGO)
        draw.line((x + 2, y + 9, x + 8, y + 9), fill=PALE)
        draw.rectangle((x + 3, y + 2, x + 7, y + 5), fill=color)
        draw.line((x + 3, y + 2, x + 7, y + 2), fill=WHITE)
    return image


def main():
    straight, corner = wall(), wall(corner=True)
    passage = lane()
    side = ledge((12, 32), "v")
    manifest = SPRITES / "manifest.json"
    catalog = json.loads(manifest.read_text(encoding="utf-8"))
    catalog["worlds"]["chefchaouen"] = {
        "pixelScale": 2,
        "tile": SIZE,
        "islandMargin": {"x": 15, "y": 17},
        "floor": {
            "main": [save(f"adoquin_{i}", cobble(i)) for i in range(3)],
            "worn": [save(f"adoquin_gastado_{i}", cobble(i + 5, worn=True)) for i in range(2)],
        },
        "sea": [save(f"ladera_{i}", hillside(i)) for i in range(2)],
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
            "railN": save("borde_n", ledge((32, 20), "n")),
            "railW": save("borde_o", side),
            "railE": save("borde_e", ImageOps.mirror(side)),
            "fascia": save("borde_s", ledge((32, 8), "s")),
            "pile": save("pilar", pier()),
            "gateH": save("reja_eo", gate()),
            "gateV": save("reja_ns", gate(vertical=True)),
        },
        "props": {
            "cornerTop": [
                {"image": save("casa_azul", house()), "foot": [37, 64]},
                {"image": save("casa_terraza", house(terrace=True)), "foot": [37, 64]},
            ],
            "cornerBottom": [
                {"image": save("macetas", pots()), "foot": [19, 21]},
                {"image": save("escalera", stairs()), "foot": [25, 32]},
            ],
            "edge": [
                {"image": save("tapiz", textile()), "foot": [20, 18]},
                {"image": save("jarras", jars()), "foot": [15, 21]},
            ],
        },
    }
    manifest.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
