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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

