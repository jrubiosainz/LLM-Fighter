// app.js — Game Router / Multi-game shell
// Shows a full-screen arcade game selector, then launches the chosen game

class GameApp {
  constructor() {
    this.currentGame = null;
    this.currentGameType = null;
    this.menuEl = null;
    this.backBtn = null;
    this.showMainMenu();
  }

  /** Full-screen arcade game selector */
  showMainMenu() {
    // Destroy any running game
    if (this.currentGame && this.currentGame.destroy) {
      try { this.currentGame.destroy(); } catch (e) { /* ok */ }
    }
    this.currentGame = null;
    this.currentGameType = null;

    // Remove leftover overlays
    document.querySelectorAll('.game-overlay, .select-overlay, .victory-overlay, .coming-soon-overlay, .arena-menu').forEach(el => el.remove());
    if (this.backBtn) { this.backBtn.remove(); this.backBtn = null; }

    // Hide fight-specific UI
    this.showFightUI(false);

    // Hide canvas while on menu
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.style.display = 'none';

    // Build the menu
    const menu = document.createElement('div');
    menu.className = 'arena-menu';
    menu.innerHTML = `
      <div class="arena-menu-title">LLM ARENA</div>
      <div class="arena-menu-subtitle">CHOOSE YOUR CHALLENGE</div>
      <div class="arena-menu-cards">
        <button class="arena-card fight-card" data-game="fight">
          <span class="arena-card-icon">⚔️</span>
          <span class="arena-card-name">FIGHT</span>
          <span class="arena-card-desc">Street Fighter-style AI combat</span>
        </button>
        <button class="arena-card chess-card" data-game="chess">
          <span class="arena-card-icon">♟️</span>
          <span class="arena-card-name">CHESS</span>
          <span class="arena-card-desc">3D isometric chess battle</span>
        </button>
        <button class="arena-card draw-card" data-game="draw">
          <span class="arena-card-icon">🎨</span>
          <span class="arena-card-name">DRAW</span>
          <span class="arena-card-desc">AI art duel — paint a prompt</span>
        </button>
      </div>
      <div class="arena-menu-hint">SELECT A MODE TO BEGIN</div>
    `;
    document.body.appendChild(menu);
    this.menuEl = menu;

    menu.querySelectorAll('.arena-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const game = btn.dataset.game;
        this.launchGame(game);
      });
    });
  }

  launchGame(gameType) {
    // Remove menu
    if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }

    // Show canvas again
    const canvas = document.getElementById('gameCanvas');
    if (canvas) canvas.style.display = '';

    this.currentGameType = gameType;

    // Create back button
    this.backBtn = document.createElement('button');
    this.backBtn.className = 'arena-back-btn';
    this.backBtn.textContent = '← MENU';
    this.backBtn.addEventListener('click', () => this.showMainMenu());
    document.body.appendChild(this.backBtn);

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
  }

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
