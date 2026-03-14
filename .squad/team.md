# Squad Team

> LLM-Fighter — Street Fighter arcade-style HTML game where LLM AI models fight each other

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Morpheus | Lead | `.squad/agents/morpheus/charter.md` | 🏗️ Active |
| Trinity | Frontend Dev | `.squad/agents/trinity/charter.md` | ⚛️ Active |
| Tank | Game Engine Dev | `.squad/agents/tank/charter.md` | 🔧 Active |
| Dozer | AI Integrator | `.squad/agents/dozer/charter.md` | 🧪 Active |
| Scribe | Session Logger | `.squad/agents/scribe/charter.md` | 📋 Active |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Project Context

- **User:** jrubiosainz
- **Project:** LLM-Fighter — An HTML5 arcade fighting game styled after classic Street Fighter, where fighters are controlled by LLM AI models (GPT, Claude, Gemini, etc.) via GitHub Copilot SDK sub-agents. Two models face off in 2-round matches with high/low kicks and punches. Each AI agent decides strategy in real-time, shown in side panels.
- **Stack:** HTML5, CSS3, JavaScript (vanilla), Canvas API, GitHub Copilot SDK (@github/copilot-sdk)
- **Reference:** Model selector pattern from `../copilot-sdk/` project (CopilotClient.listModels())
- **Created:** 2026-03-13
