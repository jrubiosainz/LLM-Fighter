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
    const formatted = [];

    for (const line of lines) {
      let html = this.escapeHtml(line);

      // Strategy line: [STRATEGY: ...] in green
      if (/\[STRATEGY:/.test(line)) {
        html = html.replace(
          /\[STRATEGY:\s*([^\]]+)\]/,
          '<span class="thought-strategy">[🧠 STRATEGY: <strong>$1</strong>]</span>'
        );
        // Personality tag
        html = html.replace(
          /\(([^)]+)\)\s*$/,
          '<span class="thought-personality">($1)</span>'
        );
      }

      // Health line: color numbers by value
      if (/📊\s*Health/.test(line)) {
        html = html.replace(/(\d+)\s*vs\s*(\d+)/, (match, a, b) => {
          return `${this.colorHealth(parseInt(a))} vs ${this.colorHealth(parseInt(b))}`;
        });
        // Advantage/deficit coloring
        html = html.replace(/(advantage\s*\+\d+)/, '<span class="thought-advantage">$1</span>');
        html = html.replace(/(deficit\s*-\d+)/, '<span class="thought-deficit">$1</span>');
        html = '📊 ' + html.replace(/📊\s*/, '');
      }

      // Distance line
      if (/📏\s*Distance/.test(line)) {
        html = html.replace(/(\d+)px/, '<span class="thought-distance">$1px</span>');
        html = html.replace(/\(([^)]+)\)/, '<span class="thought-range">($1)</span>');
      }

      // Pattern line
      if (/🔍\s*Pattern/.test(line)) {
        html = html.replace(
          /(repeating\s+)(\w+)/,
          '$1<span class="thought-action-name">$2</span>'
        );
        html = html.replace(
          /(counter with\s+)(\w+)/,
          '$1<span class="thought-action-name">$2</span>'
        );
        html = html.replace(/DESPERATION/, '<span class="thought-desperate">DESPERATION</span>');
      }

      // Action line
      if (/🎯\s*Action/.test(line)) {
        html = html.replace(
          /(Action:\s*)(\w+)/,
          '$1<span class="thought-action-name">$2</span>'
        );
      }

      // Round analysis header
      if (/📋\s*ROUND/.test(line)) {
        html = `<span class="thought-round-header">${html}</span>`;
      }
      // Won/lost
      if (/Won:/.test(line)) {
        html = html.replace(/✅/, '<span class="thought-win">✅</span>');
        html = html.replace(/❌/, '<span class="thought-loss">❌</span>');
      }
      // Strategy shift
      if (/Strategy shift/.test(line)) {
        html = html.replace(
          /(\w+)\s*→\s*(\w+)/,
          '<span class="thought-strategy-old">$1</span> → <span class="thought-strategy-new">$2</span>'
        );
      }

      formatted.push(html);
    }

    return formatted.join('<br>');
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
