/**
 * ChessRenderer — Isometric 3D-style chess board renderer
 * Renders on the shared #gameCanvas with arcade neon aesthetic.
 */
class ChessRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.displayWidth = 800;
    this.displayHeight = 450;

    // Isometric tile dimensions (recalculated on resize)
    this.tileWidth = 64;
    this.tileHeight = 32;
    this.boardOffsetY = 20;
    this.boardDepth = 12;

    // Colors
    this.colors = {
      lightSquare: '#F0D9B5',
      darkSquare: '#B58863',
      boardSide: '#7A5A3A',
      boardBottom: '#5C3D1E',
      bg: '#1a0a2e',
      neonCyan: '#00ffff',
      neonMagenta: '#ff00ff',
      neonYellow: '#ffff00',
      white: '#ffffff',
      dark: '#0a0a0a'
    };

    // Piece unicode maps
    this.pieceUnicode = {
      white: { king: '\u2654', queen: '\u2655', rook: '\u2656', bishop: '\u2657', knight: '\u2658', pawn: '\u2659' },
      black: { king: '\u265A', queen: '\u265B', rook: '\u265C', bishop: '\u265D', knight: '\u265E', pawn: '\u265F' }
    };

    // Visual state
    this.selectedSquare = null;
    this.validMoves = [];
    this.lastMove = null;
    this.checkSquare = null;
    this.captureFlash = null;
    this.captureFlashTimer = 0;
    this.statusText = '';

    // Animation state
    this.animating = false;
    this.animFrom = null;
    this.animTo = null;
    this.animPiece = null;
    this.animProgress = 0;
    this.animCallback = null;
    this.animStartTime = 0;
    this.animDuration = 300;

    // Model selection overlay
    this.selectOverlay = null;

    // Render loop
    this.animFrameId = null;
    this.frameCount = 0;

    // Resize handling
    this.resizeCanvas();
    this._resizeHandler = () => this.resizeCanvas();
    window.addEventListener('resize', this._resizeHandler);
  }

  // ── Canvas Sizing ──────────────────────────────────────────────────

  resizeCanvas() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;

    // Recalculate tile size to fit board
    const maxBoardW = this.displayWidth * 0.55;
    const maxBoardH = this.displayHeight * 0.55;
    this.tileWidth = Math.min(maxBoardW / 8, maxBoardH / 4);
    this.tileHeight = this.tileWidth * 0.5;
    this.boardDepth = Math.max(6, this.tileHeight * 0.4);
  }

  // ── Isometric Projection ───────────────────────────────────────────

  boardToScreen(row, col) {
    const tileW = this.tileWidth;
    const tileH = this.tileHeight;
    const boardCenterX = this.displayWidth / 2;
    const boardCenterY = this.displayHeight / 2 - 10;

    // Isometric projection: diamond layout
    const isoX = (col - row) * tileW / 2;
    const isoY = (col + row) * tileH / 2;

    return {
      x: boardCenterX + isoX,
      y: boardCenterY + isoY - this.boardOffsetY - (8 * tileH / 2) / 2
    };
  }

  screenToBoard(sx, sy) {
    const tileW = this.tileWidth;
    const tileH = this.tileHeight;
    const boardCenterX = this.displayWidth / 2;
    const boardCenterY = this.displayHeight / 2 - 10 - this.boardOffsetY - (8 * tileH / 2) / 2;

    const dx = sx - boardCenterX;
    const dy = sy - boardCenterY;

    const col = (dx / (tileW / 2) + dy / (tileH / 2)) / 2;
    const row = (dy / (tileH / 2) - dx / (tileW / 2)) / 2;

    const r = Math.floor(row);
    const c = Math.floor(col);
    if (r >= 0 && r < 8 && c >= 0 && c < 8) return { row: r, col: c };
    return null;
  }

  // ── Main Render ────────────────────────────────────────────────────

  render(engineState) {
    this.frameCount++;
    const ctx = this.ctx;
    ctx.save();

    // Clear
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);

    if (!engineState) {
      ctx.restore();
      return;
    }

    this.drawBoard(engineState.board);
    this.drawHighlights();
    this.drawPieces(engineState.board);
    this.drawHUD(engineState);
    this.drawCapturedPieces(engineState.capturedPieces);
    this.drawMoveHistory(engineState.moveHistory);

    ctx.restore();
  }

  // ── Board Drawing ──────────────────────────────────────────────────

  drawBoard(board) {
    const ctx = this.ctx;

    // Draw board depth (sides) — bottom edge of board
    for (let col = 0; col < 8; col++) {
      // Bottom-right edge
      const topRight = this.boardToScreen(8, col);
      const topRight2 = this.boardToScreen(8, col + 1);

      ctx.fillStyle = this.colors.boardSide;
      ctx.beginPath();
      ctx.moveTo(topRight.x, topRight.y);
      ctx.lineTo(topRight2.x, topRight2.y);
      ctx.lineTo(topRight2.x, topRight2.y + this.boardDepth);
      ctx.lineTo(topRight.x, topRight.y + this.boardDepth);
      ctx.closePath();
      ctx.fill();
    }

    for (let row = 0; row < 8; row++) {
      // Bottom-left edge
      const botLeft = this.boardToScreen(row + 1, 8);
      const botLeft2 = this.boardToScreen(row, 8);

      ctx.fillStyle = this.colors.boardBottom;
      ctx.beginPath();
      ctx.moveTo(botLeft2.x, botLeft2.y);
      ctx.lineTo(botLeft.x, botLeft.y);
      ctx.lineTo(botLeft.x, botLeft.y + this.boardDepth);
      ctx.lineTo(botLeft2.x, botLeft2.y + this.boardDepth);
      ctx.closePath();
      ctx.fill();
    }

    // Draw squares
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const tl = this.boardToScreen(row, col);
        const tr = this.boardToScreen(row, col + 1);
        const br = this.boardToScreen(row + 1, col + 1);
        const bl = this.boardToScreen(row + 1, col);

        ctx.fillStyle = isLight ? this.colors.lightSquare : this.colors.darkSquare;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y);
        ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(br.x, br.y);
        ctx.lineTo(bl.x, bl.y);
        ctx.closePath();
        ctx.fill();

        // Subtle grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  // ── Highlight Drawing ──────────────────────────────────────────────

  drawHighlights() {
    const ctx = this.ctx;

    // Last move highlight (blue)
    if (this.lastMove) {
      for (const sq of [this.lastMove.from, this.lastMove.to]) {
        if (!sq) continue;
        this._fillSquare(sq.row, sq.col, 'rgba(50,100,255,0.25)');
      }
    }

    // Selected square (gold glow)
    if (this.selectedSquare) {
      const { row, col } = this.selectedSquare;
      const pulse = 0.3 + 0.15 * Math.sin(this.frameCount * 0.1);
      this._fillSquare(row, col, `rgba(255,215,0,${pulse})`);
    }

    // Valid move dots (green)
    if (this.validMoves && this.validMoves.length > 0) {
      for (const mv of this.validMoves) {
        const center = this._squareCenter(mv.row, mv.col);
        const dotR = this.tileWidth * 0.08;
        ctx.fillStyle = 'rgba(0,200,80,0.6)';
        ctx.beginPath();
        ctx.arc(center.x, center.y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Check highlight (red pulse on king square)
    if (this.checkSquare) {
      const pulse = 0.25 + 0.2 * Math.sin(this.frameCount * 0.15);
      this._fillSquare(this.checkSquare.row, this.checkSquare.col, `rgba(255,30,30,${pulse})`);
    }

    // Capture flash
    if (this.captureFlash && this.captureFlashTimer > 0) {
      const alpha = this.captureFlashTimer / 15;
      this._fillSquare(this.captureFlash.row, this.captureFlash.col, `rgba(255,255,255,${alpha * 0.5})`);
      this.captureFlashTimer--;
      if (this.captureFlashTimer <= 0) this.captureFlash = null;
    }
  }

  _fillSquare(row, col, color) {
    const ctx = this.ctx;
    const tl = this.boardToScreen(row, col);
    const tr = this.boardToScreen(row, col + 1);
    const br = this.boardToScreen(row + 1, col + 1);
    const bl = this.boardToScreen(row + 1, col);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.fill();
  }

  _squareCenter(row, col) {
    const tl = this.boardToScreen(row, col);
    const br = this.boardToScreen(row + 1, col + 1);
    return { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 };
  }

  // ── Piece Drawing ──────────────────────────────────────────────────

  drawPieces(board) {
    if (!board) return;

    // Draw back-to-front for correct overlap in isometric view
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;

        // Skip the piece being animated
        if (this.animating && this.animFrom &&
            this.animFrom.row === row && this.animFrom.col === col) {
          continue;
        }

        this.drawPiece(row, col, piece);
      }
    }

    // Draw animated piece on top
    if (this.animating && this.animPiece) {
      const t = this.animProgress;
      const fromPos = this._squareCenter(this.animFrom.row, this.animFrom.col);
      const toPos = this._squareCenter(this.animTo.row, this.animTo.col);

      // Smooth ease-out lerp
      const ease = 1 - Math.pow(1 - t, 3);
      const cx = fromPos.x + (toPos.x - fromPos.x) * ease;
      const cy = fromPos.y + (toPos.y - fromPos.y) * ease;

      // Hop arc for vertical offset
      const hop = -Math.sin(ease * Math.PI) * this.tileHeight * 0.4;

      this._drawPieceAt(cx, cy + hop, this.animPiece);
    }
  }

  drawPiece(row, col, piece) {
    const center = this._squareCenter(row, col);
    this._drawPieceAt(center.x, center.y, piece);
  }

  _drawPieceAt(x, y, piece) {
    const ctx = this.ctx;
    const fontSize = this.tileWidth * 0.65;
    const isWhite = piece.color === 'white';
    const symbol = this.pieceUnicode[piece.color][piece.type];

    // Shadow beneath piece
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + fontSize * 0.15, fontSize * 0.3, fontSize * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outline
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isWhite ? '#333333' : '#dddddd';
    ctx.strokeText(symbol, x, y - fontSize * 0.15);

    // Fill
    ctx.fillStyle = isWhite ? '#ffffff' : '#1a1a1a';
    ctx.fillText(symbol, x, y - fontSize * 0.15);
  }

  // ── HUD Drawing ────────────────────────────────────────────────────

  drawHUD(state) {
    const ctx = this.ctx;
    const w = this.displayWidth;

    // Title
    ctx.font = `${Math.max(12, w * 0.022)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Neon glow title
    const glowIntensity = 8 + 4 * Math.sin(this.frameCount * 0.04);
    ctx.shadowColor = this.colors.neonYellow;
    ctx.shadowBlur = glowIntensity;
    ctx.fillStyle = this.colors.neonYellow;
    ctx.fillText('LLM CHESS', w / 2, 12);
    ctx.shadowBlur = 0;

    // Turn indicator
    const turnText = state.turn === 'white' ? 'WHITE to move' : 'BLACK to move';
    ctx.font = `${Math.max(8, w * 0.013)}px 'Press Start 2P', monospace`;
    const turnColor = state.turn === 'white' ? '#ffffff' : '#aaaaaa';
    ctx.fillStyle = turnColor;
    ctx.fillText(turnText, w / 2, 36);

    // Game status text
    if (state.gameState === 'check') {
      this._drawStatusBadge('CHECK!', '#ff4444');
    } else if (state.gameState === 'checkmate') {
      this._drawStatusBadge('CHECKMATE!', '#ff0000');
    } else if (state.gameState === 'stalemate') {
      this._drawStatusBadge('STALEMATE', '#ffaa00');
    } else if (state.gameState === 'draw') {
      this._drawStatusBadge('DRAW', '#ffaa00');
    }

    // Player labels
    if (this._whiteModel || this._blackModel) {
      ctx.font = `${Math.max(7, w * 0.011)}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'left';

      // White player (left side)
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = this.colors.neonCyan;
      ctx.shadowBlur = 6;
      ctx.fillText(`\u2654 ${this._whiteModel || '???'}`, 14, this.displayHeight / 2 - 10);
      ctx.shadowBlur = 0;

      // Black player (right side)
      ctx.textAlign = 'right';
      ctx.fillStyle = '#cccccc';
      ctx.shadowColor = this.colors.neonMagenta;
      ctx.shadowBlur = 6;
      ctx.fillText(`\u265A ${this._blackModel || '???'}`, w - 14, this.displayHeight / 2 - 10);
      ctx.shadowBlur = 0;
    }

    // Move counter
    ctx.font = `${Math.max(7, w * 0.009)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.fillText(`Move ${state.fullMoveNumber || 1}`, w / 2, this.displayHeight - 16);
  }

  _drawStatusBadge(text, color) {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const fontSize = Math.max(10, w * 0.018);
    ctx.font = `${fontSize}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    const pulse = 0.7 + 0.3 * Math.sin(this.frameCount * 0.12);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, 54);
    ctx.shadowBlur = 0;
  }

  // ── Captured Pieces ────────────────────────────────────────────────

  drawCapturedPieces(captured) {
    if (!captured) return;
    const ctx = this.ctx;
    const fontSize = Math.max(10, this.tileWidth * 0.35);
    ctx.font = `${fontSize}px serif`;
    ctx.textBaseline = 'top';

    // White's captured pieces (pieces black lost) — left side
    const whiteCaptured = captured.white || [];
    ctx.textAlign = 'left';
    let x = 14;
    let y = this.displayHeight / 2 + 14;
    for (let i = 0; i < whiteCaptured.length; i++) {
      const p = whiteCaptured[i];
      const symbol = this.pieceUnicode.black[p.type];
      ctx.fillStyle = '#888';
      ctx.fillText(symbol, x + (i % 8) * (fontSize * 0.8), y + Math.floor(i / 8) * (fontSize * 1.1));
    }

    // Black's captured pieces (pieces white lost) — right side
    const blackCaptured = captured.black || [];
    ctx.textAlign = 'right';
    x = this.displayWidth - 14;
    y = this.displayHeight / 2 + 14;
    for (let i = 0; i < blackCaptured.length; i++) {
      const p = blackCaptured[i];
      const symbol = this.pieceUnicode.white[p.type];
      ctx.fillStyle = '#888';
      ctx.fillText(symbol, x - (i % 8) * (fontSize * 0.8), y + Math.floor(i / 8) * (fontSize * 1.1));
    }
  }

  // ── Move History ───────────────────────────────────────────────────

  drawMoveHistory(history) {
    if (!history || history.length === 0) return;
    const ctx = this.ctx;
    const fontSize = Math.max(7, this.displayWidth * 0.009);
    ctx.font = `${fontSize}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    const last5 = history.slice(-5);
    const startY = 70;
    const x = this.displayWidth - 14;

    ctx.fillStyle = '#555';
    ctx.fillText('MOVES', x, startY - fontSize - 4);

    for (let i = 0; i < last5.length; i++) {
      const mv = last5[i];
      const moveNum = history.length - last5.length + i + 1;
      const numStr = Math.ceil(moveNum / 2) + (moveNum % 2 === 1 ? '.' : '...');
      const text = `${numStr} ${mv.notation || '???'}`;

      ctx.fillStyle = i === last5.length - 1 ? '#aaa' : '#555';
      ctx.fillText(text, x, startY + i * (fontSize + 5));
    }
  }

  // ── Animation ──────────────────────────────────────────────────────

  animateMove(from, to, piece, callback) {
    this.animating = true;
    this.animFrom = from;
    this.animTo = to;
    this.animPiece = piece;
    this.animProgress = 0;
    this.animStartTime = performance.now();
    this.animCallback = callback;

    const step = () => {
      const elapsed = performance.now() - this.animStartTime;
      this.animProgress = Math.min(1, elapsed / this.animDuration);

      if (this.animProgress >= 1) {
        this.animating = false;
        this.animFrom = null;
        this.animTo = null;
        this.animPiece = null;
        this.animProgress = 0;
        if (this.animCallback) {
          const cb = this.animCallback;
          this.animCallback = null;
          cb();
        }
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ── Capture Flash ──────────────────────────────────────────────────

  flashCapture(row, col) {
    this.captureFlash = { row, col };
    this.captureFlashTimer = 15;
  }

  // ── Model Selection Screen ─────────────────────────────────────────

  showModelSelect(models, onStart) {
    this.hideModelSelect();
    const stage = this.canvas.closest('.game-stage') || this.canvas.parentElement;

    const overlay = document.createElement('div');
    overlay.className = 'select-overlay chess-select-overlay';
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(10,10,30,0.92); z-index: 100;
      font-family: 'Press Start 2P', monospace; color: #fff;
    `;

    const title = document.createElement('div');
    title.textContent = 'LLM CHESS';
    title.style.cssText = `
      font-size: clamp(18px, 3vw, 32px); color: #ffff00;
      text-shadow: 0 0 10px #ffff00, 0 0 20px #ff00ff;
      margin-bottom: 30px; letter-spacing: 4px;
    `;
    overlay.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'SELECT YOUR MODELS';
    subtitle.style.cssText = `font-size: clamp(8px, 1.3vw, 14px); color: #00ffff; margin-bottom: 24px;`;
    overlay.appendChild(subtitle);

    const row = document.createElement('div');
    row.style.cssText = `display: flex; gap: 30px; align-items: center; flex-wrap: wrap; justify-content: center;`;

    const makeSelector = (label, icon, glowColor) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = `display: flex; flex-direction: column; align-items: center; gap: 8px;`;

      const lbl = document.createElement('div');
      lbl.innerHTML = `${icon} ${label}`;
      lbl.style.cssText = `font-size: clamp(8px, 1.1vw, 12px); color: ${glowColor};`;
      wrap.appendChild(lbl);

      const sel = document.createElement('select');
      sel.style.cssText = `
        font-family: 'Press Start 2P', monospace; font-size: clamp(7px, 0.9vw, 10px);
        background: #111; color: #fff; border: 2px solid ${glowColor};
        padding: 8px 12px; border-radius: 4px; cursor: pointer;
        min-width: 180px; outline: none;
      `;
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- choose --';
      sel.appendChild(defaultOpt);
      for (const m of models) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        sel.appendChild(opt);
      }
      wrap.appendChild(sel);
      return { wrap, sel };
    };

    const white = makeSelector('WHITE', '\u2654', '#00ffff');
    const black = makeSelector('BLACK', '\u265A', '#ff00ff');
    row.appendChild(white.wrap);

    const vs = document.createElement('div');
    vs.textContent = 'VS';
    vs.style.cssText = `font-size: clamp(12px, 2vw, 22px); color: #ffff00; text-shadow: 0 0 8px #ffff00;`;
    row.appendChild(vs);

    row.appendChild(black.wrap);
    overlay.appendChild(row);

    const btn = document.createElement('button');
    btn.textContent = 'START GAME';
    btn.disabled = true;
    btn.style.cssText = `
      font-family: 'Press Start 2P', monospace; font-size: clamp(10px, 1.4vw, 16px);
      background: transparent; color: #555; border: 2px solid #555;
      padding: 12px 32px; margin-top: 28px; cursor: not-allowed;
      border-radius: 4px; transition: all 0.3s;
    `;

    const checkReady = () => {
      if (white.sel.value && black.sel.value) {
        btn.disabled = false;
        btn.style.color = '#00ff00';
        btn.style.borderColor = '#00ff00';
        btn.style.cursor = 'pointer';
        btn.style.textShadow = '0 0 8px #00ff00';
      } else {
        btn.disabled = true;
        btn.style.color = '#555';
        btn.style.borderColor = '#555';
        btn.style.cursor = 'not-allowed';
        btn.style.textShadow = 'none';
      }
    };

    white.sel.addEventListener('change', checkReady);
    black.sel.addEventListener('change', checkReady);

    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const w = white.sel.value;
      const b = black.sel.value;
      if (w && b && onStart) {
        this.hideModelSelect();
        onStart(w, b);
      }
    });

    overlay.appendChild(btn);
    stage.appendChild(overlay);
    this.selectOverlay = overlay;
  }

  hideModelSelect() {
    if (this.selectOverlay) {
      this.selectOverlay.remove();
      this.selectOverlay = null;
    }
    // Also remove any leftover chess select overlays
    document.querySelectorAll('.chess-select-overlay').forEach(el => el.remove());
  }

  // ── Result Screen ──────────────────────────────────────────────────

  showResult(result, onPlayAgain) {
    const stage = this.canvas.closest('.game-stage') || this.canvas.parentElement;
    document.querySelectorAll('.chess-result-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'game-overlay chess-result-overlay';
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.85); z-index: 100;
      font-family: 'Press Start 2P', monospace; color: #fff;
      animation: fadeIn 0.5s ease-out;
    `;

    let titleText = 'GAME OVER';
    let titleColor = '#ffff00';
    let subText = '';

    if (result.gameState === 'checkmate') {
      const winner = result.turn === 'white' ? 'BLACK' : 'WHITE';
      const winnerModel = result.turn === 'white' ? (this._blackModel || 'Black') : (this._whiteModel || 'White');
      titleText = 'CHECKMATE!';
      titleColor = '#ff0000';
      subText = `${winner} (${winnerModel}) WINS!`;
    } else if (result.gameState === 'stalemate') {
      titleText = 'STALEMATE';
      titleColor = '#ffaa00';
      subText = 'Game is a draw.';
    } else if (result.gameState === 'draw') {
      titleText = 'DRAW';
      titleColor = '#ffaa00';
      subText = '50-move rule reached.';
    }

    const title = document.createElement('div');
    title.textContent = titleText;
    title.style.cssText = `
      font-size: clamp(20px, 4vw, 40px); color: ${titleColor};
      text-shadow: 0 0 15px ${titleColor}, 0 0 30px ${titleColor};
      margin-bottom: 16px;
    `;
    overlay.appendChild(title);

    if (subText) {
      const sub = document.createElement('div');
      sub.textContent = subText;
      sub.style.cssText = `font-size: clamp(8px, 1.4vw, 14px); color: #ccc; margin-bottom: 24px;`;
      overlay.appendChild(sub);
    }

    const moveCount = document.createElement('div');
    moveCount.textContent = `Total moves: ${(result.moveHistory || []).length}`;
    moveCount.style.cssText = `font-size: clamp(7px, 1vw, 10px); color: #666; margin-bottom: 28px;`;
    overlay.appendChild(moveCount);

    if (onPlayAgain) {
      const btn = document.createElement('button');
      btn.textContent = 'PLAY AGAIN';
      btn.style.cssText = `
        font-family: 'Press Start 2P', monospace; font-size: clamp(10px, 1.4vw, 16px);
        background: transparent; color: #00ff00; border: 2px solid #00ff00;
        padding: 12px 32px; cursor: pointer; border-radius: 4px;
        text-shadow: 0 0 8px #00ff00;
      `;
      btn.addEventListener('click', () => {
        overlay.remove();
        onPlayAgain();
      });
      overlay.appendChild(btn);
    }

    stage.appendChild(overlay);
  }

  // ── Setters for Player Labels ──────────────────────────────────────

  setModels(white, black) {
    this._whiteModel = white;
    this._blackModel = black;
  }

  setLastMove(from, to) {
    this.lastMove = { from, to };
  }

  setCheck(kingPos) {
    this.checkSquare = kingPos;
  }

  clearCheck() {
    this.checkSquare = null;
  }

  clearHighlights() {
    this.selectedSquare = null;
    this.validMoves = [];
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
    this.hideModelSelect();
    document.querySelectorAll('.chess-result-overlay').forEach(el => el.remove());
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.animating = false;
  }
}

window.ChessRenderer = ChessRenderer;
