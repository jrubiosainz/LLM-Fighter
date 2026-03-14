// app.js — Game Router / Multi-game shell
// Manages which game is active and provides the game selector UI

class GameApp {
  constructor() {
    this.currentGame = null;
    this.currentGameType = null;
    this.selectorEl = null;
    this.createSelector();
    this.switchGame('fight');
  }

  createSelector() {
    const nav = document.createElement('nav');
    nav.className = 'game-selector';
    nav.innerHTML = `
      <button class="game-tab fight-tab" data-game="fight">⚔️ FIGHT</button>
      <button class="game-tab chess-tab" data-game="chess">♟️ CHESS</button>
      <button class="game-tab draw-tab" data-game="draw">🎨 DRAW</button>
    `;
    document.body.appendChild(nav);
    this.selectorEl = nav;

    nav.querySelectorAll('.game-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const game = btn.dataset.game;
        if (game !== this.currentGameType) {
          this.switchGame(game);
        }
      });
    });
  }

  switchGame(gameType) {
    // Destroy current game
    if (this.currentGame && this.currentGame.destroy) {
      try { this.currentGame.destroy(); } catch (e) { console.warn('Game destroy error:', e); }
    }
    this.currentGame = null;

    // Remove any game-specific overlays
    document.querySelectorAll('.game-overlay, .select-overlay, .victory-overlay, .coming-soon-overlay').forEach(el => el.remove());

    this.currentGameType = gameType;

    switch (gameType) {
      case 'fight':
        this.showFightUI(true);
        if (window.Game) {
          this.currentGame = new Game();
          this.currentGame.init();
        } else {
          this.showComingSoon('Fight');
        }
        break;

      case 'chess':
        this.showFightUI(false);
        if (window.ChessGame) {
          this.currentGame = new ChessGame();
          this.currentGame.init();
        } else {
          this.showComingSoon('Chess');
        }
        break;

      case 'draw':
        this.showFightUI(false);
        if (window.DrawGame) {
          this.currentGame = new DrawGame();
          this.currentGame.init();
        } else {
          this.showComingSoon('Draw');
        }
        break;
    }

    this.updateTabs(gameType);
  }

  /** Show/hide fight-specific UI elements */
  showFightUI(visible) {
    const fightEls = [
      document.querySelector('.thought-strip'),
      document.querySelector('.game-footer')
    ];
    fightEls.forEach(el => {
      if (el) el.style.display = visible ? '' : 'none';
    });
  }

  showComingSoon(name) {
    const overlay = document.createElement('div');
    overlay.className = 'coming-soon-overlay game-overlay';
    overlay.innerHTML = `
      <div class="coming-soon-title">🚧 ${name.toUpperCase()}</div>
      <div class="coming-soon-text">COMING SOON</div>
      <div class="coming-soon-sub">This arena is under construction</div>
    `;
    document.querySelector('.game-stage').appendChild(overlay);
  }

  updateTabs(active) {
    if (!this.selectorEl) return;
    this.selectorEl.querySelectorAll('.game-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.game === active);
    });
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new GameApp();
  window.addEventListener('beforeunload', () => {
    if (window.gameApp && window.gameApp.currentGame && window.gameApp.currentGame.destroy) {
      window.gameApp.currentGame.destroy();
    }
  });
});
