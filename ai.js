// --- AI Module (Behavior Tree) ---

const AI_DIFFICULTY = {
  easy:   { reactionDelay: 0.4, blockChance: 0.2, attackRate: 0.3, optimalRange: [100, 200] },
  medium: { reactionDelay: 0.2, blockChance: 0.5, attackRate: 0.5, optimalRange: [80, 180] },
  hard:   { reactionDelay: 0.05, blockChance: 0.8, attackRate: 0.7, optimalRange: [70, 160] },
};

// --- Behavior tree nodes ---

function Selector(children) {
  return (ctx) => {
    for (const child of children) {
      if (child(ctx)) return true;
    }
    return false;
  };
}

function Sequence(children) {
  return (ctx) => {
    for (const child of children) {
      if (!child(ctx)) return false;
    }
    return true;
  };
}

function Condition(fn) {
  return (ctx) => fn(ctx);
}

function Action(fn) {
  return (ctx) => { fn(ctx); return true; };
}

// --- Helpers ---

function distBetween(a, b) {
  return Math.abs((a.x + a.w / 2) - (b.x + b.w / 2));
}

function opponentIsAttacking(ctx) {
  return (ctx.opponent.action === 'punch' || ctx.opponent.action === 'kick') && ctx.opponent.actionTime > 0;
}

function opponentInRange(ctx, range) {
  return distBetween(ctx.player, ctx.opponent) < range;
}

function facingOpponent(ctx) {
  const p = ctx.player, o = ctx.opponent;
  return (o.x > p.x && p.facing === 1) || (o.x < p.x && p.facing === -1);
}

// --- Build the behavior tree ---

function buildAITree() {
  return Selector([
    // Defend: opponent attacking, in range, random < blockChance
    Sequence([
      Condition((ctx) => ctx.ai._seesAttack),
      Condition((ctx) => opponentInRange(ctx, 180)),
      Condition((ctx) => Math.random() < ctx.diff.blockChance),
      Action((ctx) => { ctx.keys.add(ctx.player.controls.block); }),
    ]),

    // Counter-attack: opponent just finished attack (in recovery), in attack range
    Sequence([
      Condition((ctx) => {
        const o = ctx.opponent;
        return o.attackCooldown > 0 && o.actionTime <= 0;
      }),
      Condition((ctx) => opponentInRange(ctx, ctx.diff.optimalRange[1])),
      Action((ctx) => {
        if (Math.random() < 0.5) {
          ctx.keys.add(ctx.player.controls.punch);
        } else {
          ctx.keys.add(ctx.player.controls.kick);
        }
      }),
    ]),

    // Attack: in range, cooldown ready, random < attackRate
    Sequence([
      Condition((ctx) => ctx.player.canAttack && ctx.player.attackCooldown <= 0),
      Condition((ctx) => opponentInRange(ctx, ctx.diff.optimalRange[1])),
      Condition((ctx) => Math.random() < ctx.diff.attackRate),
      Action((ctx) => {
        // Weighted: 60% punch, 40% kick
        if (Math.random() < 0.6) {
          ctx.keys.add(ctx.player.controls.punch);
        } else {
          ctx.keys.add(ctx.player.controls.kick);
        }
      }),
    ]),

    // Approach: too far from opponent
    Sequence([
      Condition((ctx) => distBetween(ctx.player, ctx.opponent) > ctx.diff.optimalRange[1]),
      Action((ctx) => {
        const p = ctx.player, o = ctx.opponent;
        if (o.x > p.x) {
          ctx.keys.add(p.controls.right);
        } else {
          ctx.keys.add(p.controls.left);
        }
        // Occasionally jump while approaching
        if (Math.random() < 0.01 && p.onGround) {
          ctx.keys.add(p.controls.jump);
        }
      }),
    ]),

    // Retreat: too close
    Sequence([
      Condition((ctx) => distBetween(ctx.player, ctx.opponent) < ctx.diff.optimalRange[0] * 0.6),
      Action((ctx) => {
        const p = ctx.player, o = ctx.opponent;
        if (o.x > p.x) {
          ctx.keys.add(p.controls.left);
        } else {
          ctx.keys.add(p.controls.right);
        }
      }),
    ]),

    // Idle: do nothing
    Action(() => {}),
  ]);
}

const aiTree = buildAITree();

// --- Main AI update ---

function updateAI(player, opponent, dt, keysSet) {
  const ai = player.ai;
  const diff = AI_DIFFICULTY[ai.difficulty] || AI_DIFFICULTY.medium;

  // Clear all AI player's control keys
  const controls = player.controls;
  for (const key of Object.values(controls)) {
    keysSet.delete(key);
  }

  // Reaction delay: track when we first see opponent attacking
  const oppAttacking = (opponent.action === 'punch' || opponent.action === 'kick') && opponent.actionTime > 0;
  if (oppAttacking && !ai._oppWasAttacking) {
    ai._reactionTimer = diff.reactionDelay;
  }
  ai._oppWasAttacking = oppAttacking;

  if (ai._reactionTimer > 0) {
    ai._reactionTimer -= dt;
  }
  ai._seesAttack = oppAttacking && ai._reactionTimer <= 0;

  // Evaluate behavior tree
  const ctx = { player, opponent, ai, diff, keys: keysSet };
  aiTree(ctx);
}

function createAIState(difficulty) {
  return {
    difficulty: difficulty || 'medium',
    _oppWasAttacking: false,
    _reactionTimer: 0,
    _seesAttack: false,
  };
}
