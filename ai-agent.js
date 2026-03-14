const FALLBACK_MODELS = [
  'gpt-4.1', 'gpt-4o', 'gpt-5-mini', 'gpt-5', 'gpt-5.1',
  'gpt-5.1-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini',
  'gpt-5.2', 'gpt-5.2-codex',
  'claude-haiku-4.5', 'claude-sonnet-4', 'claude-sonnet-4.5',
  'claude-opus-4.5', 'claude-opus-4.6',
  'gemini-2.5-pro', 'gemini-3-flash', 'gemini-3-pro',
  'o3-mini'
];

const VALID_ACTIONS = [
  'high_punch', 'low_punch', 'high_kick', 'low_kick',
  'block', 'move_forward', 'move_back', 'idle',
  'dodge', 'crouch', 'jump', 'uppercut', 'sweep',
  'super_attack'
];

const ACTION_STATS = {
  high_punch: { damage: 8, range: 80, speed: 'fast' },
  low_punch: { damage: 6, range: 70, speed: 'fastest' },
  high_kick: { damage: 12, range: 100, speed: 'medium' },
  low_kick: { damage: 10, range: 90, speed: 'medium' },
  block: { damage: 0, range: 0, speed: 'instant' },
  move_forward: { damage: 0, range: 0, speed: 'fast' },
  move_back: { damage: 0, range: 0, speed: 'fast' },
  idle: { damage: 0, range: 0, speed: 'instant' },
  dodge: { damage: 0, range: 0, speed: 'fast' },
  crouch: { damage: 0, range: 0, speed: 'instant' },
  jump: { damage: 0, range: 0, speed: 'medium' },
  uppercut: { damage: 18, range: 70, speed: 'slow' },
  sweep: { damage: 14, range: 95, speed: 'medium' },
  super_attack: { damage: 30, range: 100, speed: 'very_slow' }
};

// Counter map: what counters what
const COUNTERS = {
  high_kick: ['crouch', 'dodge'],
  high_punch: ['crouch', 'dodge'],
  low_kick: ['jump', 'block'],
  low_punch: ['jump', 'block'],
  uppercut: ['move_back', 'dodge'],
  sweep: ['jump'],
  move_forward: ['high_kick', 'sweep'],
  block: ['sweep', 'low_kick'],
  crouch: ['uppercut', 'low_kick'],
  jump: ['high_kick', 'high_punch'],
  dodge: ['sweep', 'low_kick'],
  super_attack: ['dodge']
};

// Model personality profiles
const MODEL_PERSONALITIES = {
  gpt: {
    name: 'Analytical',
    aggressionBase: 0.55,
    riskTolerance: 0.4,
    patternWeight: 0.7,
    preferredMoves: ['high_kick', 'low_punch', 'block', 'sweep'],
    style: 'Calculates optimal DPS. Weighs risk/reward ratios on every action.'
  },
  claude_haiku: {
    name: 'Speed Blitz',
    aggressionBase: 0.8,
    riskTolerance: 0.7,
    patternWeight: 0.4,
    preferredMoves: ['low_punch', 'high_punch', 'low_kick', 'dodge'],
    style: 'Fast and aggressive. Overwhelms with speed, adapts quickly.'
  },
  claude_sonnet: {
    name: 'Adaptive',
    aggressionBase: 0.5,
    riskTolerance: 0.5,
    patternWeight: 0.85,
    preferredMoves: ['high_kick', 'block', 'sweep', 'crouch'],
    style: 'Reads opponent patterns. Balances offense and defense each round.'
  },
  claude_opus: {
    name: 'Methodical',
    aggressionBase: 0.35,
    riskTolerance: 0.25,
    patternWeight: 0.9,
    preferredMoves: ['block', 'crouch', 'low_kick', 'sweep'],
    style: 'Patient and defensive. Waits for openings, punishes mistakes.'
  },
  gemini: {
    name: 'Wildcard',
    aggressionBase: 0.6,
    riskTolerance: 0.65,
    patternWeight: 0.3,
    preferredMoves: ['uppercut', 'sweep', 'jump', 'dodge', 'high_kick'],
    style: 'Unpredictable. Mixes creative combos, uses unexpected moves.'
  },
  o3: {
    name: 'Deep Thinker',
    aggressionBase: 0.45,
    riskTolerance: 0.35,
    patternWeight: 0.95,
    preferredMoves: ['block', 'crouch', 'sweep', 'uppercut'],
    style: 'Overthinks sometimes. Reads deeply, then strikes with precision.'
  },
  default: {
    name: 'Balanced',
    aggressionBase: 0.5,
    riskTolerance: 0.5,
    patternWeight: 0.5,
    preferredMoves: ['high_punch', 'high_kick', 'block', 'move_forward'],
    style: 'No particular style. Solid fundamentals.'
  }
};

let availableModels = null;
let copilotAvailable = true;

async function getAvailableModels() {
  if (availableModels) {
    return availableModels;
  }

  try {
    const { CopilotClient } = require('@github/copilot-sdk');
    const client = new CopilotClient();
    const modelsResult = await client.listModels?.();
    
    if (modelsResult && modelsResult.models && modelsResult.models.length > 0) {
      availableModels = modelsResult.models.map(m => m.id || m.name || String(m));
      console.log('Loaded models from Copilot SDK:', availableModels.length);
      return availableModels;
    }
  } catch (error) {
    console.log('Copilot SDK not available, using fallback models');
    copilotAvailable = false;
  }

  availableModels = FALLBACK_MODELS;
  return availableModels;
}

// ── Utility ──

function getPersonality(modelId) {
  const id = (modelId || '').toLowerCase();
  if (id.includes('haiku')) return MODEL_PERSONALITIES.claude_haiku;
  if (id.includes('sonnet')) return MODEL_PERSONALITIES.claude_sonnet;
  if (id.includes('opus')) return MODEL_PERSONALITIES.claude_opus;
  if (id.includes('claude')) return MODEL_PERSONALITIES.claude_sonnet;
  if (id.includes('gemini') || id.includes('flash')) return MODEL_PERSONALITIES.gemini;
  if (id.includes('o3')) return MODEL_PERSONALITIES.o3;
  if (id.includes('gpt') || id.includes('codex')) return MODEL_PERSONALITIES.gpt;
  return MODEL_PERSONALITIES.default;
}

function detectPattern(history, minCount = 3) {
  if (history.length < minCount) return null;
  const recent = history.slice(-5);
  const freq = {};
  for (const a of recent) {
    freq[a] = (freq[a] || 0) + 1;
  }
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  if (top[1] >= minCount) {
    return { action: top[0], count: top[1], total: recent.length };
  }
  return null;
}

function pickWeighted(options) {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const opt of options) {
    r -= opt.weight;
    if (r <= 0) return opt.action;
  }
  return options[options.length - 1].action;
}

function healthBar(hp) {
  if (hp > 60) return 'healthy';
  if (hp > 30) return 'wounded';
  if (hp > 15) return 'critical';
  return 'near-death';
}

// ── Fighter Agent ──

class FighterAgent {
  constructor(modelId, side, copilotClient) {
    this.modelId = modelId;
    this.side = side;
    this.copilotClient = copilotClient;
    this.session = null;
    this.strategy = 'balanced';
    this.roundHistory = [];
    this.opponentHistory = [];
    this.myHistory = [];
    this.personality = getPersonality(modelId);
    this.aggression = this.personality.aggressionBase;
    this.fallbackMode = !copilotAvailable;
    this.roundsWon = 0;
    this.roundsLost = 0;
  }

  async initialize() {
    if (this.fallbackMode) {
      console.log(`Fighter ${this.side} (${this.modelId}) [${this.personality.name}] fallback mode`);
      return;
    }

    try {
      this.session = await this.copilotClient.createSession({ model: this.modelId });
      console.log(`Fighter ${this.side} initialized with model ${this.modelId}`);
    } catch (error) {
      console.error(`Failed to create session for ${this.modelId}:`, error);
      this.fallbackMode = true;
    }
  }

  async getAction(gameState, thoughtCallback) {
    if (!this.session && !this.fallbackMode) {
      await this.initialize();
    }

    if (this.fallbackMode) {
      return this.getFallbackAction(gameState, thoughtCallback);
    }

    try {
      const prompt = this.buildPrompt(gameState);
      const timeout = this.raceTimeout(10000);

      const responsePromise = this.session.sendAndWait(prompt).then(response => {
        const text = response.message?.content || response.text || '';

        if (thoughtCallback && text) {
          thoughtCallback(text);
        }

        return this.parseResponse(text);
      });

      const result = await Promise.race([responsePromise, timeout]);

      if (!result || !VALID_ACTIONS.includes(result.action)) {
        console.warn(`Invalid action from ${this.modelId}: ${result?.action}`);
        return { action: 'idle', thought: 'Recalibrating...' };
      }

      return result;
    } catch (error) {
      console.error(`Error getting action from ${this.modelId}:`, error);
      return { action: 'idle', thought: 'Error occurred, resetting...' };
    }
  }

  buildPrompt(gameState) {
    const playerKey = this.side === 'left' ? 'p1' : 'p2';
    const opponentKey = this.side === 'left' ? 'p2' : 'p1';

    const player = gameState.players[playerKey];
    const opponent = gameState.players[opponentKey];

    const distance = Math.abs(player.x - opponent.x);
    const myWins = gameState.roundWins[playerKey] || 0;
    const oppWins = gameState.roundWins[opponentKey] || 0;
    const lastAction = gameState.lastActions?.[playerKey] || 'idle';
    const oppLastAction = gameState.lastActions?.[opponentKey] || 'idle';
    const comboCount = player.comboCount || 0;
    const isStaggered = player.isStaggered || false;
    const oppStaggered = opponent.isStaggered || false;
    const superMeter = player.superMeter || 0;
    const oppSuperMeter = opponent.superMeter || 0;
    const recentOpp = this.opponentHistory.slice(-5).join(', ') || 'none yet';

    return `You are a fighter in a Street Fighter-style combat game. Player ${this.side.toUpperCase()}.
Model: ${this.modelId} | Opponent: ${opponent.model || 'unknown'}

GAME STATE:
- Your health: ${player.health}/100 (${healthBar(player.health)})
- Opponent health: ${opponent.health}/100 (${healthBar(opponent.health)})
- Health advantage: ${player.health - opponent.health > 0 ? '+' : ''}${player.health - opponent.health}
- Distance: ${distance}px
- Round: ${gameState.round}/3 | Wins: You ${myWins} - Opponent ${oppWins}
- Timer: ${gameState.timer}s
- Your last action: ${lastAction} | Opponent last: ${oppLastAction}
- Opponent recent pattern: [${recentOpp}]
- Combo count: ${comboCount} | Staggered: ${isStaggered} | Opp staggered: ${oppStaggered}
- Super meter: ${superMeter}/100 ${superMeter >= 100 ? '⚡ READY!' : ''} | Opp super: ${oppSuperMeter}/100
- Current strategy: ${this.strategy}

AVAILABLE MOVES (choose exactly one):
  high_punch  — 8 dmg, 80px range, fast
  low_punch   — 6 dmg, 70px range, fastest
  high_kick   — 12 dmg, 100px range, medium
  low_kick    — 10 dmg, 90px range, medium
  uppercut    — 18 dmg, 70px range, slow (high risk/reward)
  sweep       — 14 dmg, 95px range, medium (trips opponent)
  super_attack — 30 dmg, 100px range, very slow (REQUIRES super meter = 100; ignores blocking; always staggers)
  block       — reduces incoming damage 75%
  dodge       — evade attack, fast
  crouch      — duck under high attacks
  jump        — jump over low attacks
  move_forward — +30px closer
  move_back    — -20px away
  idle         — do nothing

RANGE GUIDE: punch ≤80px, kick ≤100px, sweep ≤95px, uppercut ≤70px

INSTRUCTIONS:
1. Analyze the situation: health, distance, opponent patterns.
2. Pick the single best move based on your analysis.
3. Explain your reasoning clearly.
4. Respond in EXACT JSON: {"action": "move_name", "thought": "your reasoning"}

Fight smart!`;
  }

  parseResponse(text) {
    try {
      const jsonMatch = text.match(/\{[^}]*"action"[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action || 'idle',
          thought: parsed.thought || parsed.reasoning || 'Thinking...'
        };
      }
    } catch (error) {
      console.error('JSON parse error:', error);
    }

    const actionMatch = text.match(new RegExp(`(${VALID_ACTIONS.join('|')})`, 'i'));
    if (actionMatch) {
      return {
        action: actionMatch[1].toLowerCase(),
        thought: text.substring(0, 100)
      };
    }

    return { action: 'idle', thought: 'Processing...' };
  }

  // ── Core Fallback Strategy Engine ──

  getFallbackAction(gameState, thoughtCallback) {
    const playerKey = this.side === 'left' ? 'p1' : 'p2';
    const opponentKey = this.side === 'left' ? 'p2' : 'p1';

    const player = gameState.players[playerKey];
    const opponent = gameState.players[opponentKey];
    const distance = Math.abs(player.x - opponent.x);
    const healthDiff = player.health - opponent.health;
    const myWins = gameState.roundWins?.[playerKey] || 0;
    const oppWins = gameState.roundWins?.[opponentKey] || 0;
    const oppLastAction = gameState.lastActions?.[opponentKey] || 'idle';

    // Track opponent history
    if (oppLastAction && oppLastAction !== 'idle') {
      this.opponentHistory.push(oppLastAction);
      if (this.opponentHistory.length > 20) this.opponentHistory.shift();
    }

    // Detect opponent pattern
    const pattern = detectPattern(this.opponentHistory);

    // Compute dynamic aggression
    let aggression = this.aggression;
    if (healthDiff > 30) aggression -= 0.15;       // leading big → play safe
    if (healthDiff < -30) aggression += 0.2;        // behind big → push harder
    if (myWins > oppWins) aggression -= 0.1;        // ahead in rounds → conservative
    if (oppWins > myWins) aggression += 0.15;       // behind in rounds → aggressive
    if (player.health <= 15) aggression = 0.9;      // desperation mode
    aggression = Math.max(0.1, Math.min(1.0, aggression));

    // Determine strategy label
    let strategyLabel;
    if (player.health <= 15) strategyLabel = 'DESPERATE';
    else if (aggression >= 0.7) strategyLabel = 'Aggressive';
    else if (aggression <= 0.35) strategyLabel = 'Defensive';
    else strategyLabel = 'Balanced';

    // Build weighted action options
    const options = [];
    const pers = this.personality;

    // --- Pattern counter: if detected, strongly prefer counters ---
    let patternNote = '';
    if (pattern && COUNTERS[pattern.action]) {
      const counters = COUNTERS[pattern.action];
      for (const c of counters) {
        options.push({ action: c, weight: 6 * pers.patternWeight });
      }
      patternNote = `Opponent repeating ${pattern.action} (${pattern.count}/${pattern.total}) → counter with ${counters[0]}`;
    }

    // --- Distance logic ---
    if (distance > 130) {
      options.push({ action: 'move_forward', weight: 5 });
      if (pers.name === 'Wildcard') {
        options.push({ action: 'jump', weight: 2 }); // Gemini closing style
      }
    } else if (distance > 100) {
      options.push({ action: 'move_forward', weight: 3 });
      options.push({ action: 'high_kick', weight: 2 * aggression });
      options.push({ action: 'sweep', weight: 1.5 * aggression });
    } else if (distance <= 100 && distance > 70) {
      // Kick range - optimal for ranged attacks
      options.push({ action: 'high_kick', weight: 3 * aggression });
      options.push({ action: 'low_kick', weight: 2.5 * aggression });
      options.push({ action: 'sweep', weight: 2 * aggression });
      options.push({ action: 'block', weight: 2 * (1 - aggression) });
      options.push({ action: 'dodge', weight: 1.5 * (1 - aggression) });
      options.push({ action: 'move_back', weight: 1 * (1 - aggression) });
    } else if (distance <= 70) {
      // Close range - punches and uppercut territory
      options.push({ action: 'high_punch', weight: 2.5 * aggression });
      options.push({ action: 'low_punch', weight: 2 * aggression });
      options.push({ action: 'uppercut', weight: 3 * aggression * pers.riskTolerance });
      options.push({ action: 'sweep', weight: 1.5 * aggression });
      options.push({ action: 'block', weight: 2.5 * (1 - aggression) });
      options.push({ action: 'crouch', weight: 1.5 * (1 - aggression) });
      options.push({ action: 'move_back', weight: 1.5 * (1 - aggression) });
    }

    // --- Situational overrides ---
    // Super attack: if meter is full, high priority
    if (player.superMeter >= 100 && distance <= 100) {
      options.push({ action: 'super_attack', weight: 8 * aggression });
    }

    // Desperation mode: all-in high-risk moves
    if (player.health <= 15) {
      options.length = 0;
      if (player.superMeter >= 100) {
        options.push({ action: 'super_attack', weight: 10 });
      }
      options.push({ action: 'uppercut', weight: 5 });
      options.push({ action: 'high_kick', weight: 3 });
      options.push({ action: 'sweep', weight: 3 });
      if (distance > 80) options.push({ action: 'move_forward', weight: 4 });
      patternNote = 'DESPERATION — all-in high-risk/high-reward';
    }

    // Personality preferred moves bonus
    for (const opt of options) {
      if (pers.preferredMoves.includes(opt.action)) {
        opt.weight *= 1.3;
      }
    }

    // o3-mini deliberation: occasionally "over-think" and idle
    if (pers.name === 'Deep Thinker' && Math.random() < 0.08) {
      const action = 'idle';
      const thought = buildThought({
        strategyLabel, personality: pers.name, healthDiff,
        myHealth: player.health, oppHealth: opponent.health,
        distance, patternNote: 'Over-analyzing... recalculating optimal play',
        action, modelId: this.modelId
      });
      if (thoughtCallback) thoughtCallback(thought);
      this.myHistory.push(action);
      return { action, thought };
    }

    // Ensure we have at least one option
    if (options.length === 0) {
      options.push({ action: 'idle', weight: 1 });
    }

    const action = pickWeighted(options);
    this.myHistory.push(action);

    const thought = buildThought({
      strategyLabel, personality: pers.name, healthDiff,
      myHealth: player.health, oppHealth: opponent.health,
      distance, patternNote, action, modelId: this.modelId
    });

    if (thoughtCallback) thoughtCallback(thought);

    return { action, thought };
  }

  async adaptStrategy(roundResult) {
    this.roundHistory.push(roundResult);

    const won = roundResult.winner === this.side;
    if (won) {
      this.roundsWon++;
    } else {
      this.roundsLost++;
    }

    const prevStrategy = this.strategy;

    // Personality-driven adaptation
    if (won) {
      if (this.personality.aggressionBase >= 0.7) {
        this.strategy = 'aggressive';
        this.aggression = Math.min(1.0, this.aggression + 0.1);
      } else {
        this.strategy = 'balanced';
      }
    } else {
      if (this.personality.riskTolerance <= 0.3) {
        this.strategy = 'defensive';
        this.aggression = Math.max(0.1, this.aggression - 0.1);
      } else {
        this.strategy = this.roundsLost >= 2 ? 'aggressive' : 'balanced';
        this.aggression = Math.min(1.0, this.aggression + 0.05);
      }
    }

    // Detect opponent tendencies from history
    const oppPattern = detectPattern(this.opponentHistory, 2);
    const patternInsight = oppPattern
      ? `Opponent favors ${oppPattern.action} (${oppPattern.count}x recently)`
      : 'No dominant opponent pattern yet';

    // Build round analysis thought
    const yourHealth = roundResult.yourHealth ?? '?';
    const oppHealth = roundResult.oppHealth ?? '?';
    const roundNum = roundResult.round || this.roundHistory.length;

    const analysis = [
      `📋 ROUND ${roundNum} ANALYSIS:`,
      `Won: ${won ? '✅' : '❌'} | Health remaining: ${yourHealth} vs ${oppHealth}`,
      `Strategy shift: ${prevStrategy} → ${this.strategy}`,
      `Reason: ${won ? 'Winning momentum, press advantage' : 'Need to adjust, opponent adapted'}`,
      `Key learnings: ${patternInsight}`,
      `Aggression: ${(this.aggression * 100).toFixed(0)}% | Personality: ${this.personality.name}`
    ].join('\n');

    console.log(`[${this.modelId}] ${analysis}`);

    // Reset opponent history for fresh reads next round
    this.opponentHistory = this.opponentHistory.slice(-3);

    if (!this.fallbackMode && this.session) {
      try {
        const adaptPrompt = `Round ${roundNum} ended. ${won ? 'You won!' : 'You lost.'}
Health remaining: You ${yourHealth}, Opponent ${oppHealth}.
${patternInsight}

Adapt your strategy for the next round. Current strategy: ${this.strategy}.
What will you change? Be specific about which moves to favor or avoid.`;

        await this.session.sendAndWait(adaptPrompt);
      } catch (error) {
        console.error('Error adapting strategy:', error);
      }
    }

    return analysis;
  }

  raceTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    });
  }

  destroy() {
    this.session = null;
    this.copilotClient = null;
    this.opponentHistory = [];
    this.myHistory = [];
  }
}

// ── Structured Thought Builder ──

function buildThought({ strategyLabel, personality, healthDiff, myHealth, oppHealth, distance, patternNote, action, modelId }) {
  const advantageStr = healthDiff > 0 ? `advantage +${healthDiff}` : healthDiff < 0 ? `deficit ${healthDiff}` : 'even';
  const rangeLabel = distance <= 70 ? 'close combat' : distance <= 100 ? 'kick range' : distance <= 130 ? 'approach range' : 'far';
  const actionStats = ACTION_STATS[action];
  const dmgStr = actionStats && actionStats.damage > 0 ? `${actionStats.damage} dmg, ${actionStats.speed}` : actionStats ? actionStats.speed : '';

  const lines = [
    `[STRATEGY: ${strategyLabel}] (${personality})`,
    `📊 Health: ${myHealth} vs ${oppHealth} (${advantageStr})`,
    `📏 Distance: ${distance}px (${rangeLabel})`,
  ];
  if (patternNote) {
    lines.push(`🔍 Pattern: ${patternNote}`);
  }
  lines.push(`🎯 Action: ${action}${dmgStr ? ' (' + dmgStr + ')' : ''}`);

  return lines.join('\n');
}

module.exports = { FighterAgent, getAvailableModels };
