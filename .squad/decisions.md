# Squad Decisions

## Active Decisions

### 2026-03-14: Five-Phase State Machine for Game Orchestration
**Decision:** Use explicit select → intro → fighting → round_end → match_end phases in game.js rather than implicit event chains.  
**Rationale:** Eliminates race conditions between async AI calls and rendering; makes flow testable and debuggable; prevents overlapping phase logic.  
**Adopted By:** Morpheus (Orchestration)

### 2026-03-14: AI Timeout with Fallback Strategy
**Decision:** 10-second AI timeout with graceful 'idle' fallback; optional Copilot SDK support.  
**Rationale:** Prevents game hang if AI service is slow or unavailable; allows testing without SDK auth; ensures deterministic UX.  
**Adopted By:** Dozer (AI Integration)

### 2026-03-14: Deterministic Combat Engine
**Decision:** GameEngine is pure logic layer; all state transitions produce identical output for same inputs.  
**Rationale:** Enables replay, testing, and debugging; separates concerns from rendering; supports future AI training data collection.  
**Adopted By:** Tank (Engine Dev)

### 2026-03-14: Arcade Aesthetic with Full CSS Neon Styling
**Decision:** Press Start 2P font, CRT scanlines, neon cyan/magenta/yellow color scheme, glow effects on all UI elements.  
**Rationale:** Authentic Street Fighter arcade immersion; consistent visual language across all components; enhances AI thought panel visibility.  
**Adopted By:** Trinity (Frontend)

### 2026-03-14: Shared GameState Object with Module Global Contracts
**Decision:** All modules communicate via gameState object; game.js exposes window globals for GameEngine, GameRenderer, AIController.  
**Rationale:** Avoids build complexity in vanilla HTML project; keeps integration explicit and debuggable; supports hot-reloading for development.  
**Adopted By:** Morpheus (Orchestration), entire squad

### 2026-03-13: Combat Engine Design (v1)
**Decision:** Combat engine as pure logic layer with simultaneous action resolution, 75% damage reduction on block, absolute position tracking (0-800px), round end on KO or timeout, event array for decoupling.  
**Rationale:** Deterministic, testable, separates concerns from rendering. Distance-based collision prevents overlap; simultaneous actions create dynamic risk/reward.  
**Adopted By:** Tank (Engine Dev)

### 2026-03-13: AI Integration Architecture
**Decision:** Three-tier architecture — Express server with WebSocket, FighterAgent class with Copilot SDK sessions per fighter, AIController client with promise-based async requests.  
**Rationale:** Parallel AI queries minimize latency. Session persistence enables strategy adaptation. Fallback mode enables demo without auth.  
**Adopted By:** Dozer (AI Integrator)

### 2026-03-13: Game Loop Architecture
**Decision:** Dual-loop — setTimeout at 2-second intervals for AI requests/responses; requestAnimationFrame within each tick for smooth rendering.  
**Rationale:** AI needs human-like pace (~1-2s thinking); smooth visuals require per-frame updates. Separation allows independent tuning.  
**Adopted By:** Morpheus (Orchestration)

### 2026-03-13: Visual Design System (v1)
**Decision:** Arcade aesthetic — Press Start 2P font, CRT scanlines (4px repeat, 25% opacity), neon color scheme (P1 cyan, P2 magenta, yellow title, red damage, green actions). Rectangle-based pixel-art fighters (60x100px) with 6 poses.  
**Rationale:** Authentic 90s arcade immersion. High contrast ensures readability. Simple sprites are fast to render and easy to modify.  
**Adopted By:** Trinity (Frontend)

### 2026-03-14: Combat Engine v2 — Expanded Moves & Mechanics
**Decision:** 13 total actions (original 8 + dodge, crouch, jump, uppercut, sweep), high/low attack height system, combo counter with 10% scaling (max +50%), stagger/stun lasts 1 tick, critical hits 15% chance for 1.5× damage.  
**Rationale:** Rock-paper-scissors depth (crouch beats high, jump beats low, uppercut punishes jump, sweep punishes standing). Combo incentives reward aggression. Stagger creates power-move openings.  
**Adopted By:** Tank (Engine Dev)

### 2026-03-14: Visual Upgrade v1 — Renderer Contracts (Passive Read)
**Decision:** Renderer reads `gameState.hitstopFrames` (freezes animation, zooms 1.02x, white pulse overlay) and `gameState.players.pX.superMeter` (gold bar below health, pulses when full). New `dustParticles[]` array for dodge/landing/sweep. Victory screen API: `showVictoryScreen(winnerSide, winnerModel, score, onRematch)`.  
**Rationale:** Renderer-only changes; graceful degradation. All properties optional — missing defaults to no-op. Backwards compatible.  
**Adopted By:** Trinity (Frontend)

### 2026-03-14: Super Meter & Hitstop Systems
**Decision:** Super meter (0-100) on each player, builds +8 unblocked hit, +4 blocked hit, +3 damage taken. `super_attack` action (30 dmg, 100px range, requires meter=100, ignores height, chips 50% through block, always staggers). Hitstop: 3 frames (normal), 5 frames (critical), 8 frames (super). Meter carries across rounds, resets on match reset.  
**Rationale:** Strategic depth. Meter rewards aggression; super_attack creates comeback potential. Hitstop emphasizes impact of big hits.  
**Adopted By:** Tank (Engine Dev)

### 2026-03-15: AI Strategy Engine v2 — Personalities & Visible Reasoning
**Decision:** 7 model personality profiles (GPT→Analytical, Claude Haiku→Speed Blitz, Sonnet→Adaptive, Opus→Methodical, Gemini→Wildcard, o3→Deep Thinker). Pattern recognition with 5-action sliding window and auto-counters. Dynamic aggression modifier based on health/round/desperation. Structured thought output with labeled sections ([STRATEGY], 📊 ANALYSIS, 🎯 ACTION). Client-side thought formatting with color-coded HTML.  
**Rationale:** Transparency makes AI decision-making visible to viewers. Model personalities create distinct fighting styles even in fallback mode. Pattern recognition creates emergent counter-play dynamics.  
**Adopted By:** Dozer (AI Integrator)

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

