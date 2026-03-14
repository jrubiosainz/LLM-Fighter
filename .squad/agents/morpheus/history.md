# Project Context

- **Owner:** jrubiosainz
- **Project:** LLM-Fighter — HTML5 Street Fighter arcade game where LLM AI models fight each other. Models selected from GitHub Copilot catalog. 2-round matches, high/low kicks and punches. AI sub-agents control fighters with real-time strategy display.
- **Stack:** HTML5, CSS3, JavaScript (vanilla), Canvas API, GitHub Copilot SDK
- **Reference:** Model selector from ../copilot-sdk/ (CopilotClient.listModels())
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-13: Initial Architecture Setup
- **Created package.json** with core dependencies: express (server), ws (WebSocket for real-time AI communication), @github/copilot-sdk (AI model integration)
- **Designed game.js orchestrator** using state machine pattern with phases: select → intro → fighting → round_end → match_end
- **Key architectural decision**: Fight tick loop uses setTimeout (2s delay) to accommodate AI response latency, while rendering within each tick uses requestAnimationFrame for smooth visuals
- **Error handling strategy**: 5-second AI timeout with fallback to 'idle' action ensures game never hangs waiting for AI
- **Module integration contract**: All components communicate via shared gameState object; game.js uses window globals (GameEngine, GameRenderer, AIController) to avoid build complexity in simple HTML project

### 2026-03-14: Integration & Coordination
- **Fixed DOM selector mismatches** between Trinity's HTML layout and game.js event listeners (panel IDs, canvas references)
- **Resolved timer decrement bug**: Added --gameState.timer in main tick loop; engine.js now only checks timeout condition
- **Fixed phase transitions**: Ensured intro → fighting → round_end → match_end flow fires consistently with proper timing
- **Module initialization verified**: All window globals (GameEngine, GameRenderer, AIController) properly set before game start
- **State synchronization complete**: gameState object authoritative across all modules; no duplicate state updates

### 2026-03-15: Multi-Game Architecture Shell
- **Created GameApp router** (app.js) — manages game lifecycle switching between Fight, Chess, Draw modes
- **Key design**: Games must expose `init()` and `destroy()` lifecycle methods; GameApp handles creation/teardown
- **Game selector UI**: Fixed-position `<nav>` with arcade-styled tabs; unobtrusive but always accessible at z-index 10000
- **Backward compatibility preserved**: Fight game auto-start removed from game.js; GameApp now owns DOMContentLoaded boot
- **Server routing**: WebSocket messages now dispatch on `data.game` field (default: 'fight'), with graceful require() fallback for chess-agent.js and draw-agent.js
- **Placeholder pattern**: Empty JS files prevent 404s; `window.ChessGame`/`window.DrawGame` checks gate initialization; "Coming Soon" overlay shown for unimplemented games
- **Surgical change to game.js**: Only the DOMContentLoaded listener was removed — all game logic untouched
