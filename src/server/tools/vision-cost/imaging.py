"""Pixel work for the vision-cost bench (PIL). Driven by prepare.ts with a JSON job on stdin.

Job kinds:
  {"kind": "crop", "src": png, "box": [l, t, r, b], "out": png}
  {"kind": "fit", "src": png, "out": png, "long": px}
  {"kind": "sheet", "out": png, "width": w, "height": h,
   "items": [{"src": png, "x": x, "y": y, "w": w, "h": h, "labelY": y, "label": "3"}]}
Prints the written image's "width height".
"""

import json
import sys

from PIL import Image, ImageDraw, ImageFont


def fit(img, long_edge):
    factor = min(1.0, long_edge / max(img.size))
    if factor >= 1.0:
        return img
    size = (round(img.size[0] * factor), round(img.size[1] * factor))
    return img.resize(size, Image.LANCZOS)


def draw_sheet(job):
    sheet = Image.new("RGB", (job["width"], job["height"]), "white")
    draw = ImageDraw.Draw(sheet)
    for item in job["items"]:
        crop = Image.open(item["src"]).convert("RGB").resize((item["w"], item["h"]), Image.LANCZOS)
        sheet.paste(crop, (item["x"], item["y"]))
        draw.rectangle(
            [item["x"], item["y"], item["x"] + item["w"] - 1, item["y"] + item["h"] - 1],
            outline="black",
        )
        band = max(10, item["y"] - item["labelY"])
        font = ImageFont.load_default(size=max(10, int(band * 0.8)))
        draw.text((item["x"] + 4, item["labelY"]), "#" + item["label"], fill="blue", font=font)
    return sheet


def run(job):
    kind = job["kind"]
    if kind == "crop":
        img = Image.open(job["src"]).convert("RGB").crop(tuple(job["box"]))
    elif kind == "fit":
        img = fit(Image.open(job["src"]).convert("RGB"), job["long"])
    elif kind == "sheet":
        img = draw_sheet(job)
    else:
        raise ValueError("unknown job kind: " + str(kind))
    img.save(job["out"], optimize=True)
    return img.size


if __name__ == "__main__":
    width, height = run(json.load(sys.stdin))
    print(width, height)
