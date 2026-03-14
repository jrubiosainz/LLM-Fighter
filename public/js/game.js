// game.js — Main game orchestrator
// Wires together GameEngine, GameRenderer, and AIController

class Game {
  constructor() {
    this.engine = null;
    this.renderer = null;
    this.aiController = null;
    this.models = [];
    this.selectedModels = { p1: null, p2: null };
    this.tickTimeout = null;
    this.renderLoop = null;
    this.timerInterval = null;
    this.phase = 'select';
    this.TICK_DELAY = 2500;
    this.AI_TIMEOUT = 8000;
    this.waitingForAI = false;
  }

  async init() {
    try {
      const canvas = document.getElementById('gameCanvas');
      const leftPanel = document.getElementById('leftThought');
      const rightPanel = document.getElementById('rightThought');

      this.engine = new window.GameEngine();
      this.renderer = new window.GameRenderer(canvas, leftPanel, rightPanel);

      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.aiController = new window.AIController(`${wsProtocol}//${location.host}`);

      this.aiController.onThought((side, text) => {
        this.renderer.updateThought(side, text);
      });

      // Wire footer buttons
      document.getElementById('selectBtn').addEventListener('click', () => this.startCharacterSelect());
      document.getElementById('fightBtn').addEventListener('click', () => {
        if (this.selectedModels.p1 && this.selectedModels.p2) this.startMatch();
      });

      // Start continuous render loop
      this.startRenderLoop();

      await this.startCharacterSelect();
    } catch (error) {
      console.error('Failed to initialize game:', error);
    }
  }

  startRenderLoop() {
    const loop = () => {
      if (this.engine) {
        const state = this.engine.getState();
        state._phase = this.phase; // overlay local phase for intro display
        this.renderer.render(state);
      }
      this.renderLoop = requestAnimationFrame(loop);
    };
    loop();
  }

  async startCharacterSelect() {
    this.stopFight();
    this.phase = 'select';
    this.selectedModels = { p1: null, p2: null };
    this.engine.reset();

    // Update panel model names
    document.getElementById('leftModel').textContent = '---';
    document.getElementById('rightModel').textContent = '---';
    document.getElementById('leftThought').innerHTML = '<p>Awaiting selection...</p>';
    document.getElementById('rightThought').innerHTML = '<p>Awaiting selection...</p>';
    document.getElementById('fightBtn').disabled = true;

    try {
      this.models = await this.aiController.fetchModels();
    } catch (e) {
      console.warn('Using fallback model list');
      this.models = [
        'gpt-4.1', 'gpt-5-mini', 'gpt-5.1', 'gpt-5.2',
        'claude-haiku-4.5', 'claude-sonnet-4.5', 'claude-opus-4.6',
        'gemini-3-pro', 'o3-mini'
      ];
    }

    this.renderer.showCharacterSelect(this.models, (side, modelId) => {
      if (side === 'p1') {
        this.selectedModels.p1 = modelId;
        document.getElementById('leftModel').textContent = modelId;
      } else {
        this.selectedModels.p2 = modelId;
        document.getElementById('rightModel').textContent = modelId;
      }

      if (this.selectedModels.p1 && this.selectedModels.p2) {
        this.startMatch();
      }
    });
  }

  async startMatch() {
    this.engine.reset();
    this.engine.setModels(this.selectedModels.p1, this.selectedModels.p2);

    document.getElementById('leftThought').innerHTML = '<p>Preparing for battle...</p>';
    document.getElementById('rightThought').innerHTML = '<p>Preparing for battle...</p>';

    try {
      await this.aiController.startFight(this.selectedModels.p1, this.selectedModels.p2);
    } catch (e) {
      console.warn('Could not start fight on server, continuing in demo mode');
    }

    this.startRound(1);
  }

  startRound(roundNumber) {
    this.phase = 'intro';
    this.engine.startRound(roundNumber);

    // Show ROUND X / FIGHT! intro for 3 seconds, then start fighting
    setTimeout(() => {
      this.phase = 'fighting';
      this.startTimer();
      this.scheduleTick();
    }, 3000);
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    // Decrement the engine timer every second
    this.timerInterval = setInterval(() => {
      if (this.phase !== 'fighting') {
        clearInterval(this.timerInterval);
        return;
      }
      if (this.engine.gameState.timer > 0) {
        this.engine.gameState.timer--;
      }
    }, 1000);
  }

  scheduleTick() {
    if (this.phase !== 'fighting') return;
    this.tickTimeout = setTimeout(() => this.processTick(), this.TICK_DELAY);
  }

  async processTick() {
    if (this.phase !== 'fighting') return;
    if (this.waitingForAI) return;
    this.waitingForAI = true;

    try {
      const gameState = this.engine.getState();

      // Check if round already ended (timer ran out between ticks)
      if (gameState.timer <= 0 || gameState.players.p1.health <= 0 || gameState.players.p2.health <= 0) {
        this.engine.executeTick('idle', 'idle'); // trigger engine's round-end check
        this.handleRoundEnd();
        return;
      }

      let result;
      try {
        result = await Promise.race([
          this.aiController.requestActions(gameState),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), this.AI_TIMEOUT))
        ]);
      } catch (e) {
        result = {
          p1: { action: 'idle', thought: '⏳ Thinking...' },
          p2: { action: 'idle', thought: '⏳ Thinking...' }
        };
      }

      const p1Action = result.p1?.action || 'idle';
      const p2Action = result.p2?.action || 'idle';

      // Update thought panels with latest reasoning
      if (result.p1?.thought) this.renderer.updateThought('left', `🎯 ${p1Action}: ${result.p1.thought}`);
      if (result.p2?.thought) this.renderer.updateThought('right', `🎯 ${p2Action}: ${result.p2.thought}`);

      this.engine.executeTick(p1Action, p2Action);
      const newState = this.engine.getState();

      // Check round end after tick
      if (newState.phase === 'round_end' || newState.phase === 'match_end') {
        this.handleRoundEnd();
      } else {
        this.waitingForAI = false;
        // During hitstop, schedule next tick faster — engine will decrement hitstop naturally
        const delay = newState.hitstopFrames > 0 ? Math.floor(this.TICK_DELAY / 4) : this.TICK_DELAY;
        this.tickTimeout = setTimeout(() => this.processTick(), delay);
      }
    } catch (error) {
      console.error('Tick error:', error);
      this.waitingForAI = false;
      this.scheduleTick();
    }
  }

  handleRoundEnd() {
    this.phase = 'round_end';
    this.waitingForAI = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.tickTimeout) clearTimeout(this.tickTimeout);

    const state = this.engine.getState();
    // Engine already updated roundWins — don't double-count

    // Notify AI agents about round result
    const p1Health = state.players.p1.health;
    const p2Health = state.players.p2.health;
    const lastWinner = p1Health >= p2Health ? 'left' : 'right';

    try {
      this.aiController.sendRoundEnd({
        round: state.round,
        winner: lastWinner,
        yourHealth: p1Health,
        oppHealth: p2Health
      });
    } catch (e) { /* non-critical */ }

    // Show KO for 3 seconds, then check match
    setTimeout(() => {
      if (state.phase === 'match_end' || state.roundWins.p1 >= 2 || state.roundWins.p2 >= 2) {
        this.endMatch(state.roundWins);
      } else {
        this.startRound(state.round + 1);
      }
    }, 3000);
  }

  endMatch(roundWins) {
    this.phase = 'match_end';
    const winnerModel = roundWins.p1 >= 2 ? this.selectedModels.p1 : this.selectedModels.p2;
    const winnerSide = roundWins.p1 >= 2 ? 'P1' : 'P2';

    this.renderer.updateThought('left', roundWins.p1 >= 2 ? '🏆 VICTORY!' : '💀 DEFEATED');
    this.renderer.updateThought('right', roundWins.p2 >= 2 ? '🏆 VICTORY!' : '💀 DEFEATED');

    if (typeof this.renderer.showVictoryScreen === 'function') {
      this.renderer.showVictoryScreen(winnerSide, winnerModel, roundWins, () => {
        this.startCharacterSelect();
      });
    } else {
      // Fallback until Trinity ships the victory screen
      setTimeout(() => this.startCharacterSelect(), 5000);
    }
  }

  stopFight() {
    if (this.tickTimeout) { clearTimeout(this.tickTimeout); this.tickTimeout = null; }
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    this.waitingForAI = false;
    try { this.aiController.endFight(); } catch (e) { /* ok */ }
  }

  destroy() {
    this.stopFight();
    if (this.renderLoop) cancelAnimationFrame(this.renderLoop);
    if (this.aiController) this.aiController.close();
  }
}

window.Game = Game;
// Lifecycle managed by GameApp (app.js)
