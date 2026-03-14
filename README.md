# 🏟️ LLM Arena

> Multi-game AI arena where LLM models compete in Fight, Chess, and Draw challenges

![HTML5](https://img.shields.io/badge/HTML5-Canvas-orange) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-blue)

## What is this?

LLM Arena is a multi-game platform where **AI models** (GPT, Claude, Gemini, etc.) compete against each other in three different challenges. Pick two models, choose a game mode, and watch them battle!

### 🎮 Game Modes

| Mode | Description |
|------|-------------|
| ⚔️ **Fight** | Street Fighter-style arcade fighting — 13 combat actions, super meter, hitstop, combos |
| ♟️ **Chess** | Isometric 3D chess — AI models play full games with move reasoning displayed in real-time |
| 🎨 **Draw** | AI art challenge — two models draw on canvases for 5 minutes based on a user prompt |

### Features

- 🤖 **AI personalities** — each model family has unique style per game mode
- 🎨 **Arcade aesthetic** — CRT scanlines, neon glow, pixel art, Press Start 2P font
- 💬 **Live AI thoughts** — watch each model's strategy/reasoning in real-time
- 🔄 **Game selector** — switch between modes instantly from the top-left tab bar

## Quick Start

```bash
# Clone
git clone https://github.com/jrubiosainz/LLM-Fighter.git
cd LLM-Fighter

# Install dependencies
npm install

# Run
npm start
```

Open **http://localhost:3000** in your browser. Use the game selector tabs (top-left) to switch between Fight, Chess, and Draw modes.

> **Note:** The game runs in demo/fallback mode without the Copilot SDK. AI decisions use built-in strategy engines with model-specific personalities. For full LLM-powered decisions, configure `@github/copilot-sdk`.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML5 Canvas, CSS3, vanilla JavaScript |
| Server | Node.js, Express, WebSocket (ws) |
| AI | Strategy engines with model personalities (optional: GitHub Copilot SDK) |
| Game Engine | Deterministic state machines, frame-based combat, chess rules |

## Architecture

```
public/
├── index.html              # Game shell + game selector
├── css/style.css           # Arcade UI, CRT effects, neon styling
├── js/
│   ├── app.js              # Game selector router (Fight/Chess/Draw)
│   ├── engine.js           # Fight: pure combat logic
│   ├── renderer.js         # Fight: canvas rendering, sprites, effects
│   ├── ai-controller.js    # Fight: WebSocket client, thought formatting
│   ├── game.js             # Fight: main orchestrator
│   ├── chess/
│   │   ├── chess-engine.js # Chess rules (FEN, algebraic, check/checkmate)
│   │   ├── chess-renderer.js # Isometric 3D board rendering
│   │   └── chess-game.js   # Chess orchestrator
│   └── draw/
│       ├── paint-tool.js   # Programmatic paint API (15 commands)
│       ├── draw-renderer.js # Dual canvas UI, timer, stats
│       └── draw-game.js    # Draw orchestrator
server.js                   # Express + multi-game WebSocket routing
ai-agent.js                 # Fight AI (model personalities)
chess-agent.js              # Chess AI (move scoring, model styles)
draw-agent.js               # Draw AI (procedural art, time-phased composition)
```

## Combat System

| Action | Damage | Range | Speed | Notes |
|--------|--------|-------|-------|-------|
| High Punch | 8 | 80 | Fast | — |
| Low Punch | 6 | 70 | Fastest | — |
| High Kick | 12 | 100 | Medium | — |
| Low Kick | 10 | 90 | Medium | — |
| Uppercut | 18 | 70 | Slow | High risk, high reward |
| Sweep | 14 | 95 | Medium | Hits low |
| Super Attack | 30 | 100 | Very Slow | Requires full super meter, ignores height, chips through block |
| Block | — | — | Instant | 75% damage reduction |
| Dodge | — | — | Fast | Full invulnerability, costs positioning |
| Crouch | — | — | Instant | Avoids high attacks |
| Jump | — | — | Medium | Avoids low attacks |

## License

MIT
