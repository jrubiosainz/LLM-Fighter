# Project Context

- **Owner:** jrubiosainz
- **Project:** LLM-Fighter — HTML5 Street Fighter arcade game where LLM AI models fight each other. Models selected from GitHub Copilot catalog. 2-round matches, high/low kicks and punches. AI sub-agents control fighters with real-time strategy display.
- **Stack:** HTML5, CSS3, JavaScript (vanilla), Canvas API, GitHub Copilot SDK
- **Reference:** Model selector from ../copilot-sdk/ (CopilotClient.listModels())
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-13: Combat Engine Architecture
- Created `public/js/engine.js` as pure logic layer with zero rendering dependencies
- Implemented deterministic state machine: every tick produces same output for same inputs
- Combat system uses simultaneous action resolution - both players can trade hits in same frame
- Blocking reduces damage by 75% (takes 25% of original damage)
- Distance-based hit detection with per-move range values (70-100px)
- Movement restricted by arena bounds (0-800px) with 50px minimum fighter separation
- Round wins tracked separately from health; best of 3 format with match_end phase
- Event system generates combat feedback: hits, blocks, whiffs, trades, KOs, timeouts
- Timer countdown handled by caller (game.js), engine only checks for timeout condition
- Frame counter per player tracks animation state (not strictly required for logic but useful for future sprite timing)

### 2026-03-14: Integration & State Authority
- **Established roundWins authority**: Engine is sole source of truth for round outcome; game.js now reads, never increments
- **Fixed timer handling**: Morpheus (game.js) owns timer decrement; engine only validates timeout condition
- **Verified timeout behavior**: Round ends when timer reaches 0; score determined by health at that moment
- **Confirmed event accuracy**: All combat events (hits, blocks, KOs, timeouts) properly generated and passed to game orchestrator
- **Tested deterministic replay**: Same fighter actions produce identical outcomes across multiple runs
