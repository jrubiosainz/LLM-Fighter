const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

let CopilotClient = null;
try {
  ({ CopilotClient } = require('@github/copilot-sdk'));
} catch (e) {
  console.log('Copilot SDK not available — running in demo/fallback mode');
}

const { FighterAgent, getAvailableModels } = require('./ai-agent');

// Optional game agents — graceful fallback if not yet implemented
let ChessAgent = null;
try { ({ ChessAgent } = require('./chess-agent')); } catch (e) { /* not yet implemented */ }

let DrawAgent = null;
try { ({ DrawAgent } = require('./draw-agent')); } catch (e) { /* not yet implemented */ }

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;

// Serve static files from public directory
app.use(express.static('public'));

// REST endpoint to get available models
app.get('/api/models', async (req, res) => {
  try {
    const models = await getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // --- Per-connection state ---
  let copilotClient = null;
  let fighter1 = null;
  let fighter2 = null;
  let fightId = null;
  let chessWhite = null;
  let chessBlack = null;
  let drawLeft = null;
  let drawRight = null;
  let drawPrompt = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      const game = data.game || 'fight'; // backward compat: default to fight

      switch (game) {
        // ======================== FIGHT ========================
        case 'fight':
          await handleFightMessage(data, ws);
          break;

        // ======================== CHESS ========================
        case 'chess':
          await handleChessMessage(data, ws);
          break;

        // ======================== DRAW =========================
        case 'draw':
          await handleDrawMessage(data, ws);
          break;

        default:
          console.warn('Unknown game type:', game);
          ws.send(JSON.stringify({ type: 'error', message: `Unknown game: ${game}` }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  // --- Fight handlers (existing logic, unchanged) ---
  async function handleFightMessage(data, ws) {
    switch (data.type) {
      case 'start_fight':
        try {
          copilotClient = CopilotClient ? new CopilotClient() : null;
          fightId = generateFightId();
          fighter1 = new FighterAgent(data.model1, 'left', copilotClient);
          fighter2 = new FighterAgent(data.model2, 'right', copilotClient);
          console.log(`Fight started: ${data.model1} vs ${data.model2}`);
          ws.send(JSON.stringify({ type: 'fight_started', fightId }));
        } catch (error) {
          console.error('Error starting fight:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to start fight: ' + error.message }));
        }
        break;

      case 'request_actions':
        if (!fighter1 || !fighter2) {
          ws.send(JSON.stringify({ type: 'error', message: 'Fight not started' }));
          return;
        }
        try {
          const [result1, result2] = await Promise.all([
            fighter1.getAction(data.gameState, (thought) => {
              ws.send(JSON.stringify({ type: 'thought', side: 'left', text: thought }));
            }),
            fighter2.getAction(data.gameState, (thought) => {
              ws.send(JSON.stringify({ type: 'thought', side: 'right', text: thought }));
            })
          ]);
          ws.send(JSON.stringify({ type: 'actions', p1: result1, p2: result2 }));
        } catch (error) {
          console.error('Error getting actions:', error);
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to get AI response: ' + error.message }));
        }
        break;

      case 'round_end':
        try {
          if (fighter1 && fighter2) {
            await Promise.all([
              fighter1.adaptStrategy(data.roundResult),
              fighter2.adaptStrategy(data.roundResult)
            ]);
          }
        } catch (error) {
          console.error('Error adapting strategy:', error);
        }
        break;

      case 'end_fight':
        cleanupFight();
        console.log('Fight ended');
        break;

      default:
        console.warn('Unknown fight message type:', data.type);
    }
  }

  // --- Chess handlers ---
  async function handleChessMessage(data, ws) {
    if (!ChessAgent) {
      ws.send(JSON.stringify({ type: 'error', message: 'Chess agent not yet available' }));
      return;
    }
    switch (data.type) {
      case 'start_chess':
        try {
          copilotClient = CopilotClient ? new CopilotClient() : null;
          chessWhite = new ChessAgent(data.model1, 'white', copilotClient);
          chessBlack = new ChessAgent(data.model2, 'black', copilotClient);
          console.log(`Chess started: ${data.model1} (white) vs ${data.model2} (black)`);
          ws.send(JSON.stringify({ type: 'chess_started' }));
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to start chess: ' + error.message }));
        }
        break;
      case 'request_chess_move': {
        const agent = data.side === 'white' ? chessWhite : chessBlack;
        if (!agent) {
          ws.send(JSON.stringify({ type: 'error', message: 'Chess game not started' }));
          return;
        }
        const thoughtSide = data.side === 'white' ? 'left' : 'right';
        try {
          // Pass valid moves as legalMoves for the agent
          const boardState = { ...data.boardState, legalMoves: data.boardState.validMoves };
          const moveResult = await agent.getMove(boardState, (thought) => {
            ws.send(JSON.stringify({ type: 'thought', side: thoughtSide, text: thought }));
          });
          ws.send(JSON.stringify({ type: 'chess_move_result', move: moveResult }));
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', message: 'Chess move error: ' + error.message }));
        }
        break;
      }
      case 'end_chess':
        chessWhite = null;
        chessBlack = null;
        console.log('Chess ended');
        break;
      default:
        console.warn('Unknown chess message type:', data.type);
    }
  }

  // --- Draw handlers ---
  async function handleDrawMessage(data, ws) {
    if (!DrawAgent) {
      ws.send(JSON.stringify({ type: 'error', message: 'Draw agent not yet available' }));
      return;
    }
    switch (data.type) {
      case 'start_draw':
        try {
          copilotClient = CopilotClient ? new CopilotClient() : null;
          drawLeft = new DrawAgent(data.model1, 'left', copilotClient);
          drawRight = new DrawAgent(data.model2, 'right', copilotClient);
          drawPrompt = data.prompt || '';
          console.log(`Draw started: ${data.model1} vs ${data.model2} — "${drawPrompt}"`);
          ws.send(JSON.stringify({ type: 'draw_started' }));
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', message: 'Failed to start draw: ' + error.message }));
        }
        break;
      case 'draw_tick': {
        const agent = data.side === 'left' ? drawLeft : drawRight;
        if (!agent) {
          ws.send(JSON.stringify({ type: 'error', message: 'Draw session not started' }));
          return;
        }
        try {
          const prompt = data.prompt || drawPrompt;
          const commands = await agent.generateCommands(
            prompt,
            data.canvasWidth || 400,
            data.canvasHeight || 400,
            data.timeRemaining || 300,
            (thought) => {
              ws.send(JSON.stringify({ type: 'thought', side: data.side, text: thought }));
            }
          );
          ws.send(JSON.stringify({
            type: 'draw_commands',
            side: data.side,
            commands: commands || [],
            thought: ''
          }));
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', message: 'Draw tick error: ' + error.message }));
        }
        break;
      }
      case 'end_draw':
        drawLeft = null;
        drawRight = null;
        drawPrompt = null;
        console.log('Draw ended');
        break;
      default:
        console.warn('Unknown draw message type:', data.type);
    }
  }

  ws.on('close', () => {
    console.log('Client disconnected');
    cleanupAll();
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    cleanupAll();
  });

  function cleanupFight() {
    if (fighter1) { fighter1.destroy(); fighter1 = null; }
    if (fighter2) { fighter2.destroy(); fighter2 = null; }
    fightId = null;
  }

  function cleanupAll() {
    cleanupFight();
    chessWhite = null;
    chessBlack = null;
    drawLeft = null;
    drawRight = null;
    drawPrompt = null;
    copilotClient = null;
  }
});

function generateFightId() {
  return `fight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

server.listen(PORT, () => {
  console.log(`LLM Arena server running on http://localhost:${PORT}`);
});
