// draw-renderer.js — Full UI renderer for the LLM Draw Arena
// Creates all DOM elements dynamically over the .game-stage area

class DrawRenderer {
  constructor() {
    this.overlay = null;
    this.styleEl = null;
    this.leftCanvas = null;
    this.rightCanvas = null;
    this.leftPaint = null;
    this.rightPaint = null;
    this.timerEl = null;
    this.promptInput = null;
    this.startBtn = null;
    this.leftModelLabel = null;
    this.rightModelLabel = null;
    this.leftStatsEl = null;
    this.rightStatsEl = null;
    this.leftThoughtEl = null;
    this.rightThoughtEl = null;
    this.selectSection = null;
    this.drawingSection = null;
    this.resultSection = null;
    this.container = null;
  }

  // ── Lifecycle ──

  init(container) {
    this.container = container;
    this._injectStyles();
    this._buildDOM(container);
    return { leftCanvas: this.leftCanvas, rightCanvas: this.rightCanvas };
  }

  destroy() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    if (this.styleEl && this.styleEl.parentNode) {
      this.styleEl.parentNode.removeChild(this.styleEl);
    }
    this.overlay = null;
    this.styleEl = null;
    this.leftCanvas = null;
    this.rightCanvas = null;
    this.leftPaint = null;
    this.rightPaint = null;
    this.container = null;
  }

  // ── Style injection ──

  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .draw-overlay {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 50;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(5, 5, 15, 0.97);
        font-family: 'Press Start 2P', monospace;
        overflow-y: auto;
      }

      .draw-title {
        font-size: 22px;
        color: #ff00ff;
        text-shadow: 0 0 20px #ff00ff, 0 0 40px rgba(255, 0, 255, 0.4);
        margin-bottom: 18px;
        text-align: center;
        letter-spacing: 2px;
        animation: drawTitleGlow 2s ease-in-out infinite alternate;
      }
      @keyframes drawTitleGlow {
        from { text-shadow: 0 0 10px #ff00ff, 0 0 20px rgba(255, 0, 255, 0.3); }
        to   { text-shadow: 0 0 25px #ff00ff, 0 0 50px rgba(255, 0, 255, 0.6); }
      }

      /* ── Arena layout ── */
      .draw-arena {
        display: flex;
        align-items: flex-start;
        justify-content: center;
        gap: 16px;
        width: 95%;
        max-width: 1100px;
        flex: 1;
        min-height: 0;
      }

      .draw-canvas-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        max-width: 420px;
        min-width: 200px;
      }

      .draw-canvas-wrap {
        border: 2px solid #333;
        background: #fff;
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.6);
        width: 100%;
        aspect-ratio: 1 / 1;
        position: relative;
      }
      .draw-canvas-wrap canvas {
        display: block;
        width: 100%;
        height: 100%;
      }

      .draw-model-label {
        margin-top: 6px;
        font-size: 9px;
        padding: 3px 10px;
        border: 1px solid currentColor;
        background: rgba(0, 0, 0, 0.7);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .draw-canvas-col.left .draw-model-label  { color: #00ffff; }
      .draw-canvas-col.right .draw-model-label { color: #ff00ff; }

      .draw-stats {
        font-size: 8px;
        color: #888;
        margin-top: 4px;
      }

      .draw-thought {
        font-size: 7px;
        color: #aaa;
        margin-top: 4px;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-height: 14px;
      }

      /* ── Center column ── */
      .draw-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 20px 10px;
        min-width: 170px;
        max-width: 220px;
      }

      .draw-prompt-input {
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        width: 100%;
        padding: 10px 12px;
        background: rgba(0, 0, 0, 0.85);
        color: #ff00ff;
        border: 2px solid #ff00ff;
        box-shadow: 0 0 10px rgba(255, 0, 255, 0.3);
        outline: none;
        text-align: center;
      }
      .draw-prompt-input::placeholder { color: #884488; }
      .draw-prompt-input:focus {
        box-shadow: 0 0 20px rgba(255, 0, 255, 0.6);
      }

      .draw-start-btn {
        font-family: 'Press Start 2P', monospace;
        font-size: 14px;
        padding: 14px 28px;
        background: rgba(0, 0, 0, 0.85);
        color: #00ff00;
        border: 3px solid #00ff00;
        cursor: pointer;
        text-transform: uppercase;
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.4);
        transition: all 0.2s;
        letter-spacing: 2px;
      }
      .draw-start-btn:hover:not(:disabled) {
        background: rgba(0, 255, 0, 0.2);
        box-shadow: 0 0 30px rgba(0, 255, 0, 0.7);
        transform: scale(1.08);
      }
      .draw-start-btn:active:not(:disabled) { transform: scale(0.95); }
      .draw-start-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
        color: #555;
        border-color: #555;
        box-shadow: none;
      }

      .draw-timer {
        font-size: 28px;
        color: #00ff00;
        text-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
        letter-spacing: 4px;
        transition: color 0.3s, text-shadow 0.3s;
      }
      .draw-timer.warn {
        color: #ff3333;
        text-shadow: 0 0 20px rgba(255, 50, 50, 0.7);
        animation: timerPulse 0.6s ease-in-out infinite alternate;
      }
      @keyframes timerPulse {
        from { text-shadow: 0 0 10px rgba(255, 50, 50, 0.5); }
        to   { text-shadow: 0 0 30px rgba(255, 50, 50, 0.9), 0 0 60px rgba(255, 0, 0, 0.4); }
      }

      .draw-prompt-display {
        font-size: 8px;
        color: #ff00ff;
        text-align: center;
        max-width: 100%;
        word-break: break-word;
        text-shadow: 0 0 6px rgba(255, 0, 255, 0.4);
      }

      /* ── Model select section ── */
      .draw-select-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
      }

      .draw-select-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        width: 90%;
        max-width: 800px;
        margin-bottom: 16px;
      }

      .draw-select-col {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .draw-select-col-title {
        font-size: 12px;
        text-align: center;
        margin-bottom: 6px;
      }
      .draw-select-col.left .draw-select-col-title  { color: #00ffff; text-shadow: 0 0 10px #00ffff; }
      .draw-select-col.right .draw-select-col-title { color: #ff00ff; text-shadow: 0 0 10px #ff00ff; }

      .draw-model-card {
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        padding: 10px 14px;
        background: rgba(20, 20, 20, 0.9);
        border: 2px solid #555;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        color: #ccc;
      }
      .draw-model-card:hover {
        border-color: #00ff00;
        box-shadow: 0 0 12px rgba(0, 255, 0, 0.4);
        transform: scale(1.03);
      }
      .draw-select-col.left .draw-model-card.selected {
        border-color: #00ffff;
        background: rgba(0, 255, 255, 0.12);
        box-shadow: 0 0 18px rgba(0, 255, 255, 0.5);
        color: #00ffff;
      }
      .draw-select-col.right .draw-model-card.selected {
        border-color: #ff00ff;
        background: rgba(255, 0, 255, 0.12);
        box-shadow: 0 0 18px rgba(255, 0, 255, 0.5);
        color: #ff00ff;
      }

      .draw-model-list {
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .draw-model-list::-webkit-scrollbar { width: 4px; }
      .draw-model-list::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.5); }
      .draw-model-list::-webkit-scrollbar-thumb { background: #00ff00; }

      /* ── Result overlay ── */
      .draw-result-overlay {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 60;
        gap: 16px;
      }

      .draw-result-title {
        font-size: 32px;
        color: #ffff00;
        text-shadow: 0 0 30px #ffff00, 0 0 60px rgba(255, 255, 0, 0.4);
        animation: resultFlash 0.8s ease-in-out infinite alternate;
        letter-spacing: 4px;
      }
      @keyframes resultFlash {
        from { text-shadow: 0 0 15px #ffff00; }
        to   { text-shadow: 0 0 40px #ffff00, 0 0 80px rgba(255, 200, 0, 0.5); }
      }

      .draw-result-stats {
        display: flex;
        gap: 40px;
        font-size: 10px;
      }
      .draw-result-stat {
        text-align: center;
      }
      .draw-result-stat .stat-label {
        font-size: 8px;
        color: #888;
        margin-bottom: 4px;
      }
      .draw-result-stat.left .stat-value  { color: #00ffff; }
      .draw-result-stat.right .stat-value { color: #ff00ff; }

      .draw-play-again-btn {
        font-family: 'Press Start 2P', monospace;
        font-size: 12px;
        padding: 12px 24px;
        background: rgba(0, 0, 0, 0.85);
        color: #ffff00;
        border: 2px solid #ffff00;
        cursor: pointer;
        box-shadow: 0 0 12px rgba(255, 255, 0, 0.3);
        transition: all 0.2s;
        margin-top: 10px;
      }
      .draw-play-again-btn:hover {
        background: rgba(255, 255, 0, 0.15);
        box-shadow: 0 0 25px rgba(255, 255, 0, 0.6);
        transform: scale(1.06);
      }

      /* ── Responsive ── */
      @media (max-width: 800px) {
        .draw-arena { flex-direction: column; align-items: center; }
        .draw-center { flex-direction: row; flex-wrap: wrap; justify-content: center; min-width: 0; max-width: 100%; padding: 8px; }
        .draw-canvas-col { max-width: 320px; }
        .draw-title { font-size: 14px; }
        .draw-timer { font-size: 20px; }
        .draw-select-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
    this.styleEl = style;
  }

  // ── DOM construction ──

  _buildDOM(container) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'draw-overlay game-overlay';

    // Title
    const title = document.createElement('div');
    title.className = 'draw-title';
    title.textContent = '\u{1F3A8} LLM DRAW ARENA';
    this.overlay.appendChild(title);

    // Arena (canvases + center)
    const arena = document.createElement('div');
    arena.className = 'draw-arena';

    // Left canvas column
    const leftCol = this._buildCanvasColumn('left');
    arena.appendChild(leftCol.col);
    this.leftCanvas = leftCol.canvas;
    this.leftModelLabel = leftCol.label;
    this.leftStatsEl = leftCol.stats;
    this.leftThoughtEl = leftCol.thought;

    // Center column
    const center = this._buildCenter();
    arena.appendChild(center);

    // Right canvas column
    const rightCol = this._buildCanvasColumn('right');
    arena.appendChild(rightCol.col);
    this.rightCanvas = rightCol.canvas;
    this.rightModelLabel = rightCol.label;
    this.rightStatsEl = rightCol.stats;
    this.rightThoughtEl = rightCol.thought;

    this.overlay.appendChild(arena);

    // Init PaintTool instances
    this.leftPaint = new PaintTool(this.leftCanvas);
    this.rightPaint = new PaintTool(this.rightCanvas);
    this.leftPaint.fillBackground('#ffffff');
    this.rightPaint.fillBackground('#ffffff');

    container.appendChild(this.overlay);
  }

  _buildCanvasColumn(side) {
    const col = document.createElement('div');
    col.className = `draw-canvas-col ${side}`;

    const wrap = document.createElement('div');
    wrap.className = 'draw-canvas-wrap';

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    wrap.appendChild(canvas);
    col.appendChild(wrap);

    const label = document.createElement('div');
    label.className = 'draw-model-label';
    label.textContent = '---';
    col.appendChild(label);

    const stats = document.createElement('div');
    stats.className = 'draw-stats';
    stats.textContent = 'Commands: 0';
    col.appendChild(stats);

    const thought = document.createElement('div');
    thought.className = 'draw-thought';
    thought.textContent = '';
    col.appendChild(thought);

    return { col, canvas, label, stats, thought };
  }

  _buildCenter() {
    const center = document.createElement('div');
    center.className = 'draw-center';

    // Prompt display (shown during drawing)
    this.promptDisplay = document.createElement('div');
    this.promptDisplay.className = 'draw-prompt-display';
    this.promptDisplay.style.display = 'none';
    center.appendChild(this.promptDisplay);

    // Timer
    this.timerEl = document.createElement('div');
    this.timerEl.className = 'draw-timer';
    this.timerEl.textContent = '5:00';
    this.timerEl.style.display = 'none';
    center.appendChild(this.timerEl);

    // Prompt input
    this.promptInput = document.createElement('input');
    this.promptInput.type = 'text';
    this.promptInput.className = 'draw-prompt-input';
    this.promptInput.placeholder = 'Enter prompt...';
    this.promptInput.maxLength = 120;
    center.appendChild(this.promptInput);

    // Start button
    this.startBtn = document.createElement('button');
    this.startBtn.className = 'draw-start-btn';
    this.startBtn.textContent = 'START';
    this.startBtn.disabled = true;
    center.appendChild(this.startBtn);

    return center;
  }

  // ── Model selection ──

  showModelSelect(models, onStart) {
    // Remove any existing select section
    if (this.selectSection) this.selectSection.remove();

    this.selectSection = document.createElement('div');
    this.selectSection.className = 'draw-select-section';

    const grid = document.createElement('div');
    grid.className = 'draw-select-grid';

    let leftModel = null;
    let rightModel = null;

    const buildCol = (side) => {
      const col = document.createElement('div');
      col.className = `draw-select-col ${side}`;

      const colTitle = document.createElement('div');
      colTitle.className = 'draw-select-col-title';
      colTitle.textContent = side === 'left' ? 'LEFT ARTIST' : 'RIGHT ARTIST';
      col.appendChild(colTitle);

      const list = document.createElement('div');
      list.className = 'draw-model-list';

      models.forEach(m => {
        const card = document.createElement('div');
        card.className = 'draw-model-card';
        card.textContent = m.name || m.id || m;
        card.addEventListener('click', () => {
          list.querySelectorAll('.draw-model-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          if (side === 'left') {
            leftModel = m.id || m;
            this.leftModelLabel.textContent = m.name || m.id || m;
          } else {
            rightModel = m.id || m;
            this.rightModelLabel.textContent = m.name || m.id || m;
          }
          this._updateStartButton(leftModel, rightModel, this.promptInput.value);
        });
        list.appendChild(card);
      });
      col.appendChild(list);
      return col;
    };

    grid.appendChild(buildCol('left'));
    grid.appendChild(buildCol('right'));
    this.selectSection.appendChild(grid);

    // Insert select section before the arena
    const arena = this.overlay.querySelector('.draw-arena');
    this.overlay.insertBefore(this.selectSection, arena);

    // Wire start button
    this.promptInput.addEventListener('input', () => {
      this._updateStartButton(leftModel, rightModel, this.promptInput.value);
    });

    // Also allow Enter key on prompt to start
    this.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.startBtn.disabled) {
        this.startBtn.click();
      }
    });

    this.startBtn.onclick = () => {
      if (leftModel && rightModel && this.promptInput.value.trim()) {
        onStart(leftModel, rightModel, this.promptInput.value.trim());
      }
    };
  }

  _updateStartButton(left, right, prompt) {
    this.startBtn.disabled = !(left && right && prompt && prompt.trim().length > 0);
  }

  // ── Drawing mode ──

  showDrawing(prompt) {
    // Hide select section
    if (this.selectSection) this.selectSection.style.display = 'none';

    // Hide prompt input and start button
    this.promptInput.style.display = 'none';
    this.startBtn.style.display = 'none';

    // Show prompt display
    this.promptDisplay.textContent = `"${prompt}"`;
    this.promptDisplay.style.display = '';

    // Show timer
    this.timerEl.style.display = '';
    this.timerEl.textContent = '5:00';
    this.timerEl.classList.remove('warn');

    // Clear canvases to white
    this.leftPaint.clear();
    this.rightPaint.clear();
    this.leftPaint.fillBackground('#ffffff');
    this.rightPaint.fillBackground('#ffffff');
  }

  // ── Timer ──

  updateTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    this.timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;

    if (seconds <= 30) {
      this.timerEl.classList.add('warn');
    } else {
      this.timerEl.classList.remove('warn');
    }
  }

  // ── Stats ──

  updateStats(leftCount, rightCount) {
    if (this.leftStatsEl)  this.leftStatsEl.textContent  = `Commands: ${leftCount}`;
    if (this.rightStatsEl) this.rightStatsEl.textContent = `Commands: ${rightCount}`;
  }

  // ── Thought display ──

  updateThought(side, text) {
    const el = side === 'left' ? this.leftThoughtEl : this.rightThoughtEl;
    if (el) el.textContent = text || '';
  }

  // ── Result screen ──

  showResult(stats, onPlayAgain) {
    if (this.resultSection) this.resultSection.remove();

    this.resultSection = document.createElement('div');
    this.resultSection.className = 'draw-result-overlay';

    const title = document.createElement('div');
    title.className = 'draw-result-title';
    title.textContent = "TIME'S UP!";
    this.resultSection.appendChild(title);

    const statsRow = document.createElement('div');
    statsRow.className = 'draw-result-stats';

    const leftStat = document.createElement('div');
    leftStat.className = 'draw-result-stat left';
    leftStat.innerHTML = `
      <div class="stat-label">${stats.leftModel || 'LEFT'}</div>
      <div class="stat-value">${stats.leftCommands || 0} cmds</div>
    `;
    statsRow.appendChild(leftStat);

    const rightStat = document.createElement('div');
    rightStat.className = 'draw-result-stat right';
    rightStat.innerHTML = `
      <div class="stat-label">${stats.rightModel || 'RIGHT'}</div>
      <div class="stat-value">${stats.rightCommands || 0} cmds</div>
    `;
    statsRow.appendChild(rightStat);
    this.resultSection.appendChild(statsRow);

    const btn = document.createElement('button');
    btn.className = 'draw-play-again-btn';
    btn.textContent = 'PLAY AGAIN';
    btn.addEventListener('click', () => {
      if (onPlayAgain) onPlayAgain();
    });
    this.resultSection.appendChild(btn);

    this.overlay.appendChild(this.resultSection);
  }

  hideResult() {
    if (this.resultSection) {
      this.resultSection.remove();
      this.resultSection = null;
    }
  }

  // ── Reset to selection state ──

  resetToSelect() {
    this.hideResult();

    // Show select section
    if (this.selectSection) this.selectSection.style.display = '';

    // Show prompt input and start button
    this.promptInput.style.display = '';
    this.promptInput.value = '';
    this.startBtn.style.display = '';
    this.startBtn.disabled = true;

    // Hide timer and prompt display
    this.timerEl.style.display = 'none';
    this.promptDisplay.style.display = 'none';

    // Reset labels
    this.leftModelLabel.textContent = '---';
    this.rightModelLabel.textContent = '---';
    this.leftStatsEl.textContent = 'Commands: 0';
    this.rightStatsEl.textContent = 'Commands: 0';
    this.leftThoughtEl.textContent = '';
    this.rightThoughtEl.textContent = '';

    // Clear canvases
    this.leftPaint.clear();
    this.rightPaint.clear();
    this.leftPaint.fillBackground('#ffffff');
    this.rightPaint.fillBackground('#ffffff');

    // Deselect model cards
    if (this.selectSection) {
      this.selectSection.querySelectorAll('.draw-model-card').forEach(c => c.classList.remove('selected'));
    }
  }
}

window.DrawRenderer = DrawRenderer;
