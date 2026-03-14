/**
 * ChessGame — Orchestrator for LLM Chess
 * Wires ChessEngine + ChessRenderer + WebSocket AI together.
 * Exposes init() / destroy() for GameApp lifecycle.
 */
class ChessGame {
  constructor() {
    this.engine = null;
    this.renderer = null;
    this.ws = null;
    this.models = { white: null, black: null };
    this.isAITurn = false;
    this.destroyed = false;
    this.renderLoopId = null;
    this.moveDelay = 1500;
    this.moveTimeout = null;
    this.wsReconnectTimer = null;
    this._wsUrl = null;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  init() {
    this.destroyed = false;
    this.engine = new ChessEngine();
    this.renderer = new ChessRenderer(document.getElementById('gameCanvas'));

    // Show thought panels for chess
    const strip = document.querySelector('.thought-strip');
    if (strip) strip.style.display = '';

    this._resetThoughtPanels();
    this.startRenderLoop();
    this.showModelSelect();
  }

  destroy() {
    this.destroyed = true;
    if (this.renderLoopId) {
      cancelAnimationFrame(this.renderLoopId);
      this.renderLoopId = null;
    }
    if (this.moveTimeout) {
      clearTimeout(this.moveTimeout);
      this.moveTimeout = null;
    }
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.send(JSON.stringify({ game: 'chess', type: 'end_chess' }));
      } catch (e) { /* ignore */ }
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
    this.engine = null;

    // Hide thought panels
    const strip = document.querySelector('.thought-strip');
    if (strip) strip.style.display = 'none';
  }

  // ── Render Loop ────────────────────────────────────────────────────

  startRenderLoop() {
    const loop = () => {
      if (this.destroyed) return;
      if (this.engine && this.renderer) {
        this.renderer.render(this.engine.getState());
      }
      this.renderLoopId = requestAnimationFrame(loop);
    };
    loop();
  }

  // ── WebSocket ──────────────────────────────────────────────────────

  connectWebSocket() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this._wsUrl = `${proto}//${location.host}`;
      this.ws = new WebSocket(this._wsUrl);

      this.ws.onopen = () => {
        console.log('[Chess] WebSocket connected');
        resolve();
      };

      this.ws.onerror = (err) => {
        console.error('[Chess] WebSocket error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        console.log('[Chess] WebSocket closed');
        if (!this.destroyed) {
          this.wsReconnectTimer = setTimeout(() => this.reconnect(), 3000);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[Chess] Bad message:', e);
        }
      };
    });
  }

  reconnect() {
    if (this.destroyed) return;
    console.log('[Chess] Attempting reconnect...');
    this.connectWebSocket().catch(() => {
      if (!this.destroyed) {
        this.wsReconnectTimer = setTimeout(() => this.reconnect(), 5000);
      }
    });
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'chess_started':
        console.log('[Chess] Game started on server');
        this.requestNextMove();
        break;

      case 'chess_move_result':
        this.handleAIMove(msg.move);
        break;

      case 'thought':
        this.updateThought(msg.side, msg.text);
        break;

      case 'error':
        console.error('[Chess] Server error:', msg.message);
        this.isAITurn = false;
        // Retry after a delay if we're mid-game
        if (this.engine && this.engine.gameState === 'playing') {
          this.moveTimeout = setTimeout(() => this.requestNextMove(), 3000);
        }
        break;
    }
  }

  // ── Model Selection ────────────────────────────────────────────────

  async showModelSelect() {
    let models;
    try {
      const resp = await fetch('/api/models');
      const data = await resp.json();
      models = data.models || [];
    } catch (e) {
      console.warn('[Chess] Using fallback models');
      models = [
        'gpt-4.1', 'gpt-5-mini', 'gpt-5.1', 'gpt-5.2',
        'claude-haiku-4.5', 'claude-sonnet-4.5', 'claude-opus-4.6',
        'gemini-3-pro-preview', 'o3-mini'
      ];
    }

    this.renderer.showModelSelect(models, (white, black) => {
      this.models.white = white;
      this.models.black = black;
      this.startGame();
    });
  }

  // ── Game Flow ──────────────────────────────────────────────────────

  async startGame() {
    this.engine.reset();
    this.renderer.setModels(this.models.white, this.models.black);
    this.renderer.clearHighlights();
    this.renderer.clearCheck();
    this.renderer.setLastMove(null, null);
    this.renderer.lastMove = null;

    // Update thought panels
    this._setModel('left', this.models.white);
    this._setModel('right', this.models.black);
    this._setThought('left', 'Preparing...');
    this._setThought('right', 'Preparing...');

    try {
      await this.connectWebSocket();
      this.ws.send(JSON.stringify({
        game: 'chess',
        type: 'start_chess',
        model1: this.models.white,
        model2: this.models.black
      }));
    } catch (e) {
      console.error('[Chess] Failed to connect:', e);
      // Continue anyway — server might not have chess agent, but UI still works
      this._setThought('left', 'Connection failed — demo mode');
      this._setThought('right', 'Connection failed — demo mode');
    }
  }

  requestNextMove() {
    if (this.destroyed || this.isAITurn) return;
    const state = this.engine.getState();

    // Game over?
    if (state.gameState === 'checkmate' || state.gameState === 'stalemate' || state.gameState === 'draw') {
      this.handleGameEnd(state);
      return;
    }

    this.isAITurn = true;
    const side = state.turn; // 'white' | 'black'
    const thoughtSide = side === 'white' ? 'left' : 'right';
    this._setThought(thoughtSide, '\u23F3 Thinking...');

    // Build board state for the server
    const boardState = {
      fen: this.engine.toFEN(),
      turn: state.turn,
      moveHistory: state.moveHistory.map(m => m.notation),
      validMoves: this.engine.getAllValidMoves(state.turn).map(m => {
        return this.engine.toAlgebraic(m.from.row, m.from.col, m.to.row, m.to.col);
      }),
      capturedPieces: state.capturedPieces,
      gameState: state.gameState
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        game: 'chess',
        type: 'request_chess_move',
        boardState,
        side
      }));
    }
  }

  handleAIMove(moveData) {
    if (this.destroyed || !this.engine) return;
    this.isAITurn = false;

    const notation = moveData.move || moveData.notation || moveData;
    const thought = moveData.thought || '';
    const side = this.engine.turn;
    const thoughtSide = side === 'white' ? 'left' : 'right';

    if (thought) {
      this._setThought(thoughtSide, `\u265F ${notation}: ${thought.substring(0, 120)}`);
    } else {
      this._setThought(thoughtSide, `\u265F ${notation}`);
    }

    // Parse the algebraic notation
    const parsed = this.engine.parseAlgebraic(notation, side);
    if (!parsed) {
      console.error('[Chess] Could not parse move:', notation);
      this._setThought(thoughtSide, `\u26A0 Invalid: ${notation}`);
      // Try again after delay
      this.moveTimeout = setTimeout(() => this.requestNextMove(), 2000);
      return;
    }

    const { fromRow, fromCol, toRow, toCol, promotion } = parsed;
    const piece = this.engine.getPieceAt(fromRow, fromCol);

    // Animate the piece movement
    this.renderer.animateMove(
      { row: fromRow, col: fromCol },
      { row: toRow, col: toCol },
      piece,
      () => {
        if (this.destroyed) return;

        // Execute the move on the engine
        const result = this.engine.makeMove(fromRow, fromCol, toRow, toCol, promotion);

        if (!result.valid) {
          console.error('[Chess] Engine rejected move:', notation);
          this._setThought(thoughtSide, `\u26A0 Rejected: ${notation}`);
          this.moveTimeout = setTimeout(() => this.requestNextMove(), 2000);
          return;
        }

        // Update visual highlights
        this.renderer.setLastMove({ row: fromRow, col: fromCol }, { row: toRow, col: toCol });

        if (result.captured) {
          this.renderer.flashCapture(toRow, toCol);
        }

        if (result.check) {
          const opponentColor = side === 'white' ? 'black' : 'white';
          const kingPos = this._findKing(opponentColor);
          if (kingPos) this.renderer.setCheck(kingPos);
        } else {
          this.renderer.clearCheck();
        }

        // Check game end
        const newState = this.engine.getState();
        if (newState.gameState === 'checkmate' || newState.gameState === 'stalemate' || newState.gameState === 'draw') {
          this.handleGameEnd(newState);
          return;
        }

        // Schedule next move with delay so user can see the board
        this.moveTimeout = setTimeout(() => {
          if (!this.destroyed) this.requestNextMove();
        }, this.moveDelay);
      }
    );
  }

  handleGameEnd(state) {
    this.isAITurn = false;
    const thoughtLeft = state.gameState === 'checkmate'
      ? (state.turn === 'white' ? '\uD83D\uDC80 DEFEATED' : '\uD83C\uDFC6 VICTORY!')
      : '\uD83E\uDD1D DRAW';
    const thoughtRight = state.gameState === 'checkmate'
      ? (state.turn === 'black' ? '\uD83D\uDC80 DEFEATED' : '\uD83C\uDFC6 VICTORY!')
      : '\uD83E\uDD1D DRAW';

    this._setThought('left', thoughtLeft);
    this._setThought('right', thoughtRight);

    // Show result overlay after a brief pause
    setTimeout(() => {
      if (this.destroyed || !this.renderer) return;
      this.renderer.showResult(state, () => this.playAgain());
    }, 1500);
  }

  playAgain() {
    if (this.destroyed) return;
    this.isAITurn = false;
    this.renderer.clearHighlights();
    this.renderer.clearCheck();
    this.renderer.lastMove = null;
    this.showModelSelect();
  }

  // ── Helpers ────────────────────────────────────────────────────────

  _findKing(color) {
    if (!this.engine) return null;
    const board = this.engine.board;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'king' && p.color === color) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  _resetThoughtPanels() {
    this._setModel('left', '---');
    this._setModel('right', '---');
    this._setThought('left', 'Awaiting selection...');
    this._setThought('right', 'Awaiting selection...');
  }

  _setModel(side, name) {
    const el = document.getElementById(side === 'left' ? 'leftModel' : 'rightModel');
    if (el) el.textContent = name || '---';
  }

  _setThought(side, text) {
    const el = document.getElementById(side === 'left' ? 'leftThought' : 'rightThought');
    if (el) el.innerHTML = `<p>${this._escapeHtml(text)}</p>`;
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

window.ChessGame = ChessGame;
