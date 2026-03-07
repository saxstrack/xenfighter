# Adding a New Character

1. Copy this `template/` folder to `characters/your_id/`
2. Replace all `CHANGE_ME` in `character.json` with your character's id
3. Fill in name, description, stats, and taunts
4. Create sprite strips in `characters/your_id/sprites/`:
   - Each action gets its own PNG strip (horizontal frames)
   - Required actions: idle, block, punch, kick, taunt, jump, hit, duck, win
   - Update `cols` in each action to match your frame count
5. Add a `select.png` portrait image
6. Add your character id to `characters/index.json`

## Using the sprite splitter (if you have a mega sheet)

```bash
source .venv/bin/activate
python tools/split_sprites.py characters/your_id path/to/sheet.png [cols] [rows]
```

Default grid is 5x3 (15 frames). The script auto-updates character.json with the actions map.

## Testing

Open `sprite-test.html` in the browser to preview all frames and hitboxes.
