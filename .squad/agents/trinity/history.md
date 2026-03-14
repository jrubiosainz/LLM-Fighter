# Project Context

- **Owner:** jrubiosainz
- **Project:** LLM-Fighter — HTML5 Street Fighter arcade game where LLM AI models fight each other. Models selected from GitHub Copilot catalog. 2-round matches, high/low kicks and punches. AI sub-agents control fighters with real-time strategy display.
- **Stack:** HTML5, CSS3, JavaScript (vanilla), Canvas API, GitHub Copilot SDK
- **Reference:** Model selector from ../copilot-sdk/ (CopilotClient.listModels())
- **Created:** 2026-03-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-03-13: Initial Frontend Implementation
- Created arcade-style HTML structure with left/right AI thought panels flanking 800x450 canvas
- Implemented full CSS arcade aesthetic: CRT scanline effect, Press Start 2P font, neon glow effects (cyan/magenta/yellow)
- Built GameRenderer class with pixel-art fighter sprites drawn using Canvas rectangles (idle, punch, kick, block, hit, KO poses)
- Character select overlay uses two-column grid (P1 cyan, P2 magenta) with glowing selection states
- HUD system: health bars (yellow→red depletion), center timer, round win indicators (dots)
- Thought panel auto-scrolls with message history, custom scrollbar styling with neon green
- All visual elements use consistent color scheme: P1=cyan, P2=magenta, timer=yellow, damage=red, system=green

### 2026-03-14: Integration & DOM Fixes
- **Fixed all DOM selector mismatches**: Morpheus game.js now correctly references #p1-panel, #p2-panel, #canvas-game
- **Verified event listener binding**: Character selection, fight start, and game end events properly wired
- **Tested visual state sync**: Renderer correctly reflects gameState updates from engine and AI controllers
- **Confirmed thought panel functionality**: AI thoughts stream correctly from WebSocket messages
- **Color scheme validated**: All neon effects render correctly across arcade UI elements

### 2026-03-14: Major Visual Quality Upgrade (V2)
- **Fighter sprites completely rebuilt**: Each body part (head, neck, torso, arms, forearms, hands, upper/lower legs, feet) drawn separately with highlight/base/shadow/outline shading using `_sRect()` helper. P1 uses cyan palette, P2 uses magenta palette. Skin-toned head and hands add realism.
- **5 new action poses added**: `dodging` (tilted body with afterimage trail), `crouching` (compressed low stance), `jumping` (y-offset -60, arms up, legs tucked), `uppercut` (rising fist, extended body), `sweep` (low to ground, leg extended far). All match engine contract.
- **Particle effects system**: Hit sparks (yellow/white, 10 particles), block sparks (blue/white, 5 particles), all fade over 8-13 frames. Gravity applied to particles.
- **Screen shake**: 4-8 frame shake on heavy hits and criticals. Applied via canvas translate offset before drawing.
- **Critical hit flash**: White overlay that decays over ~7 frames when `gameState.events` contains `critical`.
- **Combo counter**: "X HIT COMBO!" text above fighter, font size scales with combo count (up to 2.5x), neon glow matches player color.
- **Stagger stars**: 4 rotating yellow dots orbit above staggered fighter's head.
- **Dodge afterimage**: Two semi-transparent copies of the fighter drawn at offset positions (25% and 12% alpha).
- **Floating action labels**: Text like "UPPERCUT!" / "DODGE!" appears above fighter and fades upward over 40 frames with color-coded per action type.
- **Stage background overhaul**: Dark cityscape silhouette (14 buildings with lit windows), 3 pulsing neon signs (red/cyan/green), perspective grid floor with converging lines, rare background lightning flashes.
- **Health bars upgraded**: SF-style delayed damage bar (white/gray drains slower), portrait icon with model letter, health number overlay, red flash animation below 20%, three-color gradient (yellow→orange→red).
- **HUD additions**: "ROUND X" label between health bars, action log (last 3 actions per player in tiny text at canvas bottom).
- **CSS enhancements**: Vignette effect via `::after` radial gradient on `.game-stage`, typewriter reveal animation for new thought messages (`.thought-msg` class with `typeReveal` keyframes), pulsing glow on active thought panel (`panel-active` class toggled by `updateThought()`).
- **Performance note**: Particle array is cleaned up each frame. Building window randomness uses deterministic `Math.sin()` hash—no per-frame allocation. Floating text array capped by natural decay. All effects are lightweight Canvas fillRect operations—no images loaded.
- **Contract compliance**: All new states (`dodging`, `crouching`, `jumping`, `uppercut`, `sweep`) handled. Properties `comboCount`, `isStaggered` read per-frame. Events `critical`, `p1_dodged`, `p2_dodged`, `p1_staggered`, `p2_staggered` processed.

### 2026-03-14: Real Fighting Game Visual Quality Upgrade (V3)
- **Ground shadows**: Elliptical shadow under each fighter drawn BEFORE the sprite. Shadow squishes when jumping (smaller, lighter), stretches when crouching/sweeping, shrinks when dodging.
- **Hitstop system**: Reads `gameState.hitstopFrames` — when > 0, freezes `animFrame` increment, applies 1.02x zoom on canvas center, and flashes a subtle white pulse overlay. Engine owns the counter; renderer only reacts.
- **Enhanced hit effects**: Hit state now spawns 15 bright/large sparks (up from 10 smaller), triggers a 2-frame white flash overlay on the struck fighter sprite, and spawns brown/gray dust cloud at the feet.
- **Dust cloud particles**: Separate `dustParticles[]` array with round (arc-drawn) particles that spread low with light gravity and friction. Triggered on: jump landing, dodge start, sweep start, and hit impact. Each type has different count/spread. Particles shrink and fade over ~25 frames.
- **Energy trails on specials**: Uppercut and sweep draw colored arc paths with `shadowBlur` glow in the player's color (cyan/magenta). Double-arc technique: outer solid stroke + inner wider semi-transparent stroke for depth.
- **State transition tracking**: `_trackStateTransitions()` compares `prevStates[side]` to current state each frame to detect landing, dodge start, and sweep start — fires dust spawns accordingly.
- **Super meter UI**: `drawSuperMeter(x, y, meter, side)` draws a thin 8px gold bar below each health bar. When full (100), pulses with `shadowBlur` glow and shows "SUPER" label. Called in `drawHUD` only when `superMeter` property exists on player.
- **KO overlay improved**: Fade-in via `koOverlayAlpha` that increments 0.02/frame to 0.7. K.O. text has pulsing `shadowBlur` glow. Winner side name flashes below with sinusoidal alpha. State resets when phase leaves round_end/match_end.
- **Victory screen DOM overlay**: `showVictoryScreen(winnerSide, winnerModel, score, onRematch)` creates a full-screen DOM overlay (not canvas) with winner color, model name, score, and clickable REMATCH button. CSS classes: `.victory-overlay`, `.victory-title`, `.victory-model`, `.victory-score`, `.victory-rematch`. Ready for game.js to call instead of `confirm()`.
- **CSS additions**: Victory overlay with `victoryFadeIn` animation, `victoryPulse` scaling animation on title, `rematchBlink` glow animation on rematch button. All use the existing arcade color palette.
- **Key pattern**: Renderer reads engine state passively (`hitstopFrames`, `superMeter`) — never writes to gameState. All new features degrade gracefully if engine doesn't provide the data.
