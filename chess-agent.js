// ── Chess Agent ──
// AI agent that plays chess using Copilot SDK or fallback strategy engine.
// Follows the same pattern as ai-agent.js (FighterAgent).

let copilotAvailable = true;

// ── Model Personality Profiles (Chess) ──

const MODEL_PERSONALITIES = {
  gpt: {
    name: 'Positional',
    style: 'Prefers center control, piece development, solid pawn structure.',
    centerBonus: 1.5,
    captureBonus: 0.8,
    developmentBonus: 1.3,
    castlingBonus: 1.4,
    aggressiveness: 0.4
  },
  claude: {
    name: 'Tactical',
    style: 'Looks for captures, checks, forks, pins. Sharp and concrete.',
    centerBonus: 0.8,
    captureBonus: 1.5,
    developmentBonus: 0.9,
    castlingBonus: 1.0,
    aggressiveness: 0.7
  },
  gemini: {
    name: 'Aggressive',
    style: 'Pushes pawns, sacrifices for initiative, attacks the king.',
    centerBonus: 1.0,
    captureBonus: 1.2,
    developmentBonus: 0.7,
    castlingBonus: 0.6,
    aggressiveness: 0.9
  },
  o_series: {
    name: 'Defensive',
    style: 'Castles early, avoids trades unless winning, solid and patient.',
    centerBonus: 1.2,
    captureBonus: 0.6,
    developmentBonus: 1.1,
    castlingBonus: 2.0,
    aggressiveness: 0.2
  },
  default: {
    name: 'Balanced',
    style: 'No particular style. Solid fundamentals across the board.',
    centerBonus: 1.0,
    captureBonus: 1.0,
    developmentBonus: 1.0,
    castlingBonus: 1.0,
    aggressiveness: 0.5
  }
};

const PIECE_VALUES = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };

const CENTER_SQUARES = ['e4', 'd4', 'e5', 'd5'];
const EXTENDED_CENTER = ['c3', 'd3', 'e3', 'f3', 'c4', 'f4', 'c5', 'f5', 'c6', 'd6', 'e6', 'f6'];

// Back rank squares for development detection
const WHITE_BACK_RANK = ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1'];
const BLACK_BACK_RANK = ['a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h8'];

// ── Utility ──

function getPersonality(modelId) {
  const id = (modelId || '').toLowerCase();
  if (id.includes('o3') || id.includes('o1') || id.includes('o4')) return MODEL_PERSONALITIES.o_series;
  if (id.includes('gemini') || id.includes('flash')) return MODEL_PERSONALITIES.gemini;
  if (id.includes('claude') || id.includes('haiku') || id.includes('sonnet') || id.includes('opus')) return MODEL_PERSONALITIES.claude;
  if (id.includes('gpt') || id.includes('codex')) return MODEL_PERSONALITIES.gpt;
  return MODEL_PERSONALITIES.default;
}

function pickWeightedFromTop(scored, topN = 3) {
  const sorted = scored.sort((a, b) => b.score - a.score);
  const candidates = sorted.slice(0, Math.min(topN, sorted.length));
  const total = candidates.reduce((s, c) => s + Math.max(c.score, 0.1), 0);
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= Math.max(c.score, 0.1);
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

function extractDestinationSquare(move) {
  // Parse algebraic notation to get destination square
  // Examples: e4 -> e4, Nf3 -> f3, Bxe5 -> e5, O-O -> g1/g8, exd5 -> d5, Qh5+ -> h5
  const clean = move.replace(/[+#!?]/g, '');

  if (clean === 'O-O' || clean === 'O-O-O') return null; // castling handled separately

  // Match the last two characters that look like a square (letter a-h + digit 1-8)
  const match = clean.match(/([a-h][1-8])(?:=[QRBN])?$/);
  return match ? match[1] : null;
}

function extractSourceHint(move) {
  // For moves like Nf3, Bxe5, etc., extract the piece type
  const clean = move.replace(/[+#!?]/g, '');
  if (clean === 'O-O' || clean === 'O-O-O') return { piece: 'k', castle: true };

  const first = clean[0];
  if ('KQRBN'.includes(first)) {
    return { piece: first.toLowerCase() };
  }
  // Pawn move
  return { piece: 'p' };
}

function isCastlingMove(move) {
  const clean = move.replace(/[+#!?]/g, '');
  return clean === 'O-O' || clean === 'O-O-O';
}

function isCaptureMove(move) {
  return move.includes('x');
}

function isCheckMove(move) {
  return move.includes('+') || move.includes('#');
}

function isCheckmateMove(move) {
  return move.includes('#');
}

function isPromotionMove(move) {
  return move.includes('=');
}

// ── Chess Agent ──

class ChessAgent {
  constructor(modelId, color, copilotClient = null) {
    this.modelId = modelId;
    this.color = color; // 'white' or 'black'
    this.copilotClient = copilotClient;
    this.session = null;
    this.moveHistory = [];
    this.personality = getPersonality(modelId);
    this.fallbackMode = !copilotClient;
  }

  async initialize() {
    if (this.fallbackMode) {
      console.log(`Chess ${this.color} (${this.modelId}) [${this.personality.name}] fallback mode`);
      return;
    }

    try {
      this.session = await this.copilotClient.createSession({ model: this.modelId });
      console.log(`Chess ${this.color} initialized with model ${this.modelId}`);
    } catch (error) {
      console.error(`Failed to create session for ${this.modelId}:`, error);
      this.fallbackMode = true;
    }
  }

  async getMove(boardState, onThought) {
    // boardState: { fen, turn, moveHistory, capturedPieces, gameState, legalMoves }
    if (!this.session && !this.fallbackMode) {
      await this.initialize();
    }

    if (this.fallbackMode) {
      return this.getFallbackMove(boardState, onThought);
    }

    return this.getLLMMove(boardState, onThought);
  }

  // ── LLM Move (Copilot SDK) ──

  async getLLMMove(boardState, onThought) {
    try {
      const prompt = this.buildChessPrompt(boardState);
      const timeout = this.raceTimeout(15000);

      const responsePromise = this.session.sendAndWait(prompt).then(response => {
        const text = response.message?.content || response.text || '';
        if (onThought && text) onThought(text);
        return this.parseChessResponse(text, boardState.legalMoves);
      });

      const result = await Promise.race([responsePromise, timeout]);

      if (!result || !result.move) {
        console.warn(`No valid move from ${this.modelId}, using fallback`);
        return this.getFallbackMove(boardState, onThought);
      }

      this.moveHistory.push(result.move);
      return result;
    } catch (error) {
      console.error(`Chess LLM error (${this.modelId}):`, error);
      return this.getFallbackMove(boardState, onThought);
    }
  }

  buildChessPrompt(boardState) {
    const { fen, moveHistory, capturedPieces, gameState, legalMoves } = boardState;
    const recentMoves = (moveHistory || []).slice(-10);

    return `You are a chess player using ${this.modelId}. Your color is ${this.color}.
Playing style: ${this.personality.name} — ${this.personality.style}

BOARD POSITION (FEN): ${fen}
GAME STATE: ${gameState || 'in progress'}
MOVE HISTORY (last 10): ${recentMoves.length > 0 ? recentMoves.join(', ') : 'none'}
CAPTURED PIECES: ${capturedPieces ? JSON.stringify(capturedPieces) : 'none'}
LEGAL MOVES: ${(legalMoves || []).join(', ')}

Analyze the board position and choose your move.
Consider: material balance, king safety, piece activity, pawn structure, tactical opportunities.

Return ONLY valid JSON: {"move": "e4", "thought": "your brief reasoning"}
The move MUST be one of the legal moves listed above, in standard algebraic notation.`;
  }

  parseChessResponse(text, legalMoves) {
    const moves = legalMoves || [];

    // Try JSON parse first
    try {
      const jsonMatch = text.match(/\{[^}]*"move"[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const move = (parsed.move || '').trim();
        if (moves.length === 0 || moves.includes(move)) {
          return { move, thought: parsed.thought || 'Analyzing position...' };
        }
        // Try case-insensitive or partial match
        const found = moves.find(m => m.toLowerCase() === move.toLowerCase());
        if (found) {
          return { move: found, thought: parsed.thought || 'Analyzing position...' };
        }
      }
    } catch (e) {
      // fall through
    }

    // Try to find any legal move mentioned in the text
    if (moves.length > 0) {
      // Sort by length descending to match longer notations first (e.g., "Bxe5" before "e5")
      const sorted = [...moves].sort((a, b) => b.length - a.length);
      for (const m of sorted) {
        if (text.includes(m)) {
          return { move: m, thought: text.substring(0, 120) };
        }
      }
    }

    return null;
  }

  // ── Fallback Strategy Engine ──

  getFallbackMove(boardState, onThought) {
    const { legalMoves, fen, capturedPieces, gameState } = boardState;
    const moves = legalMoves || [];

    if (moves.length === 0) {
      const thought = `[STRATEGY: ${this.personality.name}] No legal moves — game over.`;
      if (onThought) onThought(thought);
      return { move: null, thought };
    }

    const pers = this.personality;
    const scored = [];

    for (const move of moves) {
      let score = 1; // base score
      let reasons = [];

      // Checkmate — highest priority
      if (isCheckmateMove(move)) {
        score += 10000;
        reasons.push('CHECKMATE');
      }

      // Capture scoring
      if (isCaptureMove(move)) {
        const dest = extractDestinationSquare(move);
        // Estimate captured piece value from the move context
        // In algebraic notation, captures are like Bxe5, exd5, Qxf7
        // We can't know the exact piece captured without the board, so use a heuristic
        const captureValue = this.estimateCaptureValue(move, fen);
        score += captureValue * 10 * pers.captureBonus;
        reasons.push(`capture (~${captureValue}pt)`);
      }

      // Check bonus
      if (isCheckMove(move) && !isCheckmateMove(move)) {
        score += 50 * pers.captureBonus;
        reasons.push('check');
      }

      // Center control
      const dest = extractDestinationSquare(move);
      if (dest && CENTER_SQUARES.includes(dest)) {
        score += 20 * pers.centerBonus;
        reasons.push('center control');
      } else if (dest && EXTENDED_CENTER.includes(dest)) {
        score += 10 * pers.centerBonus;
        reasons.push('extended center');
      }

      // Development (moving pieces off back rank)
      const source = extractSourceHint(move);
      if (source.piece !== 'p' && source.piece !== 'k' && !isCaptureMove(move)) {
        const backRank = this.color === 'white' ? WHITE_BACK_RANK : BLACK_BACK_RANK;
        if (dest && !backRank.includes(dest)) {
          score += 15 * pers.developmentBonus;
          reasons.push('development');
        }
      }

      // Castling bonus
      if (isCastlingMove(move)) {
        score += 30 * pers.castlingBonus;
        reasons.push('castling');
      }

      // Promotion bonus
      if (isPromotionMove(move)) {
        score += 80;
        reasons.push('promotion');
      }

      // Personality-specific bonuses
      score += this.personalityBonus(move, pers, reasons);

      scored.push({ move, score, reasons });
    }

    // Pick from top 3 with weighted randomness
    const chosen = pickWeightedFromTop(scored, 3);
    this.moveHistory.push(chosen.move);

    const reasonStr = chosen.reasons.length > 0 ? chosen.reasons.join(', ') : 'solid move';
    const thought = `[STRATEGY: ${pers.name}] Considering ${chosen.move} — ${reasonStr}`;

    if (onThought) onThought(thought);
    return { move: chosen.move, thought };
  }

  estimateCaptureValue(move, fen) {
    // Heuristic: use piece letter in the destination if available from FEN context
    // Without full board parsing, we use conservative estimates:
    // Pawn captures pawn = 1, piece captures anything = ~3 average
    const source = extractSourceHint(move);

    // If it's a pawn capturing, it's likely capturing a defended piece (value ~2)
    if (source.piece === 'p') return 2;
    // Queen capturing: likely targeting high-value pieces or winning trades
    if (source.piece === 'q') return 4;
    // Rook capturing
    if (source.piece === 'r') return 3;
    // Minor pieces
    if (source.piece === 'b' || source.piece === 'n') return 3;
    return 2;
  }

  personalityBonus(move, pers, reasons) {
    let bonus = 0;

    if (pers.name === 'Positional') {
      // GPT: bonus for pawn moves to center, minor piece development
      const source = extractSourceHint(move);
      if (source.piece === 'p') {
        const dest = extractDestinationSquare(move);
        if (dest && CENTER_SQUARES.includes(dest)) {
          bonus += 8;
          reasons.push('positional pawn');
        }
      }
      // Penalize early queen moves
      if (source.piece === 'q' && this.moveHistory.length < 10) {
        bonus -= 10;
        reasons.push('early queen penalty');
      }
    }

    if (pers.name === 'Tactical') {
      // Claude: bonus for checks and captures
      if (isCheckMove(move)) bonus += 15;
      if (isCaptureMove(move)) bonus += 10;
      // Bonus for moves that might create forks (knight moves to center)
      const source = extractSourceHint(move);
      const dest = extractDestinationSquare(move);
      if (source.piece === 'n' && dest && CENTER_SQUARES.includes(dest)) {
        bonus += 12;
        reasons.push('knight to center (fork potential)');
      }
    }

    if (pers.name === 'Aggressive') {
      // Gemini: bonus for pawn pushes, sacrificial play
      const source = extractSourceHint(move);
      if (source.piece === 'p') {
        bonus += 5;
        reasons.push('pawn push');
      }
      if (isCaptureMove(move)) bonus += 8;
      // Penalize retreating moves (moves toward own back rank)
      const dest = extractDestinationSquare(move);
      if (dest) {
        const rank = parseInt(dest[1]);
        if (this.color === 'white' && rank <= 2) bonus -= 5;
        if (this.color === 'black' && rank >= 7) bonus -= 5;
      }
    }

    if (pers.name === 'Defensive') {
      // O-series: big castling bonus, avoid trades unless clearly winning
      if (isCastlingMove(move)) {
        bonus += 20;
        reasons.push('safety first');
      }
      // Penalize captures unless it's a clearly good trade
      if (isCaptureMove(move)) {
        bonus -= 5;
        reasons.push('avoids trades');
      }
      // Bonus for king-side pawn shield moves
      const dest = extractDestinationSquare(move);
      if (dest) {
        const file = dest[0];
        const rank = parseInt(dest[1]);
        if ('fgh'.includes(file)) {
          if ((this.color === 'white' && rank <= 3) || (this.color === 'black' && rank >= 6)) {
            bonus += 6;
            reasons.push('king safety');
          }
        }
      }
    }

    return bonus;
  }

  raceTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Chess move timeout')), ms);
    });
  }

  destroy() {
    this.session = null;
    this.copilotClient = null;
    this.moveHistory = [];
  }
}

module.exports = { ChessAgent };
