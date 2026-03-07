# Adding a New Character

1. Copy this `template/` folder to `characters/your_id/`
2. Replace all `CHANGE_ME` in `character.json` with your character's id
3. Fill in name, description, stats, and taunts
4. Set `spriteSheet` to the path of your mega-sheet PNG (e.g. `assets/your-poses.png`)
5. Define frame source rects in each action's `frames` array — each frame is `{x, y, w, h}` on the mega-sheet
6. Add a `select.png` portrait image
7. Add your character id to `characters/index.json`

## Using the sprite editor

Open `sprite-test.html` to visually define frame rects on the mega-sheet:
- Select your character and action
- Drag/resize frame rectangles on the mega-sheet
- Add/remove/reorder frames
- Set per-action hitboxes for punch/kick
- Export the updated character.json (Copy or Download)

## Generating initial frame rects from a uniform grid

```bash
source .venv/bin/activate
python tools/generate_initial_frames.py path/to/sheet.png
```

Outputs the `actions` block with uniform 5x3 grid rects as a starting point.

## Testing

Open `sprite-test.html` in the browser to preview all frames and hitboxes.
