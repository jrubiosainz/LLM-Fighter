// ── Draw Agent ──
// AI agent that generates drawing commands using Copilot SDK or fallback procedural engine.
// Follows the same pattern as ai-agent.js (FighterAgent).

let copilotAvailable = true;

// ── Model Personality Profiles (Drawing) ──

const MODEL_PERSONALITIES = {
  gpt: {
    name: 'Precise',
    style: 'Geometric, clean lines, structured compositions.',
    brushVariation: false,
    curvePreference: 0.2,
    detailLevel: 0.8,
    colorPalette: 'structured'
  },
  claude: {
    name: 'Artistic',
    style: 'Uses curves, varied brush sizes, expressive strokes.',
    brushVariation: true,
    curvePreference: 0.8,
    detailLevel: 0.7,
    colorPalette: 'warm'
  },
  gemini: {
    name: 'Bold',
    style: 'Large shapes, vivid colors, high contrast compositions.',
    brushVariation: false,
    curvePreference: 0.4,
    detailLevel: 0.5,
    colorPalette: 'vivid'
  },
  o_series: {
    name: 'Detailed',
    style: 'Many small elements, intricate patterns, careful shading.',
    brushVariation: true,
    curvePreference: 0.5,
    detailLevel: 1.0,
    colorPalette: 'muted'
  },
  default: {
    name: 'Balanced',
    style: 'Standard drawing approach with moderate detail.',
    brushVariation: false,
    curvePreference: 0.5,
    detailLevel: 0.6,
    colorPalette: 'standard'
  }
};

// ── Color Palettes ──

const PALETTES = {
  structured: {
    sky: '#4A90D9', ground: '#8B7355', sun: '#FFD700', tree_trunk: '#654321',
    tree_canopy: '#228B22', house_wall: '#D2B48C', house_roof: '#8B0000',
    water: '#1E90FF', cloud: '#F0F0F0', flower_center: '#FFD700',
    flower_petal: '#FF69B4', mountain: '#696969', person: '#2F4F4F',
    star: '#FFD700', grass: '#32CD32', door: '#8B4513', window: '#87CEEB'
  },
  warm: {
    sky: '#5B8FB9', ground: '#A0826D', sun: '#FF8C00', tree_trunk: '#8B5E3C',
    tree_canopy: '#3CB371', house_wall: '#FFDAB9', house_roof: '#CD5C5C',
    water: '#4682B4', cloud: '#FFF8DC', flower_center: '#FF8C00',
    flower_petal: '#FF6347', mountain: '#808080', person: '#4A3728',
    star: '#FFA500', grass: '#6B8E23', door: '#A0522D', window: '#B0C4DE'
  },
  vivid: {
    sky: '#0066FF', ground: '#8B4513', sun: '#FFD700', tree_trunk: '#4B2800',
    tree_canopy: '#00CC00', house_wall: '#FF6600', house_roof: '#CC0000',
    water: '#0000FF', cloud: '#FFFFFF', flower_center: '#FFFF00',
    flower_petal: '#FF0066', mountain: '#555555', person: '#000000',
    star: '#FFFF00', grass: '#00FF00', door: '#660000', window: '#00CCFF'
  },
  muted: {
    sky: '#7B9CB5', ground: '#9C8A7A', sun: '#D4AA50', tree_trunk: '#7A6352',
    tree_canopy: '#5D8A5D', house_wall: '#C4B5A5', house_roof: '#8A5A5A',
    water: '#5A7A9A', cloud: '#D8D8D8', flower_center: '#C4A040',
    flower_petal: '#C47A8A', mountain: '#7A7A7A', person: '#4A4A4A',
    star: '#C4A040', grass: '#6A8A4A', door: '#6A5040', window: '#8AACCA'
  },
  standard: {
    sky: '#5BADE6', ground: '#8B7D6B', sun: '#FFD700', tree_trunk: '#6B4226',
    tree_canopy: '#2E8B57', house_wall: '#DEB887', house_roof: '#A52A2A',
    water: '#2196F3', cloud: '#ECEFF1', flower_center: '#FFD700',
    flower_petal: '#E91E63', mountain: '#757575', person: '#37474F',
    star: '#FFC107', grass: '#4CAF50', door: '#795548', window: '#90CAF9'
  }
};

// ── Known object recipes ──

const OBJECT_KEYWORDS = [
  'sun', 'house', 'tree', 'cat', 'mountain', 'ocean', 'sea', 'water',
  'person', 'man', 'woman', 'sky', 'cloud', 'flower', 'star', 'grass',
  'moon', 'bird', 'fish', 'car', 'boat', 'dog', 'heart', 'rainbow'
];

// ── Utility ──

function getPersonality(modelId) {
  const id = (modelId || '').toLowerCase();
  if (id.includes('o3') || id.includes('o1') || id.includes('o4')) return MODEL_PERSONALITIES.o_series;
  if (id.includes('gemini') || id.includes('flash')) return MODEL_PERSONALITIES.gemini;
  if (id.includes('claude') || id.includes('haiku') || id.includes('sonnet') || id.includes('opus')) return MODEL_PERSONALITIES.claude;
  if (id.includes('gpt') || id.includes('codex')) return MODEL_PERSONALITIES.gpt;
  return MODEL_PERSONALITIES.default;
}

function getPalette(personality) {
  return PALETTES[personality.colorPalette] || PALETTES.standard;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function jitter(val, amount) {
  return val + (Math.random() - 0.5) * amount;
}

// ── Draw Agent ──

class DrawAgent {
  constructor(modelId, side, copilotClient = null) {
    this.modelId = modelId;
    this.side = side; // 'left' or 'right'
    this.copilotClient = copilotClient;
    this.session = null;
    this.personality = getPersonality(modelId);
    this.timeRemaining = 300;
    this.commandsSent = 0;
    this.fallbackMode = !copilotClient;
    this.drawPhase = 'background'; // background, subject, details, finishing
    this.batchIndex = 0;
    this.seed = side === 'left' ? 12345 : 67890;
    this.subjectsDrawnCount = 0;
  }

  _seededRandom() {
    this.seed = (this.seed * 16807 + 0) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  _jitter(val, amount) {
    return val + (this._seededRandom() - 0.5) * amount;
  }

  async initialize() {
    if (this.fallbackMode) {
      console.log(`Draw ${this.side} (${this.modelId}) [${this.personality.name}] fallback mode`);
      return;
    }

    try {
      this.session = await this.copilotClient.createSession({ model: this.modelId });
      console.log(`Draw ${this.side} initialized with model ${this.modelId}`);
    } catch (error) {
      console.error(`Failed to create draw session for ${this.modelId}:`, error);
      this.fallbackMode = true;
    }
  }

  async generateCommands(prompt, canvasWidth, canvasHeight, timeRemaining, onThought) {
    this.timeRemaining = timeRemaining;

    if (!this.session && !this.fallbackMode) {
      await this.initialize();
    }

    if (this.fallbackMode) {
      return this.getFallbackCommands(prompt, canvasWidth, canvasHeight, timeRemaining, onThought);
    }

    return this.getLLMCommands(prompt, canvasWidth, canvasHeight, timeRemaining, onThought);
  }

  // ── LLM Drawing (Copilot SDK) ──

  async getLLMCommands(prompt, canvasWidth, canvasHeight, timeRemaining, onThought) {
    try {
      const drawPrompt = this.buildDrawPrompt(prompt, canvasWidth, canvasHeight, timeRemaining);
      const timeout = this.raceTimeout(10000);

      const responsePromise = this.session.sendAndWait(drawPrompt).then(response => {
        const text = response.message?.content || response.text || '';
        if (onThought && text) {
          const preview = text.substring(0, 200);
          onThought(preview);
        }
        return this.parseDrawResponse(text, canvasWidth, canvasHeight);
      });

      const result = await Promise.race([responsePromise, timeout]);

      if (!result || !Array.isArray(result) || result.length === 0) {
        console.warn(`No valid draw commands from ${this.modelId}, using fallback`);
        return this.getFallbackCommands(prompt, canvasWidth, canvasHeight, timeRemaining, onThought);
      }

      this.commandsSent += result.length;
      this.batchIndex++;
      return result;
    } catch (error) {
      console.error(`Draw LLM error (${this.modelId}):`, error);
      return this.getFallbackCommands(prompt, canvasWidth, canvasHeight, timeRemaining, onThought);
    }
  }

  buildDrawPrompt(prompt, canvasWidth, canvasHeight, timeRemaining) {
    const phase = this.getPhaseDescription(timeRemaining);

    return `You are an AI artist using ${this.modelId}. Draw "${prompt}" on a ${canvasWidth}x${canvasHeight} canvas.
You have ${timeRemaining}s remaining. Current phase: ${phase}. Batch #${this.batchIndex + 1}, commands sent so far: ${this.commandsSent}.

Return a JSON array of 20-50 drawing commands. Available commands:
  {"type":"setColor","color":"#RRGGBB"}
  {"type":"setBrushSize","size":N}
  {"type":"moveTo","x":N,"y":N}
  {"type":"lineTo","x":N,"y":N}
  {"type":"fillRect","x":N,"y":N,"width":N,"height":N}
  {"type":"strokeRect","x":N,"y":N,"width":N,"height":N}
  {"type":"circle","x":N,"y":N,"radius":N}
  {"type":"fillCircle","x":N,"y":N,"radius":N}
  {"type":"arc","x":N,"y":N,"radius":N,"startAngle":N,"endAngle":N}
  {"type":"text","x":N,"y":N,"text":"...","fontSize":N}
  {"type":"beginPath"}
  {"type":"closePath"}
  {"type":"fill"}
  {"type":"stroke"}
  {"type":"clear"}

Think about composition, then draw step by step. Start with background, then main subject, then details.
Canvas origin (0,0) is top-left. Y increases downward.

Return ONLY a valid JSON array of commands.`;
  }

  parseDrawResponse(text, canvasWidth, canvasHeight) {
    // Try to find JSON array in response
    try {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const commands = JSON.parse(arrayMatch[0]);
        if (Array.isArray(commands)) {
          return this.validateCommands(commands, canvasWidth, canvasHeight);
        }
      }
    } catch (e) {
      // fall through
    }

    // Try line-by-line JSON objects
    const commands = [];
    const objMatches = text.matchAll(/\{[^}]*"type"[^}]*\}/g);
    for (const match of objMatches) {
      try {
        const cmd = JSON.parse(match[0]);
        if (cmd.type) commands.push(cmd);
      } catch (e) {
        // skip invalid
      }
    }

    return commands.length > 0 ? this.validateCommands(commands, canvasWidth, canvasHeight) : [];
  }

  validateCommands(commands, canvasWidth, canvasHeight) {
    const validTypes = [
      'setColor', 'setBrushSize', 'moveTo', 'lineTo',
      'fillRect', 'strokeRect', 'circle', 'fillCircle', 'arc',
      'text', 'beginPath', 'closePath', 'fill', 'stroke', 'clear'
    ];

    return commands.filter(cmd => {
      if (!cmd || !validTypes.includes(cmd.type)) return false;

      // Clamp coordinates to canvas bounds
      if ('x' in cmd) cmd.x = clamp(cmd.x, 0, canvasWidth);
      if ('y' in cmd) cmd.y = clamp(cmd.y, 0, canvasHeight);
      if (cmd.width) cmd.width = clamp(cmd.width, 0, canvasWidth);
      if (cmd.height) cmd.height = clamp(cmd.height, 0, canvasHeight);
      if (cmd.radius) cmd.radius = clamp(cmd.radius, 1, Math.max(canvasWidth, canvasHeight));
      if (cmd.size) cmd.size = clamp(cmd.size, 1, 100);
      if (cmd.fontSize) cmd.fontSize = clamp(cmd.fontSize, 8, 200);

      return true;
    });
  }

  getPhaseDescription(timeRemaining) {
    if (timeRemaining > 200) return 'Background and composition';
    if (timeRemaining > 100) return 'Main subject and key elements';
    if (timeRemaining > 30) return 'Details and refinements';
    return 'Final touches';
  }

  // ── Fallback Strategy Engine ──

  getFallbackCommands(prompt, canvasWidth, canvasHeight, timeRemaining, onThought) {
    const pers = this.personality;
    const palette = getPalette(pers);
    const w = canvasWidth;
    const h = canvasHeight;
    const commands = [];

    // Parse prompt for known objects
    const keywords = this.parsePromptKeywords(prompt);

    const bi = this.batchIndex;

    // Progressive drawing based on batchIndex
    // Batches 0-2: Background
    if (bi <= 2) {
      if (bi === 0) {
        commands.push(...this.drawBackground(w, h, keywords, palette, pers));
      } else if (bi === 1) {
        // Additional background texture
        commands.push(...this.drawBackgroundTexture(w, h, keywords, palette, pers));
      } else {
        // Ground detail pass
        if (keywords.includes('grass') || keywords.includes('tree') || keywords.includes('flower')) {
          commands.push({ type: 'setColor', color: '#228B22' });
          commands.push({ type: 'setBrushSize', size: 1 });
          const skyRatio = this.side === 'left' ? 0.6 : 0.55;
          const grassY = Math.round(h * skyRatio);
          const step = Math.round(w * 0.06);
          const startX = this.side === 'left' ? 0 : Math.round(w * 0.5);
          const endX = this.side === 'left' ? Math.round(w * 0.5) : w;
          for (let gx = startX; gx < endX; gx += step) {
            const x = gx + Math.round(this._jitter(0, w * 0.02));
            commands.push({ type: 'moveTo', x, y: grassY });
            commands.push({ type: 'lineTo', x: x - 3, y: grassY - Math.round(this._jitter(8, 6)) });
          }
        }
      }
    }

    // Batches 3-8: Main subjects (add one subject per batch)
    if (bi >= 3 && bi <= 8) {
      const subjectIndex = bi - 3;
      const subjectKeywords = keywords.filter(kw => !['sky', 'grass', 'ocean'].includes(kw));
      if (subjectIndex < subjectKeywords.length) {
        commands.push(...this.drawSingleSubject(w, h, subjectKeywords, subjectIndex, palette, pers));
        this.subjectsDrawnCount++;
      } else if (subjectIndex === subjectKeywords.length) {
        // Draw all remaining subjects that didn't get individual batches
        commands.push(...this.drawSubjects(w, h, keywords, palette, pers));
      }
    }

    // Batches 9-20: Details (add detail elements incrementally)
    if (bi >= 9 && bi <= 20) {
      if (bi === 9) {
        commands.push(...this.drawDetails(w, h, keywords, palette, pers));
      } else {
        commands.push(...this.drawIncrementalDetails(w, h, keywords, palette, pers, bi));
      }
    }

    // Batches 21+: Refinements
    if (bi >= 21) {
      commands.push(...this.drawIncrementalDetails(w, h, keywords, palette, pers, bi));
      // Every 10 batches add a decorative element
      if (bi % 10 === 0) {
        commands.push(...this.drawDecorativeElement(w, h, palette, pers));
      }
    }

    // Finishing signature at batch 20
    if (bi === 20) {
      commands.push(...this.drawFinishing(w, h, palette, pers));
    }

    this.commandsSent += commands.length;
    this.batchIndex++;

    const progress = Math.min(100, Math.round((this.commandsSent / 500) * 100));
    const sideLabel = this.side === 'left' ? 'L→R' : 'R←L';
    const phaseLabel = bi <= 2 ? 'background' : bi <= 8 ? 'subjects' : bi <= 20 ? 'details' : 'refinements';
    const thought = `[${sideLabel} ${pers.name}] ${phaseLabel}: ${keywords.join(', ') || 'scene'} — batch #${bi + 1}, ${timeRemaining}s left, ${progress}%`;
    if (onThought) onThought(thought);

    return commands;
  }

  updatePhase(timeRemaining) {
    if (timeRemaining > 200) return (this.drawPhase = 'background');
    if (timeRemaining > 100) return (this.drawPhase = 'subject');
    if (timeRemaining > 30) return (this.drawPhase = 'details');
    return (this.drawPhase = 'finishing');
  }

  parsePromptKeywords(prompt) {
    const lower = (prompt || '').toLowerCase();
    const found = [];
    for (const kw of OBJECT_KEYWORDS) {
      if (lower.includes(kw)) found.push(kw);
    }
    // Map synonyms
    if (lower.includes('sea') && !found.includes('ocean')) found.push('ocean');
    if (lower.includes('water') && !found.includes('ocean')) found.push('ocean');
    if ((lower.includes('man') || lower.includes('woman')) && !found.includes('person')) found.push('person');

    // Default scene if nothing recognized
    if (found.length === 0) found.push('sky', 'grass', 'tree', 'sun');

    return [...new Set(found)];
  }

  // ── Scene Builders ──

  drawBackground(w, h, keywords, palette, pers) {
    const cmds = [];
    // Side-dependent sky/ground proportions
    const skyRatio = this.side === 'left' ? 0.6 : 0.55;

    // Sky
    if (keywords.includes('sky') || keywords.includes('sun') || keywords.includes('cloud') ||
        keywords.includes('star') || keywords.includes('moon') || keywords.includes('mountain') ||
        keywords.includes('rainbow')) {
      const skyH = Math.round(h * skyRatio);

      if (pers.detailLevel >= 0.8) {
        // Gradient sky using stacked rectangles — different tints per side
        const steps = 8;
        for (let i = 0; i < steps; i++) {
          const ratio = i / steps;
          let r, g, b;
          if (this.side === 'left') {
            r = Math.round(30 + ratio * 60);
            g = Math.round(100 + ratio * 50);
            b = Math.round(200 + ratio * 40);
          } else {
            // Right side: warmer / purple-shifted gradient
            r = Math.round(45 + ratio * 55);
            g = Math.round(80 + ratio * 55);
            b = Math.round(190 + ratio * 50);
          }
          const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          cmds.push({ type: 'setColor', color });
          cmds.push({ type: 'fillRect', x: 0, y: Math.round(i * skyH / steps), width: w, height: Math.round(skyH / steps) + 1 });
        }
      } else {
        cmds.push({ type: 'setColor', color: palette.sky });
        cmds.push({ type: 'fillRect', x: 0, y: 0, width: w, height: skyH });
      }
    }

    // Ground / grass
    if (keywords.includes('grass') || keywords.includes('tree') || keywords.includes('house') ||
        keywords.includes('flower') || keywords.includes('person')) {
      cmds.push({ type: 'setColor', color: palette.grass });
      cmds.push({ type: 'fillRect', x: 0, y: Math.round(h * skyRatio), width: w, height: Math.round(h * (1 - skyRatio)) });

      // Ground line
      cmds.push({ type: 'setColor', color: palette.ground });
      cmds.push({ type: 'setBrushSize', size: 3 });
      cmds.push({ type: 'moveTo', x: 0, y: Math.round(h * skyRatio) });
      cmds.push({ type: 'lineTo', x: w, y: Math.round(h * skyRatio) });
    }

    // Ocean
    if (keywords.includes('ocean')) {
      cmds.push({ type: 'setColor', color: palette.water });
      cmds.push({ type: 'fillRect', x: 0, y: Math.round(h * 0.5), width: w, height: Math.round(h * 0.5) });

      // Waves — side-dependent wave offset
      cmds.push({ type: 'setColor', color: '#FFFFFF' });
      cmds.push({ type: 'setBrushSize', size: 2 });
      const waveOffset = this.side === 'left' ? 0 : 10;
      for (let waveY = Math.round(h * 0.55); waveY < h; waveY += 30) {
        cmds.push({ type: 'moveTo', x: 0, y: waveY });
        for (let wx = waveOffset; wx < w; wx += 20) {
          cmds.push({ type: 'lineTo', x: wx + 10, y: waveY - 5 });
          cmds.push({ type: 'lineTo', x: wx + 20, y: waveY });
        }
      }
    }

    return cmds;
  }

  drawSubjects(w, h, keywords, palette, pers) {
    const cmds = [];
    const skyRatio = this.side === 'left' ? 0.6 : 0.55;
    // Left: objects flow left-to-right, Right: right-to-left
    let objectX = this.side === 'left'
      ? Math.round(w * 0.15)
      : Math.round(w * 0.85);
    const step = this.side === 'left'
      ? Math.round(w * 0.2)
      : -Math.round(w * 0.2);

    // Right side scales objects differently
    const sizeMul = this.side === 'left' ? 1.0 : 0.85;

    for (const kw of keywords) {
      const x = objectX;
      switch (kw) {
        case 'sun':
          cmds.push(...this.drawSun(x, Math.round(h * 0.12), Math.round(w * 0.06 * sizeMul), palette, pers));
          break;
        case 'moon':
          cmds.push(...this.drawMoon(
            this.side === 'left' ? Math.round(w * 0.8) : Math.round(w * 0.2),
            Math.round(h * 0.1), Math.round(w * 0.05 * sizeMul), palette));
          break;
        case 'cloud':
          cmds.push(...this.drawCloud(x, Math.round(h * 0.15), Math.round(w * 0.08 * sizeMul), palette, pers));
          if (pers.detailLevel > 0.5) {
            cmds.push(...this.drawCloud(x + Math.round(w * 0.3 * (this.side === 'left' ? 1 : -1)),
              Math.round(h * 0.1), Math.round(w * 0.06 * sizeMul), palette, pers));
          }
          break;
        case 'mountain':
          cmds.push(...this.drawMountain(
            this.side === 'left' ? Math.round(w * 0.3) : Math.round(w * 0.7),
            Math.round(h * skyRatio), Math.round(w * 0.4 * sizeMul), Math.round(h * 0.35 * sizeMul), palette, pers));
          if (pers.detailLevel > 0.6) {
            cmds.push(...this.drawMountain(
              this.side === 'left' ? Math.round(w * 0.6) : Math.round(w * 0.4),
              Math.round(h * skyRatio), Math.round(w * 0.3 * sizeMul), Math.round(h * 0.25 * sizeMul), palette, pers));
          }
          break;
        case 'tree':
          cmds.push(...this.drawTree(x, Math.round(h * skyRatio), Math.round(w * 0.04 * sizeMul), Math.round(h * 0.25 * sizeMul), palette, pers));
          break;
        case 'house':
          cmds.push(...this.drawHouse(x, Math.round(h * 0.35), Math.round(w * 0.2 * sizeMul), Math.round(h * 0.25 * sizeMul), palette, pers));
          break;
        case 'cat':
          cmds.push(...this.drawCat(x, Math.round(h * 0.5), Math.round(w * 0.06 * sizeMul), palette, pers));
          break;
        case 'dog':
          cmds.push(...this.drawDog(x, Math.round(h * 0.5), Math.round(w * 0.07 * sizeMul), palette, pers));
          break;
        case 'person':
          cmds.push(...this.drawPerson(x, Math.round(h * 0.35), Math.round(h * 0.25 * sizeMul), palette, pers));
          break;
        case 'flower':
          cmds.push(...this.drawFlower(x, Math.round(h * (skyRatio - 0.05)), Math.round(w * 0.025 * sizeMul), palette, pers));
          if (pers.detailLevel > 0.5) {
            cmds.push(...this.drawFlower(x + Math.round(w * 0.08 * (this.side === 'left' ? 1 : -1)),
              Math.round(h * (skyRatio - 0.03)), Math.round(w * 0.02 * sizeMul), palette, pers));
          }
          break;
        case 'star':
          cmds.push(...this.drawStar(x, Math.round(h * 0.08), Math.round(w * 0.02 * sizeMul), palette));
          cmds.push(...this.drawStar(x + Math.round(w * 0.15 * (this.side === 'left' ? 1 : -1)),
            Math.round(h * 0.05), Math.round(w * 0.015 * sizeMul), palette));
          cmds.push(...this.drawStar(x + Math.round(w * 0.3 * (this.side === 'left' ? 1 : -1)),
            Math.round(h * 0.12), Math.round(w * 0.018 * sizeMul), palette));
          break;
        case 'bird':
          cmds.push(...this.drawBird(x, Math.round(h * 0.2), Math.round(w * 0.03 * sizeMul), palette));
          break;
        case 'fish':
          cmds.push(...this.drawFish(x, Math.round(h * 0.65), Math.round(w * 0.05 * sizeMul), palette));
          break;
        case 'boat':
          cmds.push(...this.drawBoat(x, Math.round(h * 0.48), Math.round(w * 0.1 * sizeMul), palette));
          break;
        case 'heart':
          cmds.push(...this.drawHeart(Math.round(w * 0.5), Math.round(h * 0.4), Math.round(w * 0.08 * sizeMul), palette));
          break;
        case 'rainbow':
          cmds.push(...this.drawRainbow(Math.round(w * 0.5), Math.round(h * 0.4), Math.round(w * 0.35 * sizeMul), pers));
          break;
        case 'car':
          cmds.push(...this.drawCar(x, Math.round(h * 0.52), Math.round(w * 0.12 * sizeMul), palette));
          break;
        // sky, grass, ocean handled in background
        default:
          break;
      }

      objectX += step;
      if (this.side === 'left' && objectX > w * 0.85) objectX = Math.round(w * 0.15);
      if (this.side === 'right' && objectX < w * 0.15) objectX = Math.round(w * 0.85);
    }

    return cmds;
  }

  drawDetails(w, h, keywords, palette, pers) {
    const cmds = [];
    const skyRatio = this.side === 'left' ? 0.6 : 0.55;

    // Add grass detail strokes
    if (keywords.includes('grass') || keywords.includes('tree') || keywords.includes('flower')) {
      cmds.push({ type: 'setColor', color: '#228B22' });
      cmds.push({ type: 'setBrushSize', size: 1 });
      const grassY = Math.round(h * skyRatio);
      for (let gx = 0; gx < w; gx += Math.round(w * 0.03)) {
        const x = gx + Math.round(this._jitter(0, w * 0.02));
        cmds.push({ type: 'moveTo', x, y: grassY });
        cmds.push({ type: 'lineTo', x: x - 3, y: grassY - Math.round(this._jitter(8, 6)) });
      }
    }

    // Add cloud details
    if (keywords.includes('cloud') && pers.detailLevel > 0.7) {
      const cloudX = this.side === 'left' ? Math.round(w * 0.6) : Math.round(w * 0.4);
      cmds.push(...this.drawCloud(cloudX, Math.round(h * 0.2), Math.round(w * 0.05), palette, pers));
    }

    // Add small stars in night scenes
    if (keywords.includes('star') || keywords.includes('moon')) {
      cmds.push({ type: 'setColor', color: '#FFFFFF' });
      cmds.push({ type: 'setBrushSize', size: 2 });
      for (let i = 0; i < 12; i++) {
        const sx = Math.round(this._seededRandom() * w);
        const sy = Math.round(this._seededRandom() * h * 0.4);
        cmds.push({ type: 'fillCircle', x: sx, y: sy, radius: 1 });
      }
    }

    return cmds;
  }

  drawFinishing(w, h, palette, pers) {
    const cmds = [];

    // Signature
    cmds.push({ type: 'setColor', color: '#555555' });
    cmds.push({ type: 'text', x: Math.round(w * 0.02), y: Math.round(h * 0.96), text: `AI: ${this.modelId}`, fontSize: 10 });

    return cmds;
  }

  // Draw a single subject by index (for progressive batch rendering)
  drawSingleSubject(w, h, subjectKeywords, index, palette, pers) {
    if (index >= subjectKeywords.length) return [];
    const kw = subjectKeywords[index];
    const skyRatio = this.side === 'left' ? 0.6 : 0.55;
    const sizeMul = this.side === 'left' ? 1.0 : 0.85;

    // Calculate position for this subject
    const baseX = this.side === 'left' ? 0.15 : 0.85;
    const stepFrac = this.side === 'left' ? 0.2 : -0.2;
    let objectX = Math.round(w * (baseX + stepFrac * index));
    objectX = clamp(objectX, Math.round(w * 0.1), Math.round(w * 0.9));

    const cmds = [];
    const x = objectX;

    switch (kw) {
      case 'sun':
        cmds.push(...this.drawSun(x, Math.round(h * 0.12), Math.round(w * 0.06 * sizeMul), palette, pers));
        break;
      case 'moon':
        cmds.push(...this.drawMoon(
          this.side === 'left' ? Math.round(w * 0.8) : Math.round(w * 0.2),
          Math.round(h * 0.1), Math.round(w * 0.05 * sizeMul), palette));
        break;
      case 'cloud':
        cmds.push(...this.drawCloud(x, Math.round(h * 0.15), Math.round(w * 0.08 * sizeMul), palette, pers));
        break;
      case 'mountain':
        cmds.push(...this.drawMountain(x, Math.round(h * skyRatio),
          Math.round(w * 0.4 * sizeMul), Math.round(h * 0.35 * sizeMul), palette, pers));
        break;
      case 'tree':
        cmds.push(...this.drawTree(x, Math.round(h * skyRatio), Math.round(w * 0.04 * sizeMul), Math.round(h * 0.25 * sizeMul), palette, pers));
        break;
      case 'house':
        cmds.push(...this.drawHouse(x, Math.round(h * 0.35), Math.round(w * 0.2 * sizeMul), Math.round(h * 0.25 * sizeMul), palette, pers));
        break;
      case 'cat':
        cmds.push(...this.drawCat(x, Math.round(h * 0.5), Math.round(w * 0.06 * sizeMul), palette, pers));
        break;
      case 'dog':
        cmds.push(...this.drawDog(x, Math.round(h * 0.5), Math.round(w * 0.07 * sizeMul), palette, pers));
        break;
      case 'person':
        cmds.push(...this.drawPerson(x, Math.round(h * 0.35), Math.round(h * 0.25 * sizeMul), palette, pers));
        break;
      case 'flower':
        cmds.push(...this.drawFlower(x, Math.round(h * (skyRatio - 0.05)), Math.round(w * 0.025 * sizeMul), palette, pers));
        break;
      case 'star':
        cmds.push(...this.drawStar(x, Math.round(h * 0.08), Math.round(w * 0.02 * sizeMul), palette));
        break;
      case 'bird':
        cmds.push(...this.drawBird(x, Math.round(h * 0.2), Math.round(w * 0.03 * sizeMul), palette));
        break;
      case 'fish':
        cmds.push(...this.drawFish(x, Math.round(h * 0.65), Math.round(w * 0.05 * sizeMul), palette));
        break;
      case 'boat':
        cmds.push(...this.drawBoat(x, Math.round(h * 0.48), Math.round(w * 0.1 * sizeMul), palette));
        break;
      case 'heart':
        cmds.push(...this.drawHeart(Math.round(w * 0.5), Math.round(h * 0.4), Math.round(w * 0.08 * sizeMul), palette));
        break;
      case 'rainbow':
        cmds.push(...this.drawRainbow(Math.round(w * 0.5), Math.round(h * 0.4), Math.round(w * 0.35 * sizeMul), pers));
        break;
      case 'car':
        cmds.push(...this.drawCar(x, Math.round(h * 0.52), Math.round(w * 0.12 * sizeMul), palette));
        break;
      default:
        break;
    }
    return cmds;
  }

  // Additional background texture for batch 1
  drawBackgroundTexture(w, h, keywords, palette, pers) {
    const cmds = [];
    const skyRatio = this.side === 'left' ? 0.6 : 0.55;

    if (keywords.includes('grass') || keywords.includes('tree')) {
      // Subtle ground color variation
      const groundY = Math.round(h * skyRatio);
      const patchCount = this.side === 'left' ? 5 : 4;
      for (let i = 0; i < patchCount; i++) {
        const px = Math.round(this._seededRandom() * w);
        const py = groundY + Math.round(this._seededRandom() * h * (1 - skyRatio));
        const patchW = Math.round(w * 0.1 + this._seededRandom() * w * 0.1);
        const patchH = Math.round(h * 0.03 + this._seededRandom() * h * 0.04);
        const shade = this.side === 'left' ? '#3A7A3A' : '#2E6E2E';
        cmds.push({ type: 'setColor', color: shade });
        cmds.push({ type: 'fillRect', x: px, y: py, width: patchW, height: patchH });
      }
    }

    if (keywords.includes('sky') || keywords.includes('sun')) {
      // Atmospheric haze near horizon
      const hazeY = Math.round(h * (skyRatio - 0.05));
      const hazeColor = this.side === 'left' ? '#B0C4DE40' : '#C8D8E840';
      cmds.push({ type: 'setColor', color: hazeColor });
      cmds.push({ type: 'fillRect', x: 0, y: hazeY, width: w, height: Math.round(h * 0.05) });
    }

    return cmds;
  }

  // Incremental detail strokes for later batches
  drawIncrementalDetails(w, h, keywords, palette, pers, batchIndex) {
    const cmds = [];
    const skyRatio = this.side === 'left' ? 0.6 : 0.55;
    const groundY = Math.round(h * skyRatio);

    // Texture strokes on ground area
    const strokeCount = 3 + Math.round(this._seededRandom() * 4);
    for (let i = 0; i < strokeCount; i++) {
      const sx = Math.round(this._seededRandom() * w);
      const sy = groundY + Math.round(this._seededRandom() * h * (1 - skyRatio));
      const len = Math.round(5 + this._seededRandom() * 15);
      const angle = this._seededRandom() * Math.PI;
      const ex = Math.round(sx + Math.cos(angle) * len);
      const ey = Math.round(sy + Math.sin(angle) * len);

      const greenShade = Math.round(50 + this._seededRandom() * 100);
      cmds.push({ type: 'setColor', color: `#22${greenShade.toString(16).padStart(2, '0')}22` });
      cmds.push({ type: 'setBrushSize', size: 1 });
      cmds.push({ type: 'moveTo', x: clamp(sx, 0, w), y: clamp(sy, 0, h) });
      cmds.push({ type: 'lineTo', x: clamp(ex, 0, w), y: clamp(ey, 0, h) });
    }

    // Occasional sky details (birds, specks)
    if (batchIndex % 3 === 0) {
      const bx = Math.round(this._seededRandom() * w);
      const by = Math.round(this._seededRandom() * groundY * 0.7);
      const birdSize = Math.round(4 + this._seededRandom() * 8);
      cmds.push({ type: 'setColor', color: '#444444' });
      cmds.push({ type: 'setBrushSize', size: 1 });
      cmds.push({ type: 'moveTo', x: bx - birdSize, y: by + Math.round(birdSize * 0.3) });
      cmds.push({ type: 'lineTo', x: bx, y: by });
      cmds.push({ type: 'lineTo', x: bx + birdSize, y: by + Math.round(birdSize * 0.3) });
    }

    // Shadow/shading strokes under objects
    if (batchIndex % 4 === 0) {
      const shadowX = Math.round(this._seededRandom() * w * 0.7 + w * 0.15);
      cmds.push({ type: 'setColor', color: 'rgba(0,0,0,0.1)' });
      cmds.push({ type: 'fillRect', x: shadowX, y: groundY - 2, width: Math.round(w * 0.08), height: 4 });
    }

    return cmds;
  }

  // Decorative element for every 10th batch in refinement phase
  drawDecorativeElement(w, h, palette, pers) {
    const cmds = [];
    const skyRatio = this.side === 'left' ? 0.6 : 0.55;
    const choice = Math.round(this._seededRandom() * 4);

    switch (choice) {
      case 0: {
        // Small flower
        const fx = Math.round(this._seededRandom() * w * 0.6 + w * 0.2);
        const fy = Math.round(h * (skyRatio - 0.02) + this._seededRandom() * h * 0.05);
        cmds.push(...this.drawFlower(fx, fy, Math.round(w * 0.015), palette, pers));
        break;
      }
      case 1: {
        // Distant bird
        const bx = Math.round(this._seededRandom() * w);
        const by = Math.round(this._seededRandom() * h * 0.3);
        cmds.push(...this.drawBird(bx, by, Math.round(w * 0.015), palette));
        break;
      }
      case 2: {
        // Small cloud puff
        const cx = Math.round(this._seededRandom() * w);
        const cy = Math.round(h * 0.05 + this._seededRandom() * h * 0.2);
        cmds.push({ type: 'setColor', color: palette.cloud });
        cmds.push({ type: 'fillCircle', x: cx, y: cy, radius: Math.round(w * 0.02) });
        break;
      }
      case 3: {
        // Extra star
        const sx = Math.round(this._seededRandom() * w);
        const sy = Math.round(this._seededRandom() * h * 0.3);
        cmds.push(...this.drawStar(sx, sy, Math.round(w * 0.01), palette));
        break;
      }
      default: {
        // Ground speckle
        cmds.push({ type: 'setColor', color: palette.ground });
        cmds.push({ type: 'setBrushSize', size: 2 });
        for (let i = 0; i < 5; i++) {
          const x = Math.round(this._seededRandom() * w);
          const y = Math.round(h * skyRatio + this._seededRandom() * h * (1 - skyRatio));
          cmds.push({ type: 'fillCircle', x, y, radius: 2 });
        }
        break;
      }
    }

    return cmds;
  }

  // ── Object Drawing Recipes ──

  drawSun(cx, cy, r, palette, pers) {
    const cmds = [];
    // Sun body
    cmds.push({ type: 'setColor', color: palette.sun });
    cmds.push({ type: 'fillCircle', x: cx, y: cy, radius: r });

    // Rays
    cmds.push({ type: 'setBrushSize', size: pers.name === 'Bold' ? 4 : 2 });
    const rayCount = pers.detailLevel > 0.7 ? 12 : 8;
    const rayLen = Math.round(r * 0.7);
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const x1 = Math.round(cx + Math.cos(angle) * (r + 4));
      const y1 = Math.round(cy + Math.sin(angle) * (r + 4));
      const x2 = Math.round(cx + Math.cos(angle) * (r + 4 + rayLen));
      const y2 = Math.round(cy + Math.sin(angle) * (r + 4 + rayLen));
      cmds.push({ type: 'moveTo', x: x1, y: y1 });
      cmds.push({ type: 'lineTo', x: x2, y: y2 });
    }

    return cmds;
  }

  drawMoon(cx, cy, r, palette) {
    const cmds = [];
    cmds.push({ type: 'setColor', color: '#F5F5DC' });
    cmds.push({ type: 'fillCircle', x: cx, y: cy, radius: r });
    // Crescent shadow
    cmds.push({ type: 'setColor', color: '#191970' });
    cmds.push({ type: 'fillCircle', x: cx + Math.round(r * 0.3), y: cy - Math.round(r * 0.1), radius: Math.round(r * 0.85) });
    return cmds;
  }

  drawCloud(cx, cy, r, palette, pers) {
    const cmds = [];
    cmds.push({ type: 'setColor', color: palette.cloud });
    // Overlapping circles
    cmds.push({ type: 'fillCircle', x: cx, y: cy, radius: r });
    cmds.push({ type: 'fillCircle', x: cx - Math.round(r * 0.8), y: cy + Math.round(r * 0.2), radius: Math.round(r * 0.7) });
    cmds.push({ type: 'fillCircle', x: cx + Math.round(r * 0.8), y: cy + Math.round(r * 0.2), radius: Math.round(r * 0.7) });
    cmds.push({ type: 'fillCircle', x: cx - Math.round(r * 0.4), y: cy - Math.round(r * 0.3), radius: Math.round(r * 0.6) });
    cmds.push({ type: 'fillCircle', x: cx + Math.round(r * 0.4), y: cy - Math.round(r * 0.3), radius: Math.round(r * 0.6) });
    return cmds;
  }

  drawMountain(cx, baseY, width, height, palette, pers) {
    const cmds = [];
    cmds.push({ type: 'setColor', color: palette.mountain });
    cmds.push({ type: 'beginPath' });
    cmds.push({ type: 'moveTo', x: cx - Math.round(width / 2), y: baseY });
    cmds.push({ type: 'lineTo', x: cx, y: baseY - height });
    cmds.push({ type: 'lineTo', x: cx + Math.round(width / 2), y: baseY });
    cmds.push({ type: 'closePath' });
    cmds.push({ type: 'fill' });

    // Snow cap
    if (pers.detailLevel > 0.5) {
      cmds.push({ type: 'setColor', color: '#FFFFFF' });
      cmds.push({ type: 'beginPath' });
      const snowH = Math.round(height * 0.2);
      const snowW = Math.round(width * 0.2);
      cmds.push({ type: 'moveTo', x: cx - Math.round(snowW / 2), y: baseY - height + snowH });
      cmds.push({ type: 'lineTo', x: cx, y: baseY - height });
      cmds.push({ type: 'lineTo', x: cx + Math.round(snowW / 2), y: baseY - height + snowH });
      cmds.push({ type: 'closePath' });
      cmds.push({ type: 'fill' });
    }

    return cmds;
  }

  drawTree(x, groundY, trunkW, height, palette, pers) {
    const cmds = [];
    const trunkH = Math.round(height * 0.4);
    const canopyR = Math.round(height * 0.35);

    // Trunk
    cmds.push({ type: 'setColor', color: palette.tree_trunk });
    cmds.push({ type: 'fillRect', x: x - Math.round(trunkW / 2), y: groundY - trunkH, width: trunkW, height: trunkH });

    // Canopy
    cmds.push({ type: 'setColor', color: palette.tree_canopy });
    if (pers.curvePreference > 0.6) {
      // Round canopy (Claude-style)
      cmds.push({ type: 'fillCircle', x, y: groundY - trunkH - Math.round(canopyR * 0.5), radius: canopyR });
    } else {
      // Triangle canopy (geometric)
      cmds.push({ type: 'beginPath' });
      cmds.push({ type: 'moveTo', x: x - canopyR, y: groundY - trunkH + 5 });
      cmds.push({ type: 'lineTo', x, y: groundY - trunkH - Math.round(canopyR * 1.2) });
      cmds.push({ type: 'lineTo', x: x + canopyR, y: groundY - trunkH + 5 });
      cmds.push({ type: 'closePath' });
      cmds.push({ type: 'fill' });
    }

    return cmds;
  }

  drawHouse(x, y, width, height, palette, pers) {
    const cmds = [];

    // Walls
    cmds.push({ type: 'setColor', color: palette.house_wall });
    cmds.push({ type: 'fillRect', x, y, width, height });

    // Roof
    cmds.push({ type: 'setColor', color: palette.house_roof });
    cmds.push({ type: 'beginPath' });
    cmds.push({ type: 'moveTo', x: x - Math.round(width * 0.1), y });
    cmds.push({ type: 'lineTo', x: x + Math.round(width / 2), y: y - Math.round(height * 0.5) });
    cmds.push({ type: 'lineTo', x: x + width + Math.round(width * 0.1), y });
    cmds.push({ type: 'closePath' });
    cmds.push({ type: 'fill' });

    // Door
    const doorW = Math.round(width * 0.2);
    const doorH = Math.round(height * 0.45);
    cmds.push({ type: 'setColor', color: palette.door });
    cmds.push({ type: 'fillRect', x: x + Math.round(width * 0.4), y: y + height - doorH, width: doorW, height: doorH });

    // Windows
    const winSize = Math.round(width * 0.15);
    cmds.push({ type: 'setColor', color: palette.window });
    cmds.push({ type: 'fillRect', x: x + Math.round(width * 0.1), y: y + Math.round(height * 0.2), width: winSize, height: winSize });
    cmds.push({ type: 'fillRect', x: x + Math.round(width * 0.7), y: y + Math.round(height * 0.2), width: winSize, height: winSize });

    // Window cross lines
    cmds.push({ type: 'setColor', color: '#333333' });
    cmds.push({ type: 'setBrushSize', size: 1 });
    // Left window
    const lx = x + Math.round(width * 0.1);
    const wy = y + Math.round(height * 0.2);
    cmds.push({ type: 'moveTo', x: lx + Math.round(winSize / 2), y: wy });
    cmds.push({ type: 'lineTo', x: lx + Math.round(winSize / 2), y: wy + winSize });
    cmds.push({ type: 'moveTo', x: lx, y: wy + Math.round(winSize / 2) });
    cmds.push({ type: 'lineTo', x: lx + winSize, y: wy + Math.round(winSize / 2) });

    return cmds;
  }

  drawCat(cx, baseY, size, palette, pers) {
    const cmds = [];

    // Body (oval via wide circle)
    cmds.push({ type: 'setColor', color: '#FF8C00' });
    cmds.push({ type: 'fillCircle', x: cx, y: baseY, radius: size });

    // Head
    const headR = Math.round(size * 0.6);
    const headY = baseY - Math.round(size * 1.2);
    cmds.push({ type: 'fillCircle', x: cx, y: headY, radius: headR });

    // Ears (triangles)
    cmds.push({ type: 'beginPath' });
    cmds.push({ type: 'moveTo', x: cx - headR, y: headY - Math.round(headR * 0.3) });
    cmds.push({ type: 'lineTo', x: cx - Math.round(headR * 0.4), y: headY - Math.round(headR * 1.2) });
    cmds.push({ type: 'lineTo', x: cx - Math.round(headR * 0.1), y: headY - Math.round(headR * 0.2) });
    cmds.push({ type: 'closePath' });
    cmds.push({ type: 'fill' });

    cmds.push({ type: 'beginPath' });
    cmds.push({ type: 'moveTo', x: cx + headR, y: headY - Math.round(headR * 0.3) });
    cmds.push({ type: 'lineTo', x: cx + Math.round(headR * 0.4), y: headY - Math.round(headR * 1.2) });
    cmds.push({ type: 'lineTo', x: cx + Math.round(headR * 0.1), y: headY - Math.round(headR * 0.2) });
    cmds.push({ type: 'closePath' });
    cmds.push({ type: 'fill' });

    // Eyes
    cmds.push({ type: 'setColor', color: '#000000' });
    cmds.push({ type: 'fillCircle', x: cx - Math.round(headR * 0.35), y: headY - Math.round(headR * 0.1), radius: 3 });
    cmds.push({ type: 'fillCircle', x: cx + Math.round(headR * 0.35), y: headY - Math.round(headR * 0.1), radius: 3 });

    // Whiskers
    cmds.push({ type: 'setBrushSize', size: 1 });
    const whiskerY = headY + Math.round(headR * 0.2);
    for (const dir of [-1, 1]) {
      for (const dy of [-4, 0, 4]) {
        cmds.push({ type: 'moveTo', x: cx + dir * Math.round(headR * 0.3), y: whiskerY + dy });
        cmds.push({ type: 'lineTo', x: cx + dir * Math.round(headR * 1.5), y: whiskerY + dy * 2 });
      }
    }

    // Tail
    cmds.push({ type: 'setColor', color: '#FF8C00' });
    cmds.push({ type: 'setBrushSize', size: 3 });
    cmds.push({ type: 'moveTo', x: cx + size, y: baseY });
    cmds.push({ type: 'lineTo', x: cx + Math.round(size * 1.8), y: baseY - Math.round(size * 0.8) });
    cmds.push({ type: 'lineTo', x: cx + Math.round(size * 2), y: baseY - Math.round(size * 1.2) });

    return cmds;
  }

  drawDog(cx, baseY, size, palette, pers) {
    const cmds = [];

    // Body
    cmds.push({ type: 'setColor', color: '#8B6914' });
    cmds.push({ type: 'fillCircle', x: cx, y: baseY, radius: size });

    // Head
    const headR = Math.round(size * 0.55);
    const headY = baseY - Math.round(size * 1.1);
    cmds.push({ type: 'fillCircle', x: cx, y: headY, radius: headR });

    // Floppy ears
    cmds.push({ type: 'setColor', color: '#6B4914' });
    cmds.push({ type: 'fillCircle', x: cx - headR, y: headY + Math.round(headR * 0.3), radius: Math.round(headR * 0.5) });
    cmds.push({ type: 'fillCircle', x: cx + headR, y: headY + Math.round(headR * 0.3), radius: Math.round(headR * 0.5) });

    // Eyes
    cmds.push({ type: 'setColor', color: '#000000' });
    cmds.push({ type: 'fillCircle', x: cx - Math.round(headR * 0.3), y: headY - Math.round(headR * 0.1), radius: 3 });
    cmds.push({ type: 'fillCircle', x: cx + Math.round(headR * 0.3), y: headY - Math.round(headR * 0.1), radius: 3 });

    // Nose
    cmds.push({ type: 'fillCircle', x: cx, y: headY + Math.round(headR * 0.3), radius: 4 });

    // Tail
    cmds.push({ type: 'setColor', color: '#8B6914' });
    cmds.push({ type: 'setBrushSize', size: 4 });
    cmds.push({ type: 'moveTo', x: cx + size, y: baseY - Math.round(size * 0.3) });
    cmds.push({ type: 'lineTo', x: cx + Math.round(size * 1.6), y: baseY - Math.round(size * 1.2) });

    return cmds;
  }

  drawPerson(cx, topY, height, palette, pers) {
    const cmds = [];
    const headR = Math.round(height * 0.12);
    const bodyLen = Math.round(height * 0.4);
    const limbLen = Math.round(height * 0.3);

    cmds.push({ type: 'setColor', color: palette.person });
    cmds.push({ type: 'setBrushSize', size: 3 });

    // Head
    cmds.push({ type: 'fillCircle', x: cx, y: topY + headR, radius: headR });

    // Body
    cmds.push({ type: 'moveTo', x: cx, y: topY + headR * 2 });
    cmds.push({ type: 'lineTo', x: cx, y: topY + headR * 2 + bodyLen });

    // Arms
    cmds.push({ type: 'moveTo', x: cx, y: topY + headR * 2 + Math.round(bodyLen * 0.2) });
    cmds.push({ type: 'lineTo', x: cx - limbLen, y: topY + headR * 2 + Math.round(bodyLen * 0.5) });
    cmds.push({ type: 'moveTo', x: cx, y: topY + headR * 2 + Math.round(bodyLen * 0.2) });
    cmds.push({ type: 'lineTo', x: cx + limbLen, y: topY + headR * 2 + Math.round(bodyLen * 0.5) });

    // Legs
    const hipY = topY + headR * 2 + bodyLen;
    cmds.push({ type: 'moveTo', x: cx, y: hipY });
    cmds.push({ type: 'lineTo', x: cx - Math.round(limbLen * 0.6), y: hipY + limbLen });
    cmds.push({ type: 'moveTo', x: cx, y: hipY });
    cmds.push({ type: 'lineTo', x: cx + Math.round(limbLen * 0.6), y: hipY + limbLen });

    return cmds;
  }

  drawFlower(cx, baseY, petalR, palette, pers) {
    const cmds = [];

    // Stem
    cmds.push({ type: 'setColor', color: '#228B22' });
    cmds.push({ type: 'setBrushSize', size: 2 });
    cmds.push({ type: 'moveTo', x: cx, y: baseY });
    cmds.push({ type: 'lineTo', x: cx, y: baseY + Math.round(petalR * 4) });

    // Petals
    cmds.push({ type: 'setColor', color: palette.flower_petal });
    const petalCount = pers.detailLevel > 0.7 ? 8 : 6;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const px = Math.round(cx + Math.cos(angle) * petalR * 1.3);
      const py = Math.round(baseY + Math.sin(angle) * petalR * 1.3);
      cmds.push({ type: 'fillCircle', x: px, y: py, radius: petalR });
    }

    // Center
    cmds.push({ type: 'setColor', color: palette.flower_center });
    cmds.push({ type: 'fillCircle', x: cx, y: baseY, radius: Math.round(petalR * 0.6) });

    return cmds;
  }

  drawStar(cx, cy, size, palette) {
    const cmds = [];
    cmds.push({ type: 'setColor', color: palette.star });
    cmds.push({ type: 'setBrushSize', size: 2 });
    // Simple star: cross + X
    cmds.push({ type: 'moveTo', x: cx, y: cy - size });
    cmds.push({ type: 'lineTo', x: cx, y: cy + size });
    cmds.push({ type: 'moveTo', x: cx - size, y: cy });
    cmds.push({ type: 'lineTo', x: cx + size, y: cy });
    const d = Math.round(size * 0.7);
    cmds.push({ type: 'moveTo', x: cx - d, y: cy - d });
    cmds.push({ type: 'lineTo', x: cx + d, y: cy + d });
    cmds.push({ type: 'moveTo', x: cx + d, y: cy - d });
    cmds.push({ type: 'lineTo', x: cx - d, y: cy + d });
    return cmds;
  }

  drawBird(cx, cy, size, palette) {
    const cmds = [];
    cmds.push({ type: 'setColor', color: '#333333' });
    cmds.push({ type: 'setBrushSize', size: 2 });
    // Simple V-shape bird
    cmds.push({ type: 'moveTo', x: cx - size, y: cy + Math.round(size * 0.3) });
    cmds.push({ type: 'lineTo', x: cx, y: cy });
    cmds.push({ type: 'lineTo', x: cx + size, y: cy + Math.round(size * 0.3) });
    return cmds;
  }

  drawFish(cx, cy, size, palette) {
    const cmds = [];
    cmds.push({ type: 'setColor', color: '#FF6347' });
    // Body ellipse (approximate with circle)
    cmds.push({ type: 'fillCircle', x: cx, y: cy, radius: size });
    // Tail
    cmds.push({ type: 'beginPath' });
    cmds.push({ type: 'moveTo', x: cx + size, y: cy });
    cmds.push({ type: 'lineTo', x: cx + Math.round(size * 1.8), y: cy - Math.round(size * 0.6) });
    cmds.push({ type: 'lineTo', x: cx + Math.round(size * 1.8), y: cy + Math.round(size * 0.6) });
    cmds.push({ type: 'closePath' });
    cmds.push({ type: 'fill' });
    // Eye
    cmds.push({ type: 'setColor', color: '#000000' });
    cmds.push({ type: 'fillCircle', x: cx - Math.round(size * 0.4), y: cy - Math.round(size * 0.2), radius: 3 });
    return cmds;
  }

  drawBoat(cx, waterY, width, palette) {
    const cmds = [];
    const halfW = Math.round(width / 2);
    const boatH = Math.round(width * 0.25);
    // Hull
    cmds.push({ type: 'setColor', color: '#8B4513' });
    cmds.push({ type: 'beginPath' });
    cmds.push({ type: 'moveTo', x: cx - halfW, y: waterY });
    cmds.push({ type: 'lineTo', x: cx - Math.round(halfW * 0.7), y: waterY + boatH });
    cmds.push({ type: 'lineTo', x: cx + Math.round(halfW * 0.7), y: waterY + boatH });
    cmds.push({ type: 'lineTo', x: cx + halfW, y: waterY });
    cmds.push({ type: 'closePath' });
    cmds.push({ type: 'fill' });
    // Mast
    cmds.push({ type: 'setColor', color: '#654321' });
    cmds.push({ type: 'setBrushSize', size: 3 });
    cmds.push({ type: 'moveTo', x: cx, y: waterY });
    cmds.push({ type: 'lineTo', x: cx, y: waterY - Math.round(width * 0.6) });
    // Sail
    cmds.push({ type: 'setColor', color: '#FFFFFF' });
    cmds.push({ type: 'beginPath' });
    cmds.push({ type: 'moveTo', x: cx, y: waterY - Math.round(width * 0.55) });
    cmds.push({ type: 'lineTo', x: cx + Math.round(halfW * 0.6), y: waterY - Math.round(width * 0.1) });
    cmds.push({ type: 'lineTo', x: cx, y: waterY - Math.round(width * 0.05) });
    cmds.push({ type: 'closePath' });
    cmds.push({ type: 'fill' });
    return cmds;
  }

  drawHeart(cx, cy, size, palette) {
    const cmds = [];
    cmds.push({ type: 'setColor', color: '#FF1493' });
    // Heart = two circles + triangle
    const r = Math.round(size * 0.5);
    cmds.push({ type: 'fillCircle', x: cx - r, y: cy - Math.round(r * 0.3), radius: r });
    cmds.push({ type: 'fillCircle', x: cx + r, y: cy - Math.round(r * 0.3), radius: r });
    cmds.push({ type: 'beginPath' });
    cmds.push({ type: 'moveTo', x: cx - Math.round(size * 0.95), y: cy });
    cmds.push({ type: 'lineTo', x: cx, y: cy + size });
    cmds.push({ type: 'lineTo', x: cx + Math.round(size * 0.95), y: cy });
    cmds.push({ type: 'closePath' });
    cmds.push({ type: 'fill' });
    return cmds;
  }

  drawRainbow(cx, baseY, radius, pers) {
    const cmds = [];
    const colors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
    cmds.push({ type: 'setBrushSize', size: pers.name === 'Bold' ? 8 : 5 });
    for (let i = 0; i < colors.length; i++) {
      cmds.push({ type: 'setColor', color: colors[i] });
      cmds.push({ type: 'arc', x: cx, y: baseY, radius: radius - i * 8, startAngle: Math.PI, endAngle: 0 });
      cmds.push({ type: 'stroke' });
    }
    return cmds;
  }

  drawCar(cx, baseY, width, palette) {
    const cmds = [];
    const halfW = Math.round(width / 2);
    const bodyH = Math.round(width * 0.25);
    const roofH = Math.round(width * 0.2);

    // Body
    cmds.push({ type: 'setColor', color: '#CC0000' });
    cmds.push({ type: 'fillRect', x: cx - halfW, y: baseY, width, height: bodyH });

    // Roof
    cmds.push({ type: 'fillRect', x: cx - Math.round(halfW * 0.5), y: baseY - roofH, width: Math.round(width * 0.5), height: roofH });

    // Windows
    cmds.push({ type: 'setColor', color: palette.window });
    const winW = Math.round(width * 0.18);
    cmds.push({ type: 'fillRect', x: cx - Math.round(halfW * 0.4), y: baseY - Math.round(roofH * 0.85), width: winW, height: Math.round(roofH * 0.7) });
    cmds.push({ type: 'fillRect', x: cx + Math.round(halfW * 0.05), y: baseY - Math.round(roofH * 0.85), width: winW, height: Math.round(roofH * 0.7) });

    // Wheels
    cmds.push({ type: 'setColor', color: '#1A1A1A' });
    const wheelR = Math.round(width * 0.08);
    cmds.push({ type: 'fillCircle', x: cx - Math.round(halfW * 0.6), y: baseY + bodyH, radius: wheelR });
    cmds.push({ type: 'fillCircle', x: cx + Math.round(halfW * 0.6), y: baseY + bodyH, radius: wheelR });

    return cmds;
  }

  raceTimeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Draw command timeout')), ms);
    });
  }

  destroy() {
    this.session = null;
    this.copilotClient = null;
    this.commandsSent = 0;
    this.batchIndex = 0;
  }
}

module.exports = { DrawAgent };
