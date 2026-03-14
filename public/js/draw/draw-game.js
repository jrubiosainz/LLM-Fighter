// draw-game.js — Draw game orchestrator
// Manages WebSocket, timer, and draw ticks for the LLM Draw Arena

class DrawGame {
  constructor() {
    this.renderer = null;
    this.ws = null;
    this.models = { left: null, right: null };
    this.prompt = '';
    this.timeRemaining = 300; // 5 minutes
    this.timerInterval = null;
    this.drawInterval = null;
    this.destroyed = false;
    this.phase = 'select'; // 'select' | 'drawing' | 'done'
    this.pendingTicks = 0;
    this.TICK_INTERVAL = 2500;
    this.DRAW_DURATION = 300;
  }

  // ── Public API (called by GameApp) ──

  init() {
    this.renderer = new DrawRenderer();
    this.renderer.init(document.querySelector('.game-stage'));
    this.connectWebSocket();
    this.fetchModels();
  }

  destroy() {
    this.destroyed = true;
    this.phase = 'done';
    this._clearIntervals();
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }
  }

  // ── WebSocket ──

  connectWebSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}`);

    this.ws.onopen = () => {
      console.log('[DrawGame] WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      if (this.destroyed) return;
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (e) {
        console.error('[DrawGame] Message parse error:', e);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[DrawGame] WebSocket error:', err);
    };

    this.ws.onclose = () => {
      console.log('[DrawGame] WebSocket closed');
      if (!this.destroyed && this.phase === 'drawing') {
        this._reconnect();
      }
    };
  }

  _reconnect() {
    if (this.destroyed) return;
    setTimeout(() => {
      if (!this.destroyed && this.phase === 'drawing') {
        console.log('[DrawGame] Attempting reconnect...');
        this.connectWebSocket();
      }
    }, 2000);
  }

  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ game: 'draw', ...data }));
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'draw_started':
        console.log('[DrawGame] Draw session started');
        this._beginDrawLoop();
        break;

      case 'draw_commands': {
        const side = msg.side || 'left';
        const commands = msg.commands;
        const thought = msg.thought || '';

        if (Array.isArray(commands) && this.renderer) {
          const paint = side === 'left' ? this.renderer.leftPaint : this.renderer.rightPaint;
          if (paint) {
            paint.executeCommands(commands);
          }
          // Update stats
          const lc = this.renderer.leftPaint ? this.renderer.leftPaint.getStats().commandCount : 0;
          const rc = this.renderer.rightPaint ? this.renderer.rightPaint.getStats().commandCount : 0;
          this.renderer.updateStats(lc, rc);
        }
        if (thought && this.renderer) {
          this.renderer.updateThought(msg.side || 'left', thought);
        }
        this.pendingTicks = Math.max(0, this.pendingTicks - 1);
        break;
      }

      case 'draw_result':
        // Response to individual draw_command
        break;

      case 'error':
        console.warn('[DrawGame] Server error:', msg.message);
        this.pendingTicks = Math.max(0, this.pendingTicks - 1);
        break;

      default:
        break;
    }
  }

  // ── Fetch models ──

  async fetchModels() {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      const models = data.models || [];

      if (models.length === 0) {
        console.warn('[DrawGame] No models available');
        return;
      }

      this.renderer.showModelSelect(models, (left, right, prompt) => {
        this._onStart(left, right, prompt);
      });
    } catch (e) {
      console.error('[DrawGame] Failed to fetch models:', e);
      // Provide fallback models
      const fallback = [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }
      ];
      this.renderer.showModelSelect(fallback, (left, right, prompt) => {
        this._onStart(left, right, prompt);
      });
    }
  }

  // ── Start drawing ──

  _onStart(leftModel, rightModel, prompt) {
    this.models.left = leftModel;
    this.models.right = rightModel;
    this.prompt = prompt;
    this.timeRemaining = this.DRAW_DURATION;
    this.phase = 'drawing';
    this.pendingTicks = 0;

    this.renderer.showDrawing(prompt);

    this._send({
      type: 'start_draw',
      model1: leftModel,
      model2: rightModel,
      prompt: prompt
    });
  }

  // ── Draw loop ──

  _beginDrawLoop() {
    if (this.destroyed) return;

    // Timer countdown (every second)
    this.timerInterval = setInterval(() => {
      if (this.destroyed || this.phase !== 'drawing') return;

      this.timeRemaining--;
      if (this.renderer) this.renderer.updateTimer(this.timeRemaining);

      if (this.timeRemaining <= 0) {
        this._endDraw();
      }
    }, 1000);

    // Draw tick (every TICK_INTERVAL ms, alternating sides)
    let tickSide = 'left';
    this.drawInterval = setInterval(() => {
      if (this.destroyed || this.phase !== 'drawing') return;
      if (this.pendingTicks >= 4) return; // throttle: don't pile up requests

      this._send({
        type: 'draw_tick',
        side: tickSide,
        timeRemaining: this.timeRemaining,
        canvasWidth: 400,
        canvasHeight: 400,
        prompt: this.prompt
      });
      this.pendingTicks++;

      tickSide = tickSide === 'left' ? 'right' : 'left';
    }, this.TICK_INTERVAL);

    // Send initial tick for both sides immediately
    this._send({
      type: 'draw_tick',
      side: 'left',
      timeRemaining: this.timeRemaining,
      canvasWidth: 400,
      canvasHeight: 400,
      prompt: this.prompt
    });
    this.pendingTicks++;

    setTimeout(() => {
      if (this.destroyed) return;
      this._send({
        type: 'draw_tick',
        side: 'right',
        timeRemaining: this.timeRemaining,
        canvasWidth: 400,
        canvasHeight: 400,
        prompt: this.prompt
      });
      this.pendingTicks++;
    }, 500);
  }

  // ── End drawing ──

  _endDraw() {
    this.phase = 'done';
    this._clearIntervals();

    this._send({ type: 'end_draw' });

    if (this.renderer) {
      const lc = this.renderer.leftPaint ? this.renderer.leftPaint.getStats().commandCount : 0;
      const rc = this.renderer.rightPaint ? this.renderer.rightPaint.getStats().commandCount : 0;

      this.renderer.showResult({
        leftModel: this.models.left,
        rightModel: this.models.right,
        leftCommands: lc,
        rightCommands: rc
      }, () => {
        this._playAgain();
      });
    }
  }

  // ── Play again ──

  _playAgain() {
    this._clearIntervals();
    this.phase = 'select';
    this.timeRemaining = this.DRAW_DURATION;
    this.pendingTicks = 0;

    if (this.renderer) {
      this.renderer.resetToSelect();
    }

    this.fetchModels();
  }

  // ── Cleanup helper ──

  _clearIntervals() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.drawInterval) {
      clearInterval(this.drawInterval);
      this.drawInterval = null;
    }
  }
}

window.DrawGame = DrawGame;
