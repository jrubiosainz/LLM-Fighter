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

### 2026-03-14: Combat Engine v2 — Expanded Move System & Mechanics
- Added 5 new actions: dodge (invulnerable sidestep), crouch (avoids high), jump (avoids low), uppercut (18dmg, hits jumping), sweep (14dmg, misses crouching)
- Introduced high/low attack height system — all attacks now carry a `height` property ('high' or 'low')
- Dodge invulnerability check happens BEFORE range check; this is critical because dodge movement shifts position, and the spec says invulnerability is absolute
- Sweep has a special avoidance rule: misses crouching opponents even though crouch normally only avoids 'high' attacks
- Combo counter tracks consecutive unblocked hits per attacker; +10% bonus per hit after first, capped at 50%; resets on miss/block/dodge/avoidance
- Stagger mechanic: any single hit dealing ≥15 damage sets `isStaggered=true` on defender; next tick they can only block or dodge, then flag clears
- Critical hit: 15% random chance for 1.5× damage — the only non-deterministic element in the engine
- Player state expanded with `comboCount`, `isStaggered`, `lastHitHeight`; all reset properly in startRound()
- `VALID_ACTIONS` exposed as static class property for external validation
- `processAttack` now takes full `defenderAction` instead of just `defenderBlocking` boolean, enabling dodge/crouch/jump awareness
- Maintained full backward compatibility: same API surface (executeTick, getState, reset, setModels, startRound)
- 48 unit tests covering all new mechanics pass clean

### 2026-03-14: Integration & State Authority
- **Established roundWins authority**: Engine is sole source of truth for round outcome; game.js now reads, never increments
- **Fixed timer handling**: Morpheus (game.js) owns timer decrement; engine only validates timeout condition
- **Verified timeout behavior**: Round ends when timer reaches 0; score determined by health at that moment
- **Confirmed event accuracy**: All combat events (hits, blocks, KOs, timeouts) properly generated and passed to game orchestrator
- **Tested deterministic replay**: Same fighter actions produce identical outcomes across multiple runs

### 2026-03-14: Super Meter & Hitstop Systems
- Added `superMeter` (0-100) to player state; builds on attack (+8 unblocked, +4 blocked, +3 on taking damage)
- Super meter carries across rounds for strategic depth; resets only on match reset (`reset()` / `createInitialState()`)
- `super_attack`: 30 dmg, 100px range, requires full meter; ignores height avoidance, chips 50% through block (vs normal 25%), always staggers
- Super meter validated at top of `executeTick()` before stagger enforcement — invalid super_attack converts to idle
- Hitstop system: `hitstopFrames` on gameState (3 normal, 5 critical, 8 super); checked at very top of `executeTick()` — when > 0, decrements and returns frozen state
- game.js hitstop integration: during hitstop, next tick scheduled at TICK_DELAY/4 so engine burns through freeze frames quickly without blocking render
- Replaced `confirm()` dialog in `endMatch()` with `renderer.showVictoryScreen()` call (with typeof guard for backward compat until Trinity ships it)
- ai-agent.js updated: super_attack in VALID_ACTIONS, ACTION_STATS, COUNTERS, prompt context, and fallback strategy (fires at full meter in range, or desperation)
- Key files: `public/js/engine.js`, `public/js/game.js`, `ai-agent.js`
