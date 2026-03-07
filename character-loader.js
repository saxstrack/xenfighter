const CharacterLoader = {
  async loadAll() {
    if (window.location.protocol === 'file:') {
      console.warn(
        'CharacterLoader: file:// protocol detected. ' +
        'fetch() may fail. Serve via HTTP (e.g. python -m http.server 8000).'
      );
    }

    const indexResp = await fetch('characters/index.json');
    const ids = await indexResp.json();
    const chars = new Map();

    await Promise.all(ids.map(async (id) => {
      const resp = await fetch(`characters/${id}/character.json`);
      const data = await resp.json();

      // Character-level spriteSheet
      if (data.spriteSheet) {
        data.spriteSheetImg = await loadImage(data.spriteSheet);
      }

      // Per-action sprite sheets (new format with per-action spriteSheet, or legacy strip format)
      data.actionImages = {};
      await Promise.all(Object.entries(data.actions).map(async ([action, info]) => {
        if (info.spriteSheet) {
          data.actionImages[action] = await loadImage(info.spriteSheet);
        } else if (info.sheet) {
          data.actionImages[action] = await loadImage(info.sheet);
        }
      }));

      // Preload portrait
      data.portraitImg = await loadImage(data.portrait);

      chars.set(id, data);
    }));

    return chars;
  }
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
