/**
 * LLM-Fighter Combat Engine v2
 * Pure game logic - no rendering, no DOM, no Canvas
 * Deterministic state machine for 2D fighting game mechanics
 *
 * v2: High/low attack system, dodge/crouch/jump, uppercut/sweep,
 *     combo counter, stagger/stun, critical hits
 */

class GameEngine {
  static VALID_ACTIONS = [
    'high_punch', 'low_punch', 'high_kick', 'low_kick',
    'block', 'move_forward', 'move_back', 'idle',
    'dodge', 'crouch', 'jump', 'uppercut', 'sweep',
    'super_attack'
  ];

  constructor() {
    this.gameState = this.createInitialState();
    this.moveData = this.initializeMoveData();
  }

  createInitialState() {
    return {
      phase: 'select',
      round: 1,
      timer: 99,
      hitstopFrames: 0,
      roundWins: { p1: 0, p2: 0 },
      players: {
        p1: this._defaultPlayer(150, 'right'),
        p2: this._defaultPlayer(650, 'left')
      },
      events: [],
      lastActions: { p1: 'idle', p2: 'idle' }
    };
  }

  _defaultPlayer(x, facing) {
    return {
      model: '',
      health: 100,
      x,
      y: 0,
      state: 'idle',
      facing,
      framesSinceAction: 0,
      comboCount: 0,
      isStaggered: false,
      lastHitHeight: null,
      superMeter: 0
    };
  }

  initializeMoveData() {
    return {
      high_punch:   { damage: 8,  range: 80,  startup: 2, duration: 3, height: 'high' },
      low_punch:    { damage: 6,  range: 70,  startup: 1, duration: 2, height: 'low'  },
      high_kick:    { damage: 12, range: 100, startup: 4, duration: 5, height: 'high' },
      low_kick:     { damage: 10, range: 90,  startup: 3, duration: 4, height: 'low'  },
      uppercut:     { damage: 18, range: 70,  startup: 5, duration: 6, height: 'high' },
      sweep:        { damage: 14, range: 95,  startup: 4, duration: 5, height: 'low'  },
      block:        { damage: 0,  range: 0,   startup: 0, duration: 1 },
      move_forward: { damage: 0,  range: 0,   startup: 0, duration: 1 },
      move_back:    { damage: 0,  range: 0,   startup: 0, duration: 1 },
      idle:         { damage: 0,  range: 0,   startup: 0, duration: 1 },
      dodge:        { damage: 0,  range: 0,   startup: 0, duration: 2 },
      crouch:       { damage: 0,  range: 0,   startup: 0, duration: 1 },
      jump:         { damage: 0,  range: 0,   startup: 1, duration: 3 },
      super_attack: { damage: 30, range: 100, startup: 6, duration: 8, height: 'high' }
    };
  }

  reset() {
    this.gameState = this.createInitialState();
  }

  setModels(model1Id, model2Id) {
    this.gameState.players.p1.model = model1Id;
    this.gameState.players.p2.model = model2Id;
  }

  startRound(roundNumber) {
    const gs = this.gameState;
    gs.round = roundNumber;
    gs.timer = 99;
    gs.phase = 'fighting';
    gs.events = ['round_start'];
    gs.lastActions = { p1: 'idle', p2: 'idle' };
    gs.hitstopFrames = 0;

    for (const key of ['p1', 'p2']) {
      const p = gs.players[key];
      p.health = 100;
      p.x = key === 'p1' ? 150 : 650;
      p.y = 0;
      p.state = 'idle';
      p.framesSinceAction = 0;
      p.comboCount = 0;
      p.isStaggered = false;
      p.lastHitHeight = null;
      // superMeter intentionally NOT reset — carries across rounds
    }
  }

  // ── Main tick ──────────────────────────────────────────────

  executeTick(p1Action, p2Action) {
    // Hitstop freeze — both fighters pause on impact
    if (this.gameState.hitstopFrames > 0) {
      this.gameState.hitstopFrames--;
      return this.gameState;
    }

    this.gameState.events = [];
    this.gameState.lastActions.p1 = p1Action;
    this.gameState.lastActions.p2 = p2Action;

    if (this.gameState.phase !== 'fighting') {
      return this.gameState;
    }

    const p1 = this.gameState.players.p1;
    const p2 = this.gameState.players.p2;

    // Validate super_attack has enough meter before processing
    if (p1Action === 'super_attack' && p1.superMeter < 100) {
      p1Action = 'idle';
      this.gameState.lastActions.p1 = 'idle';
    }
    if (p2Action === 'super_attack' && p2.superMeter < 100) {
      p2Action = 'idle';
      this.gameState.lastActions.p2 = 'idle';
    }

    // Enforce stagger restrictions (consumes the stagger)
    p1Action = this._enforceStagger(p1, p1Action, 'p1');
    p2Action = this._enforceStagger(p2, p2Action, 'p2');

    p1.framesSinceAction++;
    p2.framesSinceAction++;

    // Movement (including dodge sidestep)
    this.processMovement(p1, p1Action, 'p1');
    this.processMovement(p2, p2Action, 'p2');

    // Vertical position for jump
    p1.y = p1Action === 'jump' ? 100 : 0;
    p2.y = p2Action === 'jump' ? 100 : 0;

    const distance = Math.abs(p1.x - p2.x);

    // Resolve attacks
    let p1Hit = false;
    let p2Hit = false;

    if (this.isAttack(p1Action)) {
      const result = this.processAttack(p1, p2, p1Action, distance, p2Action);
      p1Hit = result.hit;
      if (result.whiffed) this.gameState.events.push('p1_whiff');
    }

    if (this.isAttack(p2Action)) {
      const result = this.processAttack(p2, p1, p2Action, distance, p1Action);
      p2Hit = result.hit;
      if (result.whiffed) this.gameState.events.push('p2_whiff');
    }

    if (p1Hit && p2Hit) this.gameState.events.push('trade');

    this.updatePlayerState(p1, p1Action, p2Hit);
    this.updatePlayerState(p2, p2Action, p1Hit);

    this.checkRoundEnd();
    return this.gameState;
  }

  // ── Stagger enforcement ────────────────────────────────────

  _enforceStagger(player, action, playerId) {
    if (!player.isStaggered) return action;

    // Staggered fighters can only block or dodge
    if (action !== 'block' && action !== 'dodge') {
      action = 'idle';
    }
    player.isStaggered = false;
    this.gameState.events.push(`${playerId}_stagger_recover`);
    return action;
  }

  // ── Movement ───────────────────────────────────────────────

  processMovement(player, action, playerId) {
    if (action === 'move_forward') {
      const dir = player.facing === 'right' ? 1 : -1;
      player.x += 30 * dir;
    } else if (action === 'move_back') {
      const dir = player.facing === 'right' ? -1 : 1;
      player.x += 20 * dir;
    } else if (action === 'dodge') {
      // Dodge sidesteps backward — costs positioning
      const dir = player.facing === 'right' ? -1 : 1;
      player.x += 40 * dir;
    }

    player.x = Math.max(0, Math.min(800, player.x));

    // Minimum separation
    const p1 = this.gameState.players.p1;
    const p2 = this.gameState.players.p2;
    const minDistance = 50;

    if (Math.abs(p1.x - p2.x) < minDistance) {
      if (playerId === 'p1') {
        p1.x = p1.x < p2.x ? p2.x - minDistance : p2.x + minDistance;
      } else {
        p2.x = p2.x < p1.x ? p1.x - minDistance : p1.x + minDistance;
      }
      player.x = Math.max(0, Math.min(800, player.x));
    }
  }

  // ── Attack classification ──────────────────────────────────

  isAttack(action) {
    return action === 'high_punch' || action === 'low_punch' ||
           action === 'high_kick'  || action === 'low_kick'  ||
           action === 'uppercut'   || action === 'sweep'     ||
           action === 'super_attack';
  }

  // ── Core damage resolution ─────────────────────────────────

  processAttack(attacker, defender, action, distance, defenderAction) {
    const move = this.moveData[action];
    const attackerId = attacker === this.gameState.players.p1 ? 'p1' : 'p2';
    const defenderId = defender === this.gameState.players.p1 ? 'p1' : 'p2';
    const isSuperAttack = action === 'super_attack';

    // Consume super meter on use
    if (isSuperAttack) {
      attacker.superMeter = 0;
    }

    // Dodge — full invulnerability this tick (checked before range)
    if (defenderAction === 'dodge') {
      attacker.comboCount = 0;
      this.gameState.events.push(`${defenderId}_dodged`);
      return { hit: false, whiffed: false };
    }

    // Range check
    if (distance > move.range) {
      attacker.comboCount = 0;
      return { hit: false, whiffed: true };
    }

    // Height avoidance (super_attack ignores height avoidance — it's unstoppable)
    if (!isSuperAttack) {
      const height = move.height;

      // Crouch avoids all high attacks
      if (height === 'high' && defenderAction === 'crouch') {
        attacker.comboCount = 0;
        this.gameState.events.push(`${defenderId}_crouch_avoid`);
        return { hit: false, whiffed: false };
      }

      // Jump avoids all low attacks
      if (height === 'low' && defenderAction === 'jump') {
        attacker.comboCount = 0;
        this.gameState.events.push(`${defenderId}_jump_avoid`);
        return { hit: false, whiffed: false };
      }

      // Sweep special rule: also misses crouching opponents
      if (action === 'sweep' && defenderAction === 'crouch') {
        attacker.comboCount = 0;
        this.gameState.events.push(`${defenderId}_crouch_avoid`);
        return { hit: false, whiffed: false };
      }
    }

    // ── Attack connects ──

    let damage = move.damage;
    const blocked = defenderAction === 'block';
    let isCritical = false;

    if (blocked) {
      // Super attack chips through for 50% instead of normal 25%
      damage = Math.floor(damage * (isSuperAttack ? 0.50 : 0.25));
      this.gameState.events.push(`${defenderId}_blocked`);
      attacker.comboCount = 0;

      // Super meter: +4 for landing a blocked hit
      attacker.superMeter = Math.min(100, attacker.superMeter + 4);
    } else {
      // Successful unblocked hit
      attacker.comboCount++;

      // Combo bonus: +10% per consecutive hit beyond first, capped at 50%
      const comboBonus = Math.min((attacker.comboCount - 1) * 0.10, 0.50);
      damage = Math.floor(damage * (1 + comboBonus));

      // Critical hit: 15% chance for 1.5× damage (not for super — it's already devastating)
      if (!isSuperAttack && Math.random() < 0.15) {
        damage = Math.floor(damage * 1.5);
        isCritical = true;
        this.gameState.events.push(`${attackerId}_critical`);
      }

      if (attacker.comboCount >= 2) {
        this.gameState.events.push(`${attackerId}_combo_${attacker.comboCount}`);
      }

      // Super meter: +8 for landing an unblocked hit
      attacker.superMeter = Math.min(100, attacker.superMeter + 8);
    }

    defender.health = Math.max(0, defender.health - damage);

    // Super meter: +3 for taking damage (comeback mechanic)
    defender.superMeter = Math.min(100, defender.superMeter + 3);

    if (isSuperAttack) {
      this.gameState.events.push(`${attackerId}_super_hit`);
    }
    this.gameState.events.push(`${attackerId}_hit`);

    // Stagger: single hit ≥ 15 damage OR super attack always staggers
    if (damage >= 15 || isSuperAttack) {
      defender.isStaggered = true;
      this.gameState.events.push(`${defenderId}_staggered`);
    }

    defender.lastHitHeight = move.height || null;

    // Hitstop — freeze frames on impact for fighting game feel
    if (isSuperAttack) {
      this.gameState.hitstopFrames = 8;
    } else if (isCritical) {
      this.gameState.hitstopFrames = 5;
    } else {
      this.gameState.hitstopFrames = 3;
    }

    return { hit: true, whiffed: false };
  }

  // ── Player state mapping ───────────────────────────────────

  updatePlayerState(player, action, wasHit) {
    if (action !== 'idle') {
      player.framesSinceAction = 0;
    }

    if (player.health <= 0) {
      player.state = 'ko';
      return;
    }

    if (wasHit) {
      player.state = 'hit';
      return;
    }

    const stateMap = {
      'high_punch':   'punch_high',
      'low_punch':    'punch_low',
      'high_kick':    'kick_high',
      'low_kick':     'kick_low',
      'block':        'block',
      'move_forward': 'walk_forward',
      'move_back':    'walk_back',
      'idle':         'idle',
      'dodge':        'dodging',
      'crouch':       'crouching',
      'jump':         'jumping',
      'uppercut':     'uppercut',
      'sweep':        'sweep',
      'super_attack': 'super_attacking'
    };

    player.state = stateMap[action] || 'idle';
  }

  // ── Round lifecycle ────────────────────────────────────────

  checkRoundEnd() {
    const p1 = this.gameState.players.p1;
    const p2 = this.gameState.players.p2;

    if (p1.health <= 0 || p2.health <= 0) {
      this.gameState.events.push('ko');
      this.endRound(p1.health > p2.health ? 'p1' : 'p2');
      return;
    }

    if (this.gameState.timer <= 0) {
      this.gameState.events.push('timeout');
      if (p1.health > p2.health) {
        this.endRound('p1');
      } else if (p2.health > p1.health) {
        this.endRound('p2');
      } else {
        this.endRound(null);
      }
    }
  }

  endRound(winner) {
    this.gameState.phase = 'round_end';
    this.gameState.events.push('round_end');

    if (winner === 'p1') {
      this.gameState.roundWins.p1++;
    } else if (winner === 'p2') {
      this.gameState.roundWins.p2++;
    }

    if (this.gameState.roundWins.p1 >= 2 || this.gameState.roundWins.p2 >= 2) {
      this.gameState.phase = 'match_end';
      this.gameState.events.push('match_end');
    }
  }

  getState() {
    return JSON.parse(JSON.stringify(this.gameState));
  }
}

// Export as global
window.GameEngine = GameEngine;
