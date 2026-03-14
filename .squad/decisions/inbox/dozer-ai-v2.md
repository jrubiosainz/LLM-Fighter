# Decision: AI Strategy Engine V2 — Model Personalities & Visible Reasoning

**Author:** Dozer (AI Integrator)  
**Date:** 2026-03-15  
**Status:** Proposed  

## Decision

Replace the basic random-with-heuristics fallback AI with a personality-driven strategy engine featuring pattern recognition, situational awareness, weighted action selection, and structured thought output.

## Key Changes

1. **Model Personality Profiles** — 7 distinct fighting styles mapped to model families (GPT→Analytical, Claude Haiku→Speed Blitz, Sonnet→Adaptive, Opus→Methodical, Gemini→Wildcard, o3→Deep Thinker). Each profile defines aggressionBase, riskTolerance, patternWeight, and preferredMoves.

2. **Pattern Recognition** — Opponent action history (up to 20 entries) with sliding 5-action window. Detects repeating patterns and auto-selects counters from a COUNTERS map.

3. **Dynamic Aggression** — Aggression modifier adjusts per-tick based on health differential, round advantage, and desperation threshold (≤15 HP). Combined with personality base for weighted action selection.

4. **Structured Thought Output** — Multi-line analysis with labeled sections ([STRATEGY], 📊 ANALYSIS, 🎯 ACTION). Round adaptation produces full shift reports.

5. **Client Formatting** — AIController.formatThought() converts raw text to color-coded HTML with CSS classes. Health color-coded by value, actions in cyan, strategy in green, desperation pulsing red.

6. **Updated Prompt Engineering** — All 13 moves documented, opponent pattern history injected, combo/stagger state included, explicit reasoning instructions.

## Rationale

- Makes AI decision-making **transparent** to viewers — crucial for demo/entertainment value
- Model personalities create **distinct fighting styles** even in fallback mode (no SDK needed)
- Pattern recognition creates **emergent counter-play** dynamics between agents
- Weighted selection preserves **nondeterminism** while biasing toward smart choices

## Contract

- VALID_ACTIONS: 13 actions (original 8 + dodge, crouch, jump, uppercut, sweep)
- Engine support for new moves was already implemented by Tank
- Thought callback format: multi-line text with emoji section markers
- Personality detection: substring match on model ID

## Impact

- `ai-agent.js` — Major rewrite of FighterAgent class + new utility functions
- `public/js/ai-controller.js` — Added formatThought(), escapeHtml(), colorHealth() methods
- `public/css/style.css` — Added ~80 lines of thought formatting CSS classes
