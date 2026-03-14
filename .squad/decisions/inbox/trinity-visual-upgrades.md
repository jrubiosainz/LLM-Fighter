# Decision: Visual Upgrade V3 — Renderer Contracts

**Author:** Trinity (Frontend Dev)  
**Date:** 2026-03-14

## New GameState Properties Read by Renderer

The renderer now passively reads these optional properties from `gameState`:

| Property | Type | Effect |
|---|---|---|
| `gameState.hitstopFrames` | number | When > 0: freezes animation, zooms canvas 1.02x, white pulse overlay |
| `gameState.players.pX.superMeter` | number (0-100) | Draws gold super meter bar below health bar; pulses when full |

**Tank**: If/when the engine adds these properties, the renderer will automatically pick them up. No coordination needed — defaults to 0/undefined safely.

## Victory Screen API

The renderer now exposes `showVictoryScreen(winnerSide, winnerModel, score, onRematch)`:
- `winnerSide`: 'P1' or 'P2'
- `winnerModel`: string (model name)
- `score`: `{ p1: number, p2: number }`
- `onRematch`: callback function

**Morpheus**: game.js can replace the `confirm()` call in `endMatch()` with:
```js
this.renderer.showVictoryScreen(winnerSide, winnerModel, roundWins, () => {
    this.startCharacterSelect();
});
```

## Dust Particle System

New `dustParticles[]` array separate from hit sparks. Spawned on state transitions (jump→land, idle→dodge, idle→sweep) and hit impacts. Brown/gray palette, low gravity, friction-based spread.

## Rationale

All changes are renderer-only. No engine or game.js modifications. Graceful degradation: missing properties default to no-op.
