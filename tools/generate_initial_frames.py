#!/usr/bin/env python3
"""One-time migration helper: generates initial per-frame source rects
from a mega-sheet's uniform 5x3 grid. Output is the 'actions' block
for a character.json in the new format."""

import json, sys, math
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

COLS, ROWS = 5, 3

def generate(sheet_path):
    img = Image.open(sheet_path)
    w, h = img.size
    cellW = w / COLS
    cellH = h / ROWS

    actions = {}
    for action, indices in FRAME_MAP.items():
        frames = []
        for idx in indices:
            col = idx % COLS
            row = idx // COLS
            frames.append({
                "x": round(col * cellW),
                "y": round(row * cellH),
                "w": round(cellW),
                "h": round(cellH),
            })
        actions[action] = {"frames": frames}
    return actions

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_initial_frames.py <mega-sheet.png>")
        sys.exit(1)
    actions = generate(sys.argv[1])
    print(json.dumps(actions, indent=2))
