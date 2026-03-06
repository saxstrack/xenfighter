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
const BUILD = 'build-2026-03-02-0745';

const CHARACTERS = {
  rook: { name: 'Lasse', sprite: new Image() },
  voss: { name: 'Al', sprite: new Image() },
};
CHARACTERS.rook.sprite.src = 'assets/fighter-poses.png';
CHARACTERS.voss.sprite.src = 'assets/fighter-poses2.png';

const STAGES = [
  { name: 'Demo Lab', src: 'assets/demolab.jpg' },
  { name: 'Arcade Street', src: 'assets/unnamed.jpg' },
];
const stageBgs = STAGES.map(s => { const img = new Image(); img.src = s.src; return img; });

const p1Selection = { char: 'rook' };
const p2Selection = { char: 'voss' };
let selectedStage = 0;

const COLS = 5;
const ROWS = 3;

const FRAMES = {
  idle: [0, 1],
  block: [2],
  punch: [3, 4, 5],
  kick: [6, 7, 8, 9],
  taunt: [10],
  jump: [11],
  hit: [12],
  duck: [13],
  win: [14],
};

const P1_KEYS = { left: 'a', right: 'd', jump: 'w', block: 's', punch: 'f', kick: 'g' };
const P2_KEYS = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', block: 'ArrowDown', punch: 'k', kick: 'l' };

const TAUNTS = {
  rook: [
    "You scared?",
    "Come on!",
    "Too slow!",
    "Is that all?",
    "Fight me already!",
    "I could do this all day.",
    "My grandma hits harder.",
    "Quit stalling!",
    "You call that fighting?",
    "Bring it!",
  ],
  voss: [
    "Pathetic.",
    "Not worth my time.",
    "You bore me.",
    "This is too easy.",
    "I expected more.",
    "Kneel.",
    "You're already done?",
    "Weakness disgusts me.",
    "Step up or step out.",
    "I'll end this quick.",
  ],
};

const state = {
  running: false,
  time: 99,
  lastTime: 0,
  timerAcc: 0,
  keys: new Set(),
  players: [],
};


function makePlayer(x, controls, charId) {
  return {
    x,
    y: H - 145,
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


function resetMatch() {
  state.running = true;
  state.time = 99;
  state.timerAcc = 0;
  state.lastTime = performance.now();
  state.players = [
    makePlayer(220, P1_KEYS, p1Selection.char),
    makePlayer(740, P2_KEYS, p2Selection.char),
  ];
  document.getElementById('p1-name').textContent = 'P1 ' + CHARACTERS[p1Selection.char].name;
  document.getElementById('p2-name').textContent = 'P2 ' + CHARACTERS[p2Selection.char].name;
  updateHud();
  resultEl.classList.add('hidden');
  rematchBtn.classList.add('hidden');
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

  let moving = false;
  p.isBlocking = state.keys.has(p.controls.block) && p.onGround;

  if (p.isBlocking) {
    p.vx = 0;
    p.action = 'block';
  } else {
    const speed = 260;
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
      p.vy = -540;
      p.onGround = false;
      p.action = 'jump';
    }

    if (p.canAttack && state.keys.has(p.controls.punch)) {
      p.action = 'punch';
      p.actionTime = 0.22;
      p.canAttack = false;
    } else if (p.canAttack && state.keys.has(p.controls.kick)) {
      p.action = 'kick';
      p.actionTime = 0.30;
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
      const charTaunts = TAUNTS[p.charId];
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

  const range = attacker.action === 'punch' ? 52 : 72;
  const hitbox = {
    x: attacker.facing === 1 ? attacker.x + attacker.w - 8 : attacker.x - range + 8,
    y: attacker.y + 20,
    w: range,
    h: attacker.h - 28,
  };

  if (!intersects(hitbox, defender)) return;

  let dmg = attacker.action === 'punch' ? 10 : 14;
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

function frameForPlayer(p, t) {
  if (!state.running && p.won) return FRAMES.win[0];
  if (!p.onGround) return FRAMES.jump[0];

  switch (p.action) {
    case 'block': return FRAMES.block[0];
    case 'punch': {
      const idx = Math.floor((0.22 - p.actionTime) / 0.075);
      return FRAMES.punch[Math.max(0, Math.min(FRAMES.punch.length - 1, idx))];
    }
    case 'kick': {
      const idx = Math.floor((0.30 - p.actionTime) / 0.075);
      return FRAMES.kick[Math.max(0, Math.min(FRAMES.kick.length - 1, idx))];
    }
    case 'hit': return FRAMES.hit[0];
    default:
      return FRAMES.idle[Math.floor((t / 260) % FRAMES.idle.length)];
  }
}

function drawFighter(p, t) {
  const src = CHARACTERS[p.charId].sprite;
  if (!src.complete) return;

  const frame = frameForPlayer(p, t);
  const cellW = src.width / COLS;
  const cellH = src.height / ROWS;
  const sx = (frame % COLS) * cellW;
  const sy = Math.floor(frame / COLS) * cellH;

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

  // Clamp to canvas
  const cx = Math.max(4, Math.min(W - bw - 4, bx));

  // Bubble
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx, by, bw, bh, 8);
  ctx.fill();
  ctx.stroke();

  // Tail
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

  // Cover the tail's top edge where it meets the bubble
  ctx.fillStyle = '#fff';
  ctx.fillRect(tailX - tailSize + 1, by + bh - 1, tailSize * 2 - 2, 3);

  // Text
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.tauntMsg, cx + bw / 2, by + bh / 2);
  ctx.restore();
}

function render(t) {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  for (const p of state.players) drawFighter(p, t);
  for (const p of state.players) drawTauntBubble(p);

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

  if (state.running) {
    simulate(dt);
    render(now);
    requestAnimationFrame(loop);
  } else {
    render(now);
  }
}

window.addEventListener('keydown', (e) => state.keys.add(e.key));
window.addEventListener('keyup', (e) => state.keys.delete(e.key));

document.querySelectorAll('.stage-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.stage-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedStage = parseInt(card.dataset.stage);
  });
});

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

startBtn.addEventListener('click', startGame);
rematchBtn.addEventListener('click', resetMatch);
