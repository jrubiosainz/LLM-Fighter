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
