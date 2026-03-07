const selectScreen = document.getElementById('character-select');
const fightScreen = document.getElementById('fight-screen');
const startBtn = document.getElementById('start-btn');
const rematchBtn = document.getElementById('rematch-btn');
const resultEl = document.getElementById('result');
const p1HealthEl = document.getElementById('p1-health');
const p2HealthEl = document.getElementById('p2-health');
const timerEl = document.getElementById('timer');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const BUILD = 'build-2026-03-07-plugin';

let CHAR_DATA = new Map();

const STAGES = [
  { name: 'Demo Lab', src: 'assets/demolab.jpg' },
  { name: 'Arcade Street', src: 'assets/unnamed.jpg' },
];
const stageBgs = STAGES.map(s => { const img = new Image(); img.src = s.src; return img; });

const p1Selection = { char: null };
const p2Selection = { char: null };
let selectedStage = 0;

const P1_KEYS = { left: 'a', right: 'd', jump: 'w', block: 's', punch: 'f', kick: 'g' };
const P2_KEYS = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', block: 'ArrowDown', punch: 'k', kick: 'l' };

const state = {
  running: false,
  time: 99,
  lastTime: 0,
  timerAcc: 0,
  keys: new Set(),
  players: [],
  intro: null,
};

function getChar(id) {
  return CHAR_DATA.get(id);
}

function makePlayer(x, controls, charId) {
  return {
    x,
    y: H - 20 - 240,
    vx: 0,
    vy: 0,
    w: 160,
    h: 240,
    controls,
    charId,
    hp: 100,
    onGround: true,
    facing: 1,
    action: 'idle',
    actionTime: 0,
    canAttack: true,
    hitCooldown: 0,
    isBlocking: false,
    won: false,
    idleTime: 0,
    tauntMsg: null,
    tauntTimer: 0,
  };
}

// Intro phases: zoomP1 (1s) -> tauntP1 (2s) -> zoomP2 (1s) -> tauntP2 (2s) -> zoomOut (1s)
const INTRO_PHASES = [
  { name: 'zoomP1',  duration: 1.0 },
  { name: 'tauntP1', duration: 2.0 },
  { name: 'zoomP2',  duration: 1.0 },
  { name: 'tauntP2', duration: 2.0 },
  { name: 'zoomOut', duration: 1.0 },
];

function startIntro() {
  const p1Char = getChar(p1Selection.char);
  const p2Char = getChar(p2Selection.char);
  const p1Taunts = p1Char.taunts.intro;
  const p2Taunts = p2Char.taunts.intro;
  state.intro = {
    phase: 0,
    elapsed: 0,
    p1Taunt: p1Taunts[Math.floor(Math.random() * p1Taunts.length)],
    p2Taunt: p2Taunts[Math.floor(Math.random() * p2Taunts.length)],
  };
}

function resetMatch() {
  state.running = false;
  state.time = 99;
  state.timerAcc = 0;
  state.lastTime = performance.now();
  state.players = [
    makePlayer(220, P1_KEYS, p1Selection.char),
    makePlayer(740, P2_KEYS, p2Selection.char),
  ];
  state.players[0].facing = 1;
  state.players[1].facing = -1;
  document.getElementById('p1-name').textContent = 'P1 ' + getChar(p1Selection.char).name;
  document.getElementById('p2-name').textContent = 'P2 ' + getChar(p2Selection.char).name;
  updateHud();
  resultEl.classList.add('hidden');
  rematchBtn.classList.add('hidden');
  startIntro();
  requestAnimationFrame(loop);
}

function startGame() {
  selectScreen.classList.remove('active');
  fightScreen.classList.add('active');
  resetMatch();
}

function endMatch(text, winnerIndex = null) {
  state.running = false;
  if (winnerIndex !== null) state.players[winnerIndex].won = true;
  resultEl.textContent = text;
  resultEl.classList.remove('hidden');
  rematchBtn.classList.remove('hidden');
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function processInput(p, dt) {
  if (!state.running) return;

  const charData = getChar(p.charId);
  const stats = charData.stats;
  let moving = false;
  p.isBlocking = state.keys.has(p.controls.block) && p.onGround;

  if (p.isBlocking) {
    p.vx = 0;
    p.action = 'block';
  } else {
    const speed = stats.speed;
    if (state.keys.has(p.controls.left)) {
      p.vx = -speed;
      moving = true;
    } else if (state.keys.has(p.controls.right)) {
      p.vx = speed;
      moving = true;
    } else {
      p.vx = 0;
    }

    if (state.keys.has(p.controls.jump) && p.onGround) {
      p.vy = -stats.jumpForce;
      p.onGround = false;
      p.action = 'jump';
    }

    if (p.canAttack && state.keys.has(p.controls.punch)) {
      p.action = 'punch';
      p.actionTime = stats.punchDuration;
      p.canAttack = false;
    } else if (p.canAttack && state.keys.has(p.controls.kick)) {
      p.action = 'kick';
      p.actionTime = stats.kickDuration;
      p.canAttack = false;
    } else if (p.onGround && p.actionTime <= 0) {
      p.action = moving ? 'idle' : 'idle';
    }
  }

  if (!state.keys.has(p.controls.punch) && !state.keys.has(p.controls.kick) && p.actionTime <= 0) {
    p.canAttack = true;
  }

  p.actionTime = Math.max(0, p.actionTime - dt);
  p.hitCooldown = Math.max(0, p.hitCooldown - dt);

  const isStill = p.action === 'idle' && p.vx === 0 && p.onGround;
  if (isStill) {
    p.idleTime += dt;
    if (p.idleTime >= 3 && !p.tauntMsg) {
      const charTaunts = charData.taunts.idle;
      p.tauntMsg = charTaunts[Math.floor(Math.random() * charTaunts.length)];
      p.tauntTimer = 3;
    }
  } else {
    p.idleTime = 0;
    p.tauntMsg = null;
    p.tauntTimer = 0;
  }

  if (p.tauntTimer > 0) {
    p.tauntTimer -= dt;
    if (p.tauntTimer <= 0) {
      p.tauntMsg = null;
      p.tauntTimer = 0;
      p.idleTime = 0;
    }
  }
}

function simulate(dt) {
  const [p1, p2] = state.players;

  processInput(p1, dt);
  processInput(p2, dt);

  for (const p of state.players) {
    p.vy += 1300 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y + p.h >= H - 20) {
      p.y = H - 20 - p.h;
      p.vy = 0;
      p.onGround = true;
    }

    p.x = Math.max(20, Math.min(W - p.w - 20, p.x));
  }

  if (p1.x < p2.x) {
    p1.facing = 1;
    p2.facing = -1;
  } else {
    p1.facing = -1;
    p2.facing = 1;
  }

  handleHit(p1, p2);
  handleHit(p2, p1);

  state.timerAcc += dt;
  if (state.timerAcc >= 1) {
    state.time -= 1;
    state.timerAcc = 0;
  }

  if (p1.hp <= 0 || p2.hp <= 0 || state.time <= 0) {
    if (p1.hp === p2.hp) {
      endMatch('Draw!');
    } else if (p1.hp > p2.hp) {
      endMatch('Player 1 Wins!', 0);
    } else {
      endMatch('Player 2 Wins!', 1);
    }
  }

  updateHud();
}

function handleHit(attacker, defender) {
  if (attacker.action !== 'punch' && attacker.action !== 'kick') return;
  if (attacker.actionTime <= 0.10) return;
  if (defender.hitCooldown > 0) return;

  const stats = getChar(attacker.charId).stats;
  const range = attacker.action === 'punch' ? stats.punchRange : stats.kickRange;
  const hitbox = {
    x: attacker.facing === 1 ? attacker.x + attacker.w - 8 : attacker.x - range + 8,
    y: attacker.y + 20,
    w: range,
    h: attacker.h - 28,
  };

  if (!intersects(hitbox, defender)) return;

  let dmg = attacker.action === 'punch' ? stats.punchDamage : stats.kickDamage;
  if (defender.isBlocking) dmg = Math.ceil(dmg * 0.35);

  defender.hp = Math.max(0, defender.hp - dmg);
  defender.hitCooldown = 0.28;
  if (!defender.isBlocking) {
    defender.action = 'hit';
    defender.actionTime = 0.18;
    defender.vx += attacker.facing * 120;
  }
}

function drawBackground() {
  const bg = stageBgs[selectedStage];
  if (bg && bg.complete) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
  }
}

function actionFrameForPlayer(p, t) {
  const charData = getChar(p.charId);
  const stats = charData.stats;

  if (!state.running && p.won) return { action: 'win', index: 0 };
  if (!p.onGround) return { action: 'jump', index: 0 };

  switch (p.action) {
    case 'block': return { action: 'block', index: 0 };
    case 'punch': {
      const count = charData.actions.punch.cols;
      const idx = Math.floor((stats.punchDuration - p.actionTime) / 0.075);
      return { action: 'punch', index: Math.max(0, Math.min(count - 1, idx)) };
    }
    case 'kick': {
      const count = charData.actions.kick.cols;
      const idx = Math.floor((stats.kickDuration - p.actionTime) / 0.075);
      return { action: 'kick', index: Math.max(0, Math.min(count - 1, idx)) };
    }
    case 'hit': return { action: 'hit', index: 0 };
    default: {
      const count = charData.actions.idle.cols;
      return { action: 'idle', index: Math.floor((t / 260) % count) };
    }
  }
}

function drawFighter(p, t) {
  const charData = getChar(p.charId);
  const af = actionFrameForPlayer(p, t);

  const actionInfo = charData.actions[af.action];
  const src = charData.actionImages[af.action];
  if (!src || !src.complete) return;
  const cellW = src.width / actionInfo.cols;
  const cellH = src.height / actionInfo.rows;
  const sx = af.index * cellW;
  const sy = 0;

  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  ctx.scale(p.facing, 1);

  ctx.drawImage(
    src,
    sx, sy, cellW, cellH,
    -p.w / 2,
    -p.h / 2,
    p.w,
    p.h
  );

  ctx.restore();
}

function drawTauntBubble(p) {
  if (!p.tauntMsg) return;

  ctx.save();
  ctx.font = 'bold 14px Inter, system-ui, sans-serif';
  const padding = 10;
  const textW = ctx.measureText(p.tauntMsg).width;
  const bw = textW + padding * 2;
  const bh = 28;
  const bx = p.x + p.w / 2 - bw / 2;
  const by = p.y - 40;
  const tailSize = 6;

  const cx = Math.max(4, Math.min(W - bw - 4, bx));

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  const tailX = p.x + p.w / 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(tailX - tailSize, by + bh);
  ctx.lineTo(tailX + tailSize, by + bh);
  ctx.lineTo(tailX, by + bh + tailSize);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(tailX - tailSize, by + bh);
  ctx.lineTo(tailX, by + bh + tailSize);
  ctx.lineTo(tailX + tailSize, by + bh);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.fillRect(tailX - tailSize + 1, by + bh - 1, tailSize * 2 - 2, 3);

  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.tauntMsg, cx + bw / 2, by + bh / 2);
  ctx.restore();
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function getIntroCamera() {
  const intro = state.intro;
  if (!intro) return { x: 0, y: 0, scale: 1 };

  const phase = INTRO_PHASES[intro.phase];
  const t = Math.min(1, intro.elapsed / phase.duration);
  const et = easeInOut(t);

  const [p1, p2] = state.players;
  const p1cx = p1.x + p1.w / 2, p1cy = p1.y + p1.h * 0.45;
  const p2cx = p2.x + p2.w / 2, p2cy = p2.y + p2.h * 0.45;
  const zoomScale = 1.6;

  switch (phase.name) {
    case 'zoomP1':
      return {
        x: lerp(0, W / 2 - p1cx * zoomScale, et),
        y: lerp(0, H / 2 - p1cy * zoomScale, et),
        scale: lerp(1, zoomScale, et),
      };
    case 'tauntP1':
      return {
        x: W / 2 - p1cx * zoomScale,
        y: H / 2 - p1cy * zoomScale,
        scale: zoomScale,
      };
    case 'zoomP2':
      return {
        x: lerp(W / 2 - p1cx * zoomScale, W / 2 - p2cx * zoomScale, et),
        y: lerp(H / 2 - p1cy * zoomScale, H / 2 - p2cy * zoomScale, et),
        scale: zoomScale,
      };
    case 'tauntP2':
      return {
        x: W / 2 - p2cx * zoomScale,
        y: H / 2 - p2cy * zoomScale,
        scale: zoomScale,
      };
    case 'zoomOut':
      return {
        x: lerp(W / 2 - p2cx * zoomScale, 0, et),
        y: lerp(H / 2 - p2cy * zoomScale, 0, et),
        scale: lerp(zoomScale, 1, et),
      };
    default:
      return { x: 0, y: 0, scale: 1 };
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

function getIntroTaunt() {
  const intro = state.intro;
  if (!intro) return null;
  const phase = INTRO_PHASES[intro.phase];
  if (phase.name === 'tauntP1') return { player: 0, msg: intro.p1Taunt };
  if (phase.name === 'tauntP2') return { player: 1, msg: intro.p2Taunt };
  return null;
}

function drawIntroBubble(p, msg) {
  ctx.save();
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  const padding = 14;
  const textW = ctx.measureText(msg).width;
  const bw = textW + padding * 2;
  const bh = 34;
  const bx = p.x + p.w / 2 - bw / 2;
  const by = p.y - 50;
  const tailSize = 8;

  const cx = Math.max(4, Math.min(W - bw - 4, bx));

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx, by, bw, bh, 10);
  ctx.fill();
  ctx.stroke();

  const tailX = p.x + p.w / 2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(tailX - tailSize, by + bh);
  ctx.lineTo(tailX + tailSize, by + bh);
  ctx.lineTo(tailX, by + bh + tailSize);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(tailX - tailSize, by + bh);
  ctx.lineTo(tailX, by + bh + tailSize);
  ctx.lineTo(tailX + tailSize, by + bh);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.fillRect(tailX - tailSize + 1, by + bh - 1, tailSize * 2 - 2, 3);

  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, cx + bw / 2, by + bh / 2);
  ctx.restore();
}

function render(t) {
  ctx.clearRect(0, 0, W, H);

  const cam = getIntroCamera();
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.scale, cam.scale);

  drawBackground();
  for (const p of state.players) drawFighter(p, t);

  const introTaunt = getIntroTaunt();
  if (introTaunt) {
    const ip = state.players[introTaunt.player];
    drawIntroBubble(ip, introTaunt.msg);
    ctx.save();
    ctx.font = 'bold 18px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const nameX = ip.x + ip.w / 2;
    const nameY = ip.y + ip.h + 8;
    const name = getChar(ip.charId).name;
    ctx.strokeText(name, nameX, nameY);
    ctx.fillText(name, nameX, nameY);
    ctx.restore();
  }

  if (state.running) {
    for (const p of state.players) drawTauntBubble(p);
  }

  ctx.restore();

  if (state.intro && INTRO_PHASES[state.intro.phase].name === 'zoomOut') {
    const ft = Math.min(1, state.intro.elapsed / INTRO_PHASES[state.intro.phase].duration);
    ctx.save();
    ctx.globalAlpha = 1 - ft;
    ctx.font = 'bold 64px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#e53935';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('FIGHT!', W / 2, H / 2);
    ctx.fillText('FIGHT!', W / 2, H / 2);
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '12px monospace';
  ctx.fillText(BUILD, 10, 16);
}

function updateHud() {
  const [p1, p2] = state.players;
  p1HealthEl.style.width = `${p1.hp}%`;
  p2HealthEl.style.width = `${p2.hp}%`;
  timerEl.textContent = `${Math.max(0, state.time)}`;
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.lastTime) / 1000);
  state.lastTime = now;

  if (state.intro) {
    state.intro.elapsed += dt;
    const phase = INTRO_PHASES[state.intro.phase];
    if (state.intro.elapsed >= phase.duration) {
      state.intro.elapsed = 0;
      state.intro.phase++;
      if (state.intro.phase >= INTRO_PHASES.length) {
        state.intro = null;
        state.running = true;
        state.lastTime = now;
      }
    }
    render(now);
    requestAnimationFrame(loop);
  } else if (state.running) {
    simulate(dt);
    render(now);
    requestAnimationFrame(loop);
  } else {
    render(now);
  }
}

window.addEventListener('keydown', (e) => state.keys.add(e.key));
window.addEventListener('keyup', (e) => state.keys.delete(e.key));

function buildSelectScreen() {
  const p1Container = document.getElementById('p1-select');
  const p2Container = document.getElementById('p2-select');
  p1Container.innerHTML = '';
  p2Container.innerHTML = '';

  const ids = Array.from(CHAR_DATA.keys());

  ids.forEach((id, i) => {
    const char = CHAR_DATA.get(id);

    // P1 card
    const card1 = document.createElement('div');
    card1.className = 'select-card' + (i === 0 ? ' selected' : '');
    card1.dataset.player = '1';
    card1.dataset.char = id;
    card1.innerHTML = `<img src="${char.portrait}" alt="${char.name}" /><h2>${char.name}</h2><p>${char.description}</p>`;
    p1Container.appendChild(card1);

    // P2 card
    const card2 = document.createElement('div');
    card2.className = 'select-card' + (i === ids.length - 1 ? ' selected' : '');
    card2.dataset.player = '2';
    card2.dataset.char = id;
    card2.innerHTML = `<img src="${char.portrait}" alt="${char.name}" /><h2>${char.name}</h2><p>${char.description}</p>`;
    p2Container.appendChild(card2);
  });

  // Set default selections
  p1Selection.char = ids[0];
  p2Selection.char = ids[ids.length - 1];

  // Attach click handlers
  document.querySelectorAll('.select-card[data-player]').forEach(card => {
    card.addEventListener('click', () => {
      const player = card.dataset.player;
      const char = card.dataset.char;
      const col = card.closest('.select-col');
      col.querySelectorAll('.select-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      if (player === '1') p1Selection.char = char;
      else p2Selection.char = char;
    });
  });
}

document.querySelectorAll('.stage-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.stage-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedStage = parseInt(card.dataset.stage);
  });
});

startBtn.addEventListener('click', startGame);
rematchBtn.addEventListener('click', resetMatch);

async function init() {
  try {
    CHAR_DATA = await CharacterLoader.loadAll();
    buildSelectScreen();
  } catch (err) {
    console.error('Failed to load characters:', err);
    document.getElementById('p1-select').innerHTML = '<p style="color:red">Failed to load characters. Are you serving via HTTP?</p>';
  }
}

init();
