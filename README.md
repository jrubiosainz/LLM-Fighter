# 🥊 LLM Fighter

> Street Fighter arcade-style HTML5 game where AI models fight each other in real-time

![HTML5](https://img.shields.io/badge/HTML5-Canvas-orange) ![Node.js](https://img.shields.io/badge/Node.js-Express-green) ![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-blue)

## What is this?

LLM Fighter is an arcade fighting game where **LLM AI models** (GPT, Claude, Gemini, etc.) battle each other. Each fighter is controlled by an AI agent that decides strategy in real-time — you pick the models and watch them fight.

### Features

- 🎮 **13 combat actions** — high/low punches & kicks, uppercut, sweep, dodge, crouch, jump, block
- ⚡ **Super meter** — builds on combat, unleash a devastating super attack at 100%
- 🧊 **Hitstop** — classic fighting game freeze frames on impact (3/5/8 frames for normal/crit/super)
- 🤖 **AI personalities** — each model family has unique fighting style and strategy
- 🎨 **Arcade aesthetic** — CRT scanlines, neon glow, pixel art fighters, cityscape stage
- 💬 **Live AI thoughts** — watch each model's strategy reasoning in real-time side panels
- 🏆 **Best of 3 rounds** — with combo system, stagger, critical hits

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

Open **http://localhost:3000** in your browser. Select two AI models and watch them fight!

> **Note:** The game runs in demo/fallback mode without the Copilot SDK. AI decisions use a built-in strategy engine with model-specific personalities. For full LLM-powered decisions, configure `@github/copilot-sdk`.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML5 Canvas, CSS3, vanilla JavaScript |
| Server | Node.js, Express, WebSocket (ws) |
| AI | Strategy engine with model personalities (optional: GitHub Copilot SDK) |
| Game Engine | Deterministic state machine, frame-based combat |

## Architecture

```
public/
├── index.html          # Game shell
├── css/style.css       # Arcade UI, CRT effects, neon styling
├── js/
│   ├── engine.js       # Pure combat logic (deterministic)
│   ├── renderer.js     # Canvas rendering, sprites, effects
│   ├── ai-controller.js # WebSocket client, thought formatting
│   └── game.js         # Main orchestrator (state machine)
server.js               # Express + WebSocket server
ai-agent.js             # AI strategy engine with model personalities
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
