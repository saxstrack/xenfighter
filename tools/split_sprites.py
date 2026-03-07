#!/usr/bin/env python3
"""Split a 5x3 mega sprite sheet into per-action strip PNGs."""

import json
import sys
from pathlib import Path
from PIL import Image

FRAME_MAP = {
    "idle":  [0, 1],
    "block": [2],
    "punch": [3, 4, 5],
    "kick":  [6, 7, 8, 9],
    "taunt": [10],
    "jump":  [11],
    "hit":   [12],
    "duck":  [13],
    "win":   [14],
}

def split_sheet(sheet_path, output_dir, cols=5, rows=3):
    sheet = Image.open(sheet_path)
    cell_w = sheet.width // cols
    cell_h = sheet.height // rows

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    actions = {}

    for action_name, frame_indices in FRAME_MAP.items():
        n = len(frame_indices)
        strip = Image.new("RGBA", (cell_w * n, cell_h))

        for i, frame_idx in enumerate(frame_indices):
            col = frame_idx % cols
            row = frame_idx // cols
            cell = sheet.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
            strip.paste(cell, (i * cell_w, 0))

        out_path = output_dir / f"{action_name}.png"
        strip.save(out_path)
        print(f"  {action_name}: {n} frame(s) -> {out_path}")

        actions[action_name] = {
            "sheet": str(out_path),
            "cols": n,
            "rows": 1
        }

    return actions


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <character_dir> <sheet_path> [cols] [rows]")
        print(f"Example: {sys.argv[0]} characters/lasse assets/fighter-poses.png")
        sys.exit(1)

    char_dir = Path(sys.argv[1])
    sheet_path = sys.argv[2]
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    rows = int(sys.argv[4]) if len(sys.argv) > 4 else 3

    sprites_dir = char_dir / "sprites"
    print(f"Splitting {sheet_path} ({cols}x{rows}) into {sprites_dir}/")
    actions = split_sheet(sheet_path, sprites_dir, cols, rows)

    # Update character.json with actions map
    json_path = char_dir / "character.json"
    if json_path.exists():
        with open(json_path) as f:
            data = json.load(f)
        data["actions"] = actions
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        print(f"Updated {json_path} with actions map")
    else:
        print(f"Warning: {json_path} not found, skipping JSON update")


if __name__ == "__main__":
    main()
