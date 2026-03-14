# Project Context

- **Owner:** jrubiosainz
- **Project:** LLM-Fighter — HTML5 Street Fighter arcade game where LLM AI models fight each other. Models selected from GitHub Copilot catalog. 2-round matches, high/low kicks and punches. AI sub-agents control fighters with real-time strategy display.
- **Stack:** HTML5, CSS3, JavaScript (vanilla), Canvas API, GitHub Copilot SDK
- **Reference:** Model selector from ../copilot-sdk/ (CopilotClient.listModels())
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-13: AI Integration System Created
- Implemented complete AI integration stack: server.js (Express + WebSocket), ai-agent.js (Copilot SDK wrapper), ai-controller.js (browser client)
- FighterAgent class wraps Copilot SDK sessions per fighter model, handles parallel action queries with 10s timeout
- Fallback mode enables demo without Copilot SDK auth - uses strategic randomization based on distance/health
- WebSocket protocol: start_fight, request_actions, round_end, end_fight messages. Thought streaming for real-time AI visibility
- Prompt engineering: Each AI gets complete game state (health, distance, timer, round wins, last actions) with move stats and strategy context
- Strategy adaptation between rounds - agents receive round results and adjust approach (aggressive/defensive/balanced)
- Parallel AI queries via Promise.all for sub-300ms response times
- Error handling: Invalid JSON parsing, invalid actions default to 'idle', timeout protection on all AI calls

### 2026-03-14: Integration & Optional Dependency
- **Made Copilot SDK optional**: ai-agent.js detects SDK availability and gracefully falls back to strategic randomization
- **Fixed WebSocket connection flow**: AIController properly sends start_fight before requesting actions; server routes to FighterAgent
- **Verified action request format**: Thought streaming working; AI responses parsed and validated before returning to game
- **Tested parallel query performance**: Promise.all AI calls complete in <300ms; no timeout errors logged
- **Confirmed round adaptation**: Strategy adjustments transmitted and logged for debugging; agents receive round results

### 2026-03-15: AI Strategy Engine V2 — Model Personalities & Rich Thoughts
- **Model Personality System**: 7 profiles mapped by model ID substring — GPT (Analytical), Claude Haiku (Speed Blitz), Claude Sonnet (Adaptive), Claude Opus (Methodical), Gemini (Wildcard), o3-mini (Deep Thinker), default (Balanced). Each has aggressionBase, riskTolerance, patternWeight, and preferredMoves.
- **Pattern Recognition**: Tracks last 20 opponent actions, detects repeating moves (≥3 of 5 window), uses COUNTERS map for automatic counter-picks. Haiku pattern weight is low (0.4) for aggression; Opus/o3 pattern weight is high (0.9/0.95) for reading opponents.
- **Situational Awareness**: Dynamic aggression adjusts based on health differential (±0.15-0.2), round advantage (±0.1-0.15), and desperation mode (<15 HP overrides everything). Round-level adaptation shifts strategy with personality-aware logic.
- **Weighted Action Selection**: Actions scored by range bracket × aggression modifier × personality preferred moves bonus (1.3×). Gemini gets jump as closing move; o3 has 8% chance of deliberation-pause idle.
- **5 New Moves**: dodge, crouch, jump, uppercut (18 dmg), sweep (14 dmg) — added to VALID_ACTIONS, ACTION_STATS, and COUNTERS map. Engine already had support (Tank).
- **Rich Structured Thoughts**: Multi-line format with [STRATEGY], 📊 Health, 📏 Distance, 🔍 Pattern, 🎯 Action sections. Round adaptation outputs 📋 ROUND ANALYSIS with win/loss, strategy shift, opponent pattern insights.
- **Client Thought Formatting**: AIController.formatThought() parses structured text into color-coded HTML spans. Health green/yellow/red by value, actions in cyan, strategy in green, desperation in pulsing red. CSS classes added to style.css.
- **Prompt Engineering V2**: Updated buildPrompt with all 13 moves, health bar labels, opponent pattern history, combo/stagger state, range guide, and structured reasoning instructions.

### 2026-03-15: Multi-Game AI Agents — Chess & Draw
- **ChessAgent** (`chess-agent.js`): Copilot SDK + fallback strategy engine. Move scoring: checkmate (10000), captures (piece_value×10), checks (+50), center control (+20), development (+15), castling (+30). Personality-specific bonuses: GPT→Positional (center + penalizes early queen), Claude→Tactical (checks/captures/knight forks), Gemini→Aggressive (pawn pushes, penalizes retreats), O-series→Defensive (castling bonus, avoids trades). Top-3 weighted random selection. Full algebraic notation parsing.
- **DrawAgent** (`draw-agent.js`): Copilot SDK + fallback procedural drawing engine. 15+ object recipes (sun, house, tree, cat, dog, mountain, cloud, person, flower, star, bird, fish, boat, heart, rainbow, car). 5 color palettes mapped to model personality. 4-phase time awareness (background→subject→details→finishing). Prompt keyword parsing composes scenes automatically. Commands validated and clamped to canvas bounds.
- **Same pattern as FighterAgent**: constructor with copilotClient, fallbackMode detection, raceTimeout, session management, destroy(), module.exports. Both agents tested with `node -c` and runtime require/execute.
