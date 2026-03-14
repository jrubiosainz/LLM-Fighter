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
