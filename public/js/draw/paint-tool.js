// paint-tool.js — Canvas command executor for the Draw Arena
// Bridges AI-generated paint commands to actual canvas rendering

class PaintTool {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.currentColor = '#000000';
    this.brushSize = 2;
    this.commandCount = 0;
  }

  executeCommands(commands) {
    if (!Array.isArray(commands)) return;
    for (const cmd of commands) {
      this.executeCommand(cmd);
    }
  }

  executeCommand(cmd) {
    if (!cmd || !cmd.type) return;
    const ctx = this.ctx;
    this.commandCount++;

    switch (cmd.type) {
      case 'setColor':
        this.currentColor = cmd.color || '#000000';
        ctx.fillStyle = this.currentColor;
        ctx.strokeStyle = this.currentColor;
        break;

      case 'setBrushSize':
        this.brushSize = cmd.size || 2;
        ctx.lineWidth = this.brushSize;
        break;

      case 'moveTo':
        ctx.moveTo(cmd.x, cmd.y);
        break;

      case 'lineTo':
        ctx.lineTo(cmd.x, cmd.y);
        ctx.stroke();
        break;

      case 'fillRect':
        ctx.fillRect(cmd.x, cmd.y, cmd.width, cmd.height);
        break;

      case 'strokeRect':
        ctx.strokeRect(cmd.x, cmd.y, cmd.width, cmd.height);
        break;

      case 'circle':
        ctx.beginPath();
        ctx.arc(cmd.x, cmd.y, cmd.radius || 10, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'fillCircle':
        ctx.beginPath();
        ctx.arc(cmd.x, cmd.y, cmd.radius || 10, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'arc':
        ctx.beginPath();
        ctx.arc(cmd.x, cmd.y, cmd.radius || 10, cmd.startAngle || 0, cmd.endAngle || Math.PI * 2);
        ctx.stroke();
        break;

      case 'text':
        ctx.font = `${cmd.fontSize || 16}px sans-serif`;
        ctx.fillText(cmd.text || '', cmd.x, cmd.y);
        break;

      case 'beginPath':
        ctx.beginPath();
        break;

      case 'closePath':
        ctx.closePath();
        break;

      case 'fill':
        ctx.fill();
        break;

      case 'stroke':
        ctx.stroke();
        break;

      case 'clear':
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        break;

      default:
        // Unknown command — skip silently
        this.commandCount--;
        break;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.commandCount = 0;
  }

  fillBackground(color) {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  getStats() {
    return { commandCount: this.commandCount };
  }
}

window.PaintTool = PaintTool;
