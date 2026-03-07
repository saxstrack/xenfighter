const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function test() {
  let errors = 0;
  function ok(msg) { console.log('  OK: ' + msg); }
  function fail(msg) { console.error('  FAIL: ' + msg); errors++; }

  console.log('=== Character Plugin System Tests ===\n');

  // 1. index.json
  console.log('[1] index.json');
  const idx = await fetch('http://localhost:8000/characters/index.json');
  const ids = JSON.parse(idx.data);
  if (ids.length >= 2) ok('Found ' + ids.length + ' characters: ' + ids.join(', '));
  else fail('Expected at least 2 characters, got ' + ids.length);

  // 2. Each character.json
  for (const id of ids) {
    console.log('\n[2] characters/' + id + '/character.json');
    const resp = await fetch('http://localhost:8000/characters/' + id + '/character.json');
    if (resp.status !== 200) { fail('HTTP ' + resp.status); continue; }
    const char = JSON.parse(resp.data);

    const required = ['id', 'name', 'description', 'portrait', 'stats', 'taunts', 'actions'];
    const missing = required.filter(k => !(k in char));
    if (missing.length) fail('missing keys: ' + missing.join(', '));
    else ok('all required keys present');

    // No legacy keys
    if ('legacy_sheet' in char) fail('legacy_sheet still present');
    if ('frames' in char) fail('frames still present');

    // Stats
    const statKeys = ['speed', 'jumpForce', 'punchDamage', 'punchRange', 'punchDuration', 'kickDamage', 'kickRange', 'kickDuration'];
    const missingStat = statKeys.filter(k => !(k in char.stats));
    if (missingStat.length) fail('stats missing: ' + missingStat.join(', '));
    else ok('stats complete: speed=' + char.stats.speed + ' punchDmg=' + char.stats.punchDamage + ' kickDmg=' + char.stats.kickDamage);

    // Actions
    const actionKeys = ['idle', 'block', 'punch', 'kick', 'taunt', 'jump', 'hit', 'duck', 'win'];
    const missingAction = actionKeys.filter(k => !(k in char.actions));
    if (missingAction.length) fail('actions missing: ' + missingAction.join(', '));
    else ok('all 9 actions present');

    // Sprite sheets accessible
    let sheetOk = true;
    for (const [action, info] of Object.entries(char.actions)) {
      const imgResp = await fetch('http://localhost:8000/' + info.sheet);
      if (imgResp.status !== 200) { fail(action + ' sheet 404: ' + info.sheet); sheetOk = false; }
    }
    if (sheetOk) ok('all sprite sheets accessible');

    // Portrait accessible
    const portrait = await fetch('http://localhost:8000/' + char.portrait);
    if (portrait.status === 200) ok('portrait accessible');
    else fail('portrait 404: ' + char.portrait);

    // Taunts
    if (char.taunts.idle && char.taunts.idle.length > 0 && char.taunts.intro && char.taunts.intro.length > 0)
      ok('taunts: ' + char.taunts.idle.length + ' idle, ' + char.taunts.intro.length + ' intro');
    else fail('taunts incomplete');
  }

  // 3. Differentiated stats
  console.log('\n[3] Stats differentiation');
  const lasse = JSON.parse((await fetch('http://localhost:8000/characters/lasse/character.json')).data);
  const al = JSON.parse((await fetch('http://localhost:8000/characters/al/character.json')).data);
  if (lasse.stats.speed !== al.stats.speed) ok('speed differs (lasse=' + lasse.stats.speed + ' al=' + al.stats.speed + ')');
  else fail('speed identical');
  if (lasse.stats.punchDamage !== al.stats.punchDamage) ok('punchDamage differs');
  else fail('punchDamage identical');
  if (lasse.stats.kickDamage !== al.stats.kickDamage) ok('kickDamage differs');
  else fail('kickDamage identical');

  // 4. index.html
  console.log('\n[4] index.html');
  const html = (await fetch('http://localhost:8000/index.html')).data;
  if (html.includes('character-loader.js')) ok('character-loader.js script tag found');
  else fail('character-loader.js not referenced');
  if (html.includes('id="p1-select"') && html.includes('id="p2-select"')) ok('dynamic select containers present');
  else fail('p1-select/p2-select containers missing');
  if (!html.includes('data-char="rook"') && !html.includes('data-char="voss"')) ok('no hardcoded character cards');
  else fail('hardcoded character cards still present');

  // 5. game.js
  console.log('\n[5] game.js — no hardcoded refs');
  const gameJs = (await fetch('http://localhost:8000/game.js')).data;
  const banned = ['CHARACTERS[', 'FRAMES[', 'TAUNTS[', 'INTRO_TAUNTS[', 'const COLS', 'const ROWS', "'rook'", "'voss'", 'useLegacy', 'legacy_sheet', '.spriteImg'];
  let gameclean = true;
  for (const term of banned) {
    if (gameJs.includes(term)) { fail('game.js contains "' + term + '"'); gameclean = false; }
  }
  if (gameclean) ok('no hardcoded character references');
  if (gameJs.includes('CharacterLoader.loadAll')) ok('uses CharacterLoader.loadAll()');
  else fail('does not call CharacterLoader.loadAll()');
  if (gameJs.includes('buildSelectScreen')) ok('has buildSelectScreen()');
  else fail('missing buildSelectScreen()');
  if (gameJs.includes('actionFrameForPlayer')) ok('has actionFrameForPlayer() (per-action rendering)');
  else fail('missing actionFrameForPlayer()');

  // 6. character-loader.js
  console.log('\n[6] character-loader.js');
  const loader = (await fetch('http://localhost:8000/character-loader.js')).data;
  if (loader.includes('actionImages')) ok('preloads action images');
  else fail('does not preload action images');
  if (!loader.includes('legacy_sheet') && !loader.includes('useLegacy') && !loader.includes('spriteImg'))
    ok('no legacy code');
  else fail('still has legacy code');

  // 7. sprite-test.html
  console.log('\n[7] sprite-test.html');
  const spriteTest = await fetch('http://localhost:8000/sprite-test.html');
  if (spriteTest.status === 200) ok('loads (HTTP 200)');
  else fail('HTTP ' + spriteTest.status);

  // Summary
  console.log('\n=== Results: ' + (errors === 0 ? 'ALL PASSED' : errors + ' FAILURE(S)') + ' ===');
  process.exit(errors > 0 ? 1 : 0);
}

test().catch(e => { console.error('Test crashed:', e); process.exit(1); });
