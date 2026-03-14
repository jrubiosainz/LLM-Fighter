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
  
  let copilotClient = null;
  let fighter1 = null;
  let fighter2 = null;
  let fightId = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'start_fight':
          try {
            // Initialize Copilot client (may be null if SDK unavailable)
            copilotClient = CopilotClient ? new CopilotClient() : null;
            fightId = generateFightId();
            
            // Create fighter agents
            fighter1 = new FighterAgent(data.model1, 'left', copilotClient);
            fighter2 = new FighterAgent(data.model2, 'right', copilotClient);
            
            console.log(`Fight started: ${data.model1} vs ${data.model2}`);
            ws.send(JSON.stringify({ type: 'fight_started', fightId }));
          } catch (error) {
            console.error('Error starting fight:', error);
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Failed to start fight: ' + error.message 
            }));
          }
          break;
          
        case 'request_actions':
          if (!fighter1 || !fighter2) {
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Fight not started' 
            }));
            return;
          }
          
          try {
            // Query both fighters in parallel
            const [result1, result2] = await Promise.all([
              fighter1.getAction(data.gameState, (thought) => {
                ws.send(JSON.stringify({ type: 'thought', side: 'left', text: thought }));
              }),
              fighter2.getAction(data.gameState, (thought) => {
                ws.send(JSON.stringify({ type: 'thought', side: 'right', text: thought }));
              })
            ]);
            
            ws.send(JSON.stringify({
              type: 'actions',
              p1: result1,
              p2: result2
            }));
          } catch (error) {
            console.error('Error getting actions:', error);
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Failed to get AI response: ' + error.message 
            }));
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
          cleanup();
          console.log('Fight ended');
          break;
          
        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format' 
      }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    cleanup();
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    cleanup();
  });

  function cleanup() {
    if (fighter1) {
      fighter1.destroy();
      fighter1 = null;
    }
    if (fighter2) {
      fighter2.destroy();
      fighter2 = null;
    }
    copilotClient = null;
    fightId = null;
  }
});

function generateFightId() {
  return `fight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

server.listen(PORT, () => {
  console.log(`LLM-Fighter server running on http://localhost:${PORT}`);
});
