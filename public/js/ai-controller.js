class AIController {
  constructor(wsUrl = 'ws://localhost:3000') {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.thoughtCallbacks = [];
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.isConnected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.isConnected) {
        resolve();
        return;
      }

      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.isConnected = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'thought':
        this.thoughtCallbacks.forEach(callback => {
          try {
            const formatted = this.formatThought(message.text);
            callback(message.side, formatted);
          } catch (error) {
            console.error('Error in thought callback:', error);
          }
        });
        break;

      case 'actions':
        const pending = this.pendingRequests.get('actions');
        if (pending) {
          pending.resolve(message);
          this.pendingRequests.delete('actions');
        }
        break;

      case 'fight_started':
        const startPending = this.pendingRequests.get('start_fight');
        if (startPending) {
          startPending.resolve(message);
          this.pendingRequests.delete('start_fight');
        }
        break;

      case 'error':
        console.error('Server error:', message.message);
        const errorPending = this.pendingRequests.get('actions') || 
                             this.pendingRequests.get('start_fight');
        if (errorPending) {
          errorPending.reject(new Error(message.message));
          this.pendingRequests.clear();
        }
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Formats raw thought text into color-coded HTML for the thought panels.
   * Sections: 🧠 STRATEGY, 📊 ANALYSIS, 🎯 ACTION
   */
  formatThought(rawText) {
    if (!rawText) return '';

    const lines = rawText.split('\n');
    let action = '';
    let strategy = '';

    for (const line of lines) {
      if (/🎯\s*Action/.test(line)) {
        const match = line.match(/Action:\s*(\w[\w_]*)/);
        if (match) action = match[1];
      }
      if (/\[STRATEGY:/.test(line)) {
        const match = line.match(/\[STRATEGY:\s*([^\]]+)\]/);
        if (match) strategy = match[1].trim();
      }
    }

    if (action && strategy) {
      return `🎯 <span class="thought-action-name">${this.escapeHtml(action.toUpperCase())}</span> — <span class="thought-strategy">"${this.escapeHtml(strategy)}"</span>`;
    }
    if (action) {
      return `🎯 <span class="thought-action-name">${this.escapeHtml(action.toUpperCase())}</span>`;
    }

    // Fallback: first 80 characters as a single line
    const short = rawText.replace(/\n/g, ' ').substring(0, 80);
    return this.escapeHtml(short);
  }

  colorHealth(hp) {
    if (hp > 60) return `<span class="thought-health-good">${hp}</span>`;
    if (hp > 30) return `<span class="thought-health-warn">${hp}</span>`;
    return `<span class="thought-health-crit">${hp}</span>`;
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async fetchModels() {
    try {
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return [
        'gpt-4.1', 'gpt-5-mini', 'gpt-5.1', 'gpt-5.1-codex',
        'claude-haiku-4.5', 'claude-sonnet-4.5', 'claude-opus-4.6',
        'gemini-3-pro', 'o3-mini'
      ];
    }
  }

  async startFight(model1Id, model2Id) {
    await this.connect();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete('start_fight');
        reject(new Error('Start fight timeout'));
      }, 15000);

      this.pendingRequests.set('start_fight', {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.ws.send(JSON.stringify({
        type: 'start_fight',
        model1: model1Id,
        model2: model2Id
      }));
    });
  }

  async requestActions(gameState) {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete('actions');
        reject(new Error('Request actions timeout'));
      }, 12000);

      this.pendingRequests.set('actions', {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve({
            p1: result.p1 || { action: 'idle', thought: 'No response' },
            p2: result.p2 || { action: 'idle', thought: 'No response' }
          });
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.ws.send(JSON.stringify({
        type: 'request_actions',
        gameState: gameState
      }));
    });
  }

  sendRoundEnd(roundResult) {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'round_end',
        roundResult: roundResult
      }));
    }
  }

  endFight() {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'end_fight'
      }));
    }
  }

  onThought(callback) {
    if (typeof callback === 'function') {
      this.thoughtCallbacks.push(callback);
    }
  }

  removeThoughtCallback(callback) {
    const index = this.thoughtCallbacks.indexOf(callback);
    if (index > -1) {
      this.thoughtCallbacks.splice(index, 1);
    }
  }

  close() {
    if (this.ws) {
      this.isConnected = false;
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.clear();
    this.thoughtCallbacks = [];
  }
}

if (typeof window !== 'undefined') {
  window.AIController = AIController;
}
