/**
 * GameRenderer - Canvas rendering engine for LLM Fighter
 * Handles all visual rendering: characters, HUD, effects, animations
 */
class GameRenderer {
    constructor(canvas, leftPanel, rightPanel) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.leftPanel = leftPanel;
        this.rightPanel = rightPanel;

        this.width = 800;
        this.height = 450;
        this.groundY = 350;

        this.colors = {
            p1: '#00ffff',
            p2: '#ff00ff',
            yellow: '#ffff00',
            red: '#ff0000',
            green: '#00ff00',
            white: '#ffffff',
            dark: '#0a0a0a'
        };

        // P1 cyan palette: highlight → base → shadow → outline
        this.p1Palette = {
            highlight: '#88ffff',
            base: '#00ffff',
            mid: '#00bbdd',
            shadow: '#006688',
            outline: '#003344',
            skin: '#ffddbb',
            skinShadow: '#ddbb99'
        };
        // P2 magenta palette
        this.p2Palette = {
            highlight: '#ff88ff',
            base: '#ff00ff',
            mid: '#cc00cc',
            shadow: '#880088',
            outline: '#440044',
            skin: '#ffddbb',
            skinShadow: '#ddbb99'
        };

        this.animFrame = 0;

        // --- Effects system ---
        this.particles = [];
        this.screenShake = { x: 0, y: 0, frames: 0 };
        this.criticalFlash = 0;
        this.floatingTexts = [];
        this.actionLogs = { p1: [], p2: [] };

        // Delayed health bars (for SF-style drain)
        this.displayHealth = { p1: 100, p2: 100 };

        // Neon sign animation phase
        this.neonPhase = 0;

        // Lightning timer (random)
        this.lightningTimer = 300 + Math.random() * 600;
        this.lightningFlash = 0;

        // Previous positions for dodge afterimage
        this.prevPositions = { p1: null, p2: null };

        // Hitstop effect
        this.hitstopFrames = 0;

        // Dust particles (separate from hit sparks)
        this.dustParticles = [];

        // Hit flash tracking per player (white overlay frames)
        this.hitFlashFrames = { p1: 0, p2: 0 };

        // KO overlay fade-in alpha
        this.koOverlayAlpha = 0;
        this.koOverlayActive = false;

        // Track previous states for landing/dodge dust detection
        this.prevStates = { p1: 'idle', p2: 'idle' };
    }

    /**
     * Main render loop
     */
    render(gameState) {
        // Hitstop: freeze animation when active
        const inHitstop = (gameState.hitstopFrames || 0) > 0;
        if (!inHitstop) {
            this.animFrame++;
        }
        this.neonPhase += 0.02;

        const ctx = this.ctx;

        // --- Process events ---
        this._processEvents(gameState);

        // --- Screen shake offset ---
        let shakeX = 0, shakeY = 0;
        if (this.screenShake.frames > 0) {
            shakeX = (Math.random() - 0.5) * 8;
            shakeY = (Math.random() - 0.5) * 8;
            this.screenShake.frames--;
        }

        ctx.save();
        ctx.translate(shakeX, shakeY);

        // --- Hitstop zoom effect ---
        if (inHitstop) {
            ctx.translate(this.width / 2, this.height / 2);
            ctx.scale(1.02, 1.02);
            ctx.translate(-this.width / 2, -this.height / 2);
        }

        // --- Critical hit white flash ---
        if (this.criticalFlash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this.criticalFlash * 0.6})`;
            ctx.fillRect(-10, -10, this.width + 20, this.height + 20);
            this.criticalFlash -= 0.15;
        }

        // Clear
        ctx.fillStyle = '#1a0a2e';
        ctx.fillRect(-10, -10, this.width + 20, this.height + 20);

        // Background lightning
        if (this.lightningFlash > 0) {
            ctx.fillStyle = `rgba(200,200,255,${this.lightningFlash * 0.12})`;
            ctx.fillRect(-10, -10, this.width + 20, this.height + 20);
            this.lightningFlash -= 0.25;
        }
        this.lightningTimer--;
        if (this.lightningTimer <= 0) {
            this.lightningFlash = 1;
            this.lightningTimer = 400 + Math.random() * 800;
        }

        // Reset KO overlay when not in ending phases
        if (gameState.phase !== 'round_end' && gameState.phase !== 'match_end') {
            this.koOverlayActive = false;
            this.koOverlayAlpha = 0;
        }

        this.drawStage();

        if (gameState.phase === 'fighting' || gameState.phase === 'round_end' || gameState.phase === 'match_end') {
            if (gameState.players.p1 && gameState.players.p2) {
                this._updateAfterimages(gameState);
                this._trackStateTransitions(gameState);

                // Ground shadows (drawn before fighters)
                this._drawGroundShadow(ctx, gameState.players.p1, 'p1');
                this._drawGroundShadow(ctx, gameState.players.p2, 'p2');

                this.drawFighter(gameState.players.p1, 'p1', gameState);
                this.drawFighter(gameState.players.p2, 'p2', gameState);
            }
            this._drawParticles(ctx);
            this._drawDustParticles(ctx);
            this._drawFloatingTexts(ctx);
            this.drawHUD(gameState);
            this._drawActionLog(ctx);
        } else if (gameState.phase === 'select') {
            ctx.fillStyle = '#ffff00';
            ctx.font = '20px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 15;
            ctx.fillText('SELECT YOUR FIGHTERS', this.width / 2, this.height / 2);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#00ff00';
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillText('Choose a model for each side', this.width / 2, this.height / 2 + 30);
        }

        // Critical flash overlay on top
        if (this.criticalFlash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this.criticalFlash * 0.4})`;
            ctx.fillRect(-10, -10, this.width + 20, this.height + 20);
        }

        const displayPhase = gameState._phase || gameState.phase;
        if (displayPhase === 'intro') {
            this.drawRoundIntroOverlay(gameState.round);
        } else if (gameState.phase === 'round_end' || gameState.phase === 'match_end') {
            const winner = gameState.players.p1.health >= gameState.players.p2.health ? 'p1' : 'p2';
            this.drawKOOverlay(winner);
        }

        // --- Hitstop white pulse overlay ---
        if (inHitstop) {
            ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.04 * Math.sin(this.neonPhase * 20)})`;
            ctx.fillRect(-10, -10, this.width + 20, this.height + 20);
        }

        ctx.restore();
    }

    // ───────────────────── EVENT PROCESSING ─────────────────────
    _processEvents(gameState) {
        const events = gameState.events || [];
        events.forEach(ev => {
            if (ev === 'critical') {
                this.criticalFlash = 1;
                this.screenShake.frames = 6;
            }
            if (ev === 'p1_staggered' || ev === 'p2_staggered') {
                // stagger handled per-frame via isStaggered
            }
            if (ev === 'p1_dodged') this._addFloatingText(gameState.players.p1.x, this.groundY - 130, 'DODGE!', '#00ff00');
            if (ev === 'p2_dodged') this._addFloatingText(gameState.players.p2.x, this.groundY - 130, 'DODGE!', '#00ff00');
        });
    }

    // ───────────────────── STAGE BACKGROUND ─────────────────────
    drawStage() {
        const ctx = this.ctx;

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.groundY);
        skyGrad.addColorStop(0, '#050510');
        skyGrad.addColorStop(1, '#1a0a2e');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.width, this.groundY);

        // Cityscape silhouette
        ctx.fillStyle = '#0d0d1a';
        const buildings = [
            [0, 120, 60, 230], [55, 90, 50, 260], [100, 140, 70, 210],
            [165, 60, 40, 290], [200, 100, 80, 250], [275, 130, 55, 220],
            [325, 70, 45, 280], [365, 110, 90, 240], [450, 80, 50, 270],
            [495, 140, 65, 210], [555, 50, 55, 300], [605, 100, 70, 250],
            [670, 130, 60, 220], [725, 75, 80, 275]
        ];
        buildings.forEach(([bx, by, bw, bh]) => {
            ctx.fillRect(bx, by, bw, bh);
        });

        // Building windows (tiny lit squares)
        ctx.fillStyle = 'rgba(255, 200, 50, 0.15)';
        buildings.forEach(([bx, by, bw, bh]) => {
            for (let wy = by + 10; wy < by + bh - 10; wy += 18) {
                for (let wx = bx + 6; wx < bx + bw - 6; wx += 12) {
                    if (Math.sin(wx * 13.7 + wy * 7.3) > 0.1) {
                        ctx.fillRect(wx, wy, 5, 7);
                    }
                }
            }
        });

        // Neon signs (pulsing rectangles)
        const neonBrightness = 0.4 + 0.3 * Math.sin(this.neonPhase * 3);
        const neonBrightness2 = 0.4 + 0.3 * Math.sin(this.neonPhase * 2.3 + 1);
        ctx.fillStyle = `rgba(255, 0, 100, ${neonBrightness})`;
        ctx.fillRect(135, 105, 30, 10);
        ctx.shadowColor = `rgba(255, 0, 100, ${neonBrightness})`;
        ctx.shadowBlur = 12;
        ctx.fillRect(135, 105, 30, 10);
        ctx.shadowBlur = 0;

        ctx.fillStyle = `rgba(0, 200, 255, ${neonBrightness2})`;
        ctx.fillRect(520, 70, 25, 8);
        ctx.shadowColor = `rgba(0, 200, 255, ${neonBrightness2})`;
        ctx.shadowBlur = 12;
        ctx.fillRect(520, 70, 25, 8);
        ctx.shadowBlur = 0;

        ctx.fillStyle = `rgba(180, 255, 0, ${neonBrightness})`;
        ctx.fillRect(370, 90, 20, 8);
        ctx.shadowColor = `rgba(180, 255, 0, ${neonBrightness})`;
        ctx.shadowBlur = 10;
        ctx.fillRect(370, 90, 20, 8);
        ctx.shadowBlur = 0;

        // Floor with depth
        const floorGrad = ctx.createLinearGradient(0, this.groundY, 0, this.height);
        floorGrad.addColorStop(0, '#2a1a4a');
        floorGrad.addColorStop(1, '#120828');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

        // Perspective grid lines converging toward center
        const cx = this.width / 2;
        const vanishY = this.groundY - 20;
        ctx.strokeStyle = 'rgba(138, 43, 226, 0.25)';
        ctx.lineWidth = 1;

        // Horizontal lines with increasing spacing (perspective)
        for (let i = 0; i < 8; i++) {
            const t = i / 8;
            const y = this.groundY + t * t * (this.height - this.groundY);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }

        // Converging vertical lines
        const numLines = 14;
        for (let i = 0; i <= numLines; i++) {
            const bottomX = (i / numLines) * this.width;
            ctx.beginPath();
            ctx.moveTo(bottomX, this.height);
            ctx.lineTo(cx + (bottomX - cx) * 0.15, this.groundY);
            ctx.stroke();
        }

        // Center line glow
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, this.groundY);
        ctx.lineTo(cx, this.height);
        ctx.stroke();
    }

    // ───────────────────── FIGHTER RENDERING ─────────────────────
    _getPalette(side) {
        return side === 'p1' ? this.p1Palette : this.p2Palette;
    }

    _updateAfterimages(gameState) {
        ['p1', 'p2'].forEach(side => {
            const p = gameState.players[side];
            if (p.state === 'dodging' && this.prevPositions[side]) {
                // keep previous for afterimage
            }
            this.prevPositions[side] = { x: p.x, y: p.y, state: p.state, facing: p.facing };
        });
    }

    drawFighter(player, side, gameState) {
        const ctx = this.ctx;
        const x = player.x;
        let yOffset = 0;
        if (player.state === 'jumping') yOffset = -60;
        const y = this.groundY - player.y + yOffset;
        const pal = this._getPalette(side);
        const facing = player.facing === 'right' ? 1 : -1;

        // Dodge afterimage
        if (player.state === 'dodging') {
            const prev = this.prevPositions[side];
            if (prev) {
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.translate(prev.x + (facing * -20), this.groundY - prev.y);
                if (facing === -1) ctx.scale(-1, 1);
                this._drawDetailedBody(ctx, pal, 'idle');
                ctx.restore();

                ctx.save();
                ctx.globalAlpha = 0.12;
                ctx.translate(prev.x + (facing * -40), this.groundY - prev.y);
                if (facing === -1) ctx.scale(-1, 1);
                this._drawDetailedBody(ctx, pal, 'idle');
                ctx.restore();
            }
        }

        ctx.save();
        ctx.translate(x, y);
        if (facing === -1) ctx.scale(-1, 1);

        // Draw based on state
        const state = player.state || 'idle';
        this._drawDetailedBody(ctx, pal, state);

        // Hit flash: white overlay for 2 frames when struck
        if (state === 'hit' && this.hitFlashFrames[side] > 0) {
            ctx.fillStyle = `rgba(255,255,255,${this.hitFlashFrames[side] > 1 ? 0.7 : 0.4})`;
            ctx.fillRect(-35, -130, 70, 135);
            this.hitFlashFrames[side]--;
        }

        // Energy trail on special moves (uppercut/sweep)
        if (state === 'uppercut' || state === 'sweep') {
            this._drawEnergyTrail(ctx, state, pal, side);
        }

        ctx.restore();

        // Stagger stars
        if (player.isStaggered) {
            this._drawStaggerStars(ctx, x, y - 115);
        }

        // Action state floating text
        if (player._lastRenderedState !== player.state && player.state !== 'idle') {
            player._lastRenderedState = player.state;
            const labels = {
                punch_high: 'PUNCH!', punch_low: 'LOW PUNCH!',
                kick_high: 'HIGH KICK!', kick_low: 'KICK!',
                block: 'BLOCK!', uppercut: 'UPPERCUT!',
                sweep: 'SWEEP!', dodging: 'DODGE!',
                crouching: 'CROUCH!', jumping: 'JUMP!'
            };
            const colors = {
                punch_high: '#ffff00', punch_low: '#ffdd00',
                kick_high: '#ff8800', kick_low: '#ff6600',
                block: '#4488ff', uppercut: '#ff0044',
                sweep: '#ff4400', dodging: '#00ff00',
                crouching: '#88aaff', jumping: '#66ffcc'
            };
            if (labels[player.state]) {
                this._addFloatingText(x, y - 125, labels[player.state], colors[player.state] || '#ffffff');
                this.actionLogs[side].push(labels[player.state]);
                if (this.actionLogs[side].length > 3) this.actionLogs[side].shift();
            }
        }

        // Combo counter
        const combo = player.comboCount || 0;
        if (combo > 1) {
            this._drawComboCounter(ctx, x, y - 140, combo, this.colors[side]);
        }

        // Model name
        ctx.fillStyle = this.colors[side];
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(player.model || '', x, y - 120 + yOffset * -1 - 10);

        // Enhanced hit effects
        if (player.state === 'hit') {
            // Dramatic hit sparks (bigger, brighter)
            this._spawnEnhancedHitSparks(x + (facing * -15), y - 60);
            // Dust cloud at feet on impact
            this._spawnDustCloud(x, this.groundY, 'hit');
            // Trigger hit flash for 2 frames
            if (this.hitFlashFrames[side] <= 0) {
                this.hitFlashFrames[side] = 2;
            }
        }
    }

    // ──── Detailed humanoid body with shading ────
    _drawDetailedBody(ctx, pal, state) {
        switch (state) {
            case 'punch_high': case 'punch_low':
                this._drawPunchPose(ctx, pal, state === 'punch_high'); break;
            case 'kick_high': case 'kick_low':
                this._drawKickPose(ctx, pal, state === 'kick_high'); break;
            case 'block':
                this._drawBlockPose(ctx, pal); break;
            case 'hit':
                this._drawHitPose(ctx, pal); break;
            case 'ko':
                this._drawKOPose(ctx, pal); break;
            case 'dodging':
                this._drawDodgePose(ctx, pal); break;
            case 'crouching':
                this._drawCrouchPose(ctx, pal); break;
            case 'jumping':
                this._drawJumpPose(ctx, pal); break;
            case 'uppercut':
                this._drawUppercutPose(ctx, pal); break;
            case 'sweep':
                this._drawSweepPose(ctx, pal); break;
            default:
                this._drawIdlePose(ctx, pal); break;
        }
    }

    // Helper: outlined filled rectangle
    _oRect(ctx, x, y, w, h, fill, outline) {
        ctx.fillStyle = outline || '#000';
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
    }

    // Helper: shaded rectangle (left highlight, right shadow)
    _sRect(ctx, x, y, w, h, base, highlight, shadow, outline) {
        // outline
        ctx.fillStyle = outline;
        ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        // shadow half
        ctx.fillStyle = shadow;
        ctx.fillRect(x, y, w, h);
        // base
        ctx.fillStyle = base;
        ctx.fillRect(x, y, Math.ceil(w * 0.7), h);
        // highlight strip
        ctx.fillStyle = highlight;
        ctx.fillRect(x, y, Math.ceil(w * 0.25), h);
    }

    // ──────── IDLE POSE ────────
    _drawIdlePose(ctx, p) {
        const bob = Math.sin(this.animFrame * 0.08) * 2;
        // Head
        this._sRect(ctx, -11, -100 + bob, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(-7, -93 + bob, 5, 5);
        ctx.fillRect(3, -93 + bob, 5, 5);
        ctx.fillStyle = '#111';
        ctx.fillRect(-5, -91 + bob, 3, 3);
        ctx.fillRect(5, -91 + bob, 3, 3);
        // Neck
        this._oRect(ctx, -5, -78 + bob, 10, 6, p.skin, p.outline);
        // Torso
        this._sRect(ctx, -14, -72 + bob, 28, 32, p.base, p.highlight, p.shadow, p.outline);
        // Belt
        ctx.fillStyle = p.mid;
        ctx.fillRect(-14, -44 + bob, 28, 5);
        // Upper arms
        this._sRect(ctx, -22, -70 + bob, 8, 18, p.base, p.highlight, p.shadow, p.outline);
        this._sRect(ctx, 14, -70 + bob, 8, 18, p.base, p.highlight, p.shadow, p.outline);
        // Forearms
        this._sRect(ctx, -22, -52 + bob, 7, 16, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 15, -52 + bob, 7, 16, p.mid, p.base, p.shadow, p.outline);
        // Hands
        this._oRect(ctx, -22, -36 + bob, 7, 7, p.skin, p.outline);
        this._oRect(ctx, 15, -36 + bob, 7, 7, p.skin, p.outline);
        // Upper legs
        this._sRect(ctx, -13, -39 + bob, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 2, -39 + bob, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        // Lower legs
        this._sRect(ctx, -12, -19 + bob, 10, 16, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 3, -19 + bob, 10, 16, p.mid, p.base, p.shadow, p.outline);
        // Feet
        this._oRect(ctx, -14, -3, 12, 5, p.shadow, p.outline);
        this._oRect(ctx, 2, -3, 12, 5, p.shadow, p.outline);
    }

    // ──────── PUNCH POSE ────────
    _drawPunchPose(ctx, p, isHigh) {
        const armY = isHigh ? -82 : -58;
        // Head
        this._sRect(ctx, -11, -100, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-7, -93, 5, 5); ctx.fillRect(3, -93, 5, 5);
        ctx.fillStyle = '#111';
        ctx.fillRect(-5, -91, 3, 3); ctx.fillRect(5, -91, 3, 3);
        // Neck
        this._oRect(ctx, -5, -78, 10, 6, p.skin, p.outline);
        // Torso rotated slightly
        this._sRect(ctx, -12, -72, 26, 32, p.base, p.highlight, p.shadow, p.outline);
        ctx.fillStyle = p.mid;
        ctx.fillRect(-12, -44, 26, 5);
        // Back arm
        this._sRect(ctx, -22, -70, 8, 18, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -22, -52, 7, 14, p.shadow, p.mid, p.outline, p.outline);
        this._oRect(ctx, -22, -38, 7, 7, p.skin, p.outline);
        // Extended punch arm
        this._sRect(ctx, 14, -70, 8, 14, p.base, p.highlight, p.shadow, p.outline);
        this._sRect(ctx, 18, armY, 28, 10, p.mid, p.highlight, p.shadow, p.outline);
        // Fist
        this._oRect(ctx, 46, armY - 1, 10, 12, p.skin, p.outline);
        ctx.fillStyle = p.base;
        ctx.fillRect(47, armY, 8, 10);
        // Legs
        this._sRect(ctx, -13, -39, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 2, -39, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -12, -19, 10, 16, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 3, -19, 10, 16, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -14, -3, 12, 5, p.shadow, p.outline);
        this._oRect(ctx, 2, -3, 12, 5, p.shadow, p.outline);
    }

    // ──────── KICK POSE ────────
    _drawKickPose(ctx, p, isHigh) {
        const legY = isHigh ? -72 : -45;
        // Head
        this._sRect(ctx, -11, -100, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#fff'; ctx.fillRect(-7, -93, 5, 5); ctx.fillRect(3, -93, 5, 5);
        ctx.fillStyle = '#111'; ctx.fillRect(-5, -91, 3, 3); ctx.fillRect(5, -91, 3, 3);
        this._oRect(ctx, -5, -78, 10, 6, p.skin, p.outline);
        // Torso leaning back
        this._sRect(ctx, -16, -72, 28, 32, p.base, p.highlight, p.shadow, p.outline);
        ctx.fillStyle = p.mid; ctx.fillRect(-16, -44, 28, 5);
        // Arms guard
        this._sRect(ctx, -24, -70, 8, 28, p.base, p.highlight, p.shadow, p.outline);
        this._sRect(ctx, 14, -70, 8, 28, p.base, p.highlight, p.shadow, p.outline);
        this._oRect(ctx, -24, -42, 7, 7, p.skin, p.outline);
        this._oRect(ctx, 15, -42, 7, 7, p.skin, p.outline);
        // Standing leg
        this._sRect(ctx, -13, -39, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -12, -19, 10, 16, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -14, -3, 12, 5, p.shadow, p.outline);
        // Extended kick leg
        this._sRect(ctx, 2, legY, 35, 10, p.mid, p.highlight, p.shadow, p.outline);
        this._oRect(ctx, 37, legY - 1, 12, 12, p.shadow, p.outline);
    }

    // ──────── BLOCK POSE ────────
    _drawBlockPose(ctx, p) {
        // Head
        this._sRect(ctx, -11, -98, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#fff'; ctx.fillRect(-7, -91, 5, 5); ctx.fillRect(3, -91, 5, 5);
        ctx.fillStyle = '#111'; ctx.fillRect(-5, -89, 3, 3); ctx.fillRect(5, -89, 3, 3);
        this._oRect(ctx, -5, -76, 10, 6, p.skin, p.outline);
        // Torso
        this._sRect(ctx, -14, -70, 28, 32, p.base, p.highlight, p.shadow, p.outline);
        ctx.fillStyle = p.mid; ctx.fillRect(-14, -42, 28, 5);
        // Arms crossed guard
        this._sRect(ctx, -8, -72, 10, 32, p.highlight, p.base, p.mid, p.outline);
        this._sRect(ctx, -2, -72, 10, 32, p.highlight, p.base, p.mid, p.outline);
        // Block effect glow
        ctx.fillStyle = `rgba(100,150,255,${0.15 + 0.1 * Math.sin(this.animFrame * 0.2)})`;
        ctx.fillRect(-12, -75, 24, 38);
        // Legs
        this._sRect(ctx, -13, -37, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 2, -37, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -12, -17, 10, 14, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 3, -17, 10, 14, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -14, -3, 12, 5, p.shadow, p.outline);
        this._oRect(ctx, 2, -3, 12, 5, p.shadow, p.outline);
    }

    // ──────── HIT POSE ────────
    _drawHitPose(ctx, p) {
        // Head recoiling
        this._sRect(ctx, -11, -106, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        // X eyes
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(-7, -99, 5, 5); ctx.fillRect(3, -99, 5, 5);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-6, -98, 3, 1); ctx.fillRect(-5, -97, 1, 3);
        ctx.fillRect(4, -98, 3, 1); ctx.fillRect(5, -97, 1, 3);
        this._oRect(ctx, -5, -84, 10, 6, p.skin, p.outline);
        // Torso arched
        this._sRect(ctx, -14, -78, 28, 32, p.base, p.shadow, p.shadow, p.outline);
        // Arms thrown back
        this._sRect(ctx, -28, -76, 8, 26, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 20, -76, 8, 26, p.shadow, p.mid, p.outline, p.outline);
        this._oRect(ctx, -28, -50, 7, 7, p.skin, p.outline);
        this._oRect(ctx, 21, -50, 7, 7, p.skin, p.outline);
        // Legs
        this._sRect(ctx, -13, -46, 11, 22, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 2, -46, 11, 22, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -12, -24, 10, 18, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 3, -24, 10, 18, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -14, -6, 12, 5, p.shadow, p.outline);
        this._oRect(ctx, 2, -6, 12, 5, p.shadow, p.outline);
    }

    // ──────── KO POSE ────────
    _drawKOPose(ctx, p) {
        ctx.save();
        ctx.rotate(Math.PI / 2);
        this._sRect(ctx, -11, -28, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-6, -21, 3, 1); ctx.fillRect(-5, -20, 1, 3);
        ctx.fillRect(4, -21, 3, 1); ctx.fillRect(5, -20, 1, 3);
        this._sRect(ctx, -14, -6, 28, 32, p.base, p.shadow, p.shadow, p.outline);
        this._sRect(ctx, -24, -2, 8, 24, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 16, -2, 8, 24, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -13, 26, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 2, 26, 11, 20, p.shadow, p.mid, p.outline, p.outline);
        ctx.restore();
    }

    // ──────── DODGE POSE ────────
    _drawDodgePose(ctx, p) {
        // Body tilted, lunging sideways
        ctx.save();
        ctx.rotate(-0.25);
        // Head
        this._sRect(ctx, -11, -95, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#fff'; ctx.fillRect(-7, -88, 5, 5); ctx.fillRect(3, -88, 5, 5);
        ctx.fillStyle = '#111'; ctx.fillRect(-5, -86, 3, 3); ctx.fillRect(5, -86, 3, 3);
        this._oRect(ctx, -5, -73, 10, 6, p.skin, p.outline);
        // Torso leaning
        this._sRect(ctx, -12, -67, 26, 30, p.base, p.highlight, p.shadow, p.outline);
        ctx.fillStyle = p.mid; ctx.fillRect(-12, -41, 26, 5);
        // Arms trailing
        this._sRect(ctx, -24, -65, 8, 22, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 14, -65, 8, 22, p.mid, p.base, p.shadow, p.outline);
        // Legs in motion
        this._sRect(ctx, -13, -36, 11, 18, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 6, -36, 11, 18, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -12, -18, 10, 14, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 7, -18, 10, 14, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -14, -4, 12, 5, p.shadow, p.outline);
        this._oRect(ctx, 6, -4, 12, 5, p.shadow, p.outline);
        ctx.restore();
    }

    // ──────── CROUCH POSE ────────
    _drawCrouchPose(ctx, p) {
        // Head lower
        this._sRect(ctx, -11, -68, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#fff'; ctx.fillRect(-7, -61, 5, 5); ctx.fillRect(3, -61, 5, 5);
        ctx.fillStyle = '#111'; ctx.fillRect(-5, -59, 3, 3); ctx.fillRect(5, -59, 3, 3);
        this._oRect(ctx, -5, -46, 10, 5, p.skin, p.outline);
        // Torso compressed
        this._sRect(ctx, -14, -41, 28, 22, p.base, p.highlight, p.shadow, p.outline);
        ctx.fillStyle = p.mid; ctx.fillRect(-14, -23, 28, 4);
        // Arms out to sides
        this._sRect(ctx, -24, -40, 8, 18, p.base, p.highlight, p.shadow, p.outline);
        this._sRect(ctx, 16, -40, 8, 18, p.base, p.highlight, p.shadow, p.outline);
        this._oRect(ctx, -24, -22, 7, 7, p.skin, p.outline);
        this._oRect(ctx, 17, -22, 7, 7, p.skin, p.outline);
        // Bent legs
        this._sRect(ctx, -16, -19, 14, 10, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 2, -19, 14, 10, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -18, -9, 12, 6, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 6, -9, 12, 6, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -20, -3, 14, 5, p.shadow, p.outline);
        this._oRect(ctx, 6, -3, 14, 5, p.shadow, p.outline);
    }

    // ──────── JUMP POSE ────────
    _drawJumpPose(ctx, p) {
        // Arms up, body extended
        // Head
        this._sRect(ctx, -11, -110, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#fff'; ctx.fillRect(-7, -103, 5, 5); ctx.fillRect(3, -103, 5, 5);
        ctx.fillStyle = '#111'; ctx.fillRect(-5, -101, 3, 3); ctx.fillRect(5, -101, 3, 3);
        this._oRect(ctx, -5, -88, 10, 6, p.skin, p.outline);
        // Torso
        this._sRect(ctx, -14, -82, 28, 32, p.base, p.highlight, p.shadow, p.outline);
        ctx.fillStyle = p.mid; ctx.fillRect(-14, -54, 28, 5);
        // Arms reaching up
        this._sRect(ctx, -22, -108, 8, 22, p.base, p.highlight, p.shadow, p.outline);
        this._sRect(ctx, 14, -108, 8, 22, p.base, p.highlight, p.shadow, p.outline);
        this._oRect(ctx, -22, -112, 7, 7, p.skin, p.outline);
        this._oRect(ctx, 15, -112, 7, 7, p.skin, p.outline);
        // Legs tucked
        this._sRect(ctx, -13, -49, 11, 16, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 2, -49, 11, 16, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -16, -33, 10, 14, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 6, -33, 10, 14, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -18, -19, 10, 5, p.shadow, p.outline);
        this._oRect(ctx, 8, -19, 10, 5, p.shadow, p.outline);
    }

    // ──────── UPPERCUT POSE ────────
    _drawUppercutPose(ctx, p) {
        // Body extended upward, one fist high
        // Head
        this._sRect(ctx, -9, -115, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#fff'; ctx.fillRect(-5, -108, 5, 5); ctx.fillRect(5, -108, 5, 5);
        ctx.fillStyle = '#111'; ctx.fillRect(-3, -106, 3, 3); ctx.fillRect(7, -106, 3, 3);
        this._oRect(ctx, -3, -93, 10, 6, p.skin, p.outline);
        // Torso stretched
        this._sRect(ctx, -12, -87, 26, 36, p.base, p.highlight, p.shadow, p.outline);
        ctx.fillStyle = p.mid; ctx.fillRect(-12, -55, 26, 5);
        // Back arm down
        this._sRect(ctx, -22, -80, 8, 26, p.shadow, p.mid, p.outline, p.outline);
        this._oRect(ctx, -22, -54, 7, 7, p.skin, p.outline);
        // Uppercut arm — reaching high
        this._sRect(ctx, 14, -87, 8, 10, p.base, p.highlight, p.shadow, p.outline);
        this._sRect(ctx, 16, -120, 10, 36, p.mid, p.highlight, p.shadow, p.outline);
        // Big fist
        this._oRect(ctx, 14, -128, 14, 14, p.skin, p.outline);
        ctx.fillStyle = p.base;
        ctx.fillRect(15, -127, 12, 12);
        // Legs
        this._sRect(ctx, -13, -50, 11, 22, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, 2, -50, 11, 22, p.shadow, p.mid, p.outline, p.outline);
        this._sRect(ctx, -12, -28, 10, 20, p.mid, p.base, p.shadow, p.outline);
        this._sRect(ctx, 3, -28, 10, 20, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -14, -8, 12, 5, p.shadow, p.outline);
        this._oRect(ctx, 2, -8, 12, 5, p.shadow, p.outline);
    }

    // ──────── SWEEP POSE ────────
    _drawSweepPose(ctx, p) {
        // Low to ground, one leg extended
        // Head low
        this._sRect(ctx, -18, -62, 22, 22, p.skin, p.skinShadow, p.skinShadow, p.outline);
        ctx.fillStyle = '#fff'; ctx.fillRect(-14, -55, 5, 5); ctx.fillRect(-4, -55, 5, 5);
        ctx.fillStyle = '#111'; ctx.fillRect(-12, -53, 3, 3); ctx.fillRect(-2, -53, 3, 3);
        this._oRect(ctx, -12, -40, 10, 5, p.skin, p.outline);
        // Torso low and leaning
        this._sRect(ctx, -18, -35, 26, 20, p.base, p.highlight, p.shadow, p.outline);
        ctx.fillStyle = p.mid; ctx.fillRect(-18, -19, 26, 4);
        // Arms out for balance
        this._sRect(ctx, -30, -34, 10, 16, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, -30, -18, 7, 7, p.skin, p.outline);
        this._sRect(ctx, 8, -34, 10, 16, p.mid, p.base, p.shadow, p.outline);
        this._oRect(ctx, 9, -18, 7, 7, p.skin, p.outline);
        // Support leg bent
        this._sRect(ctx, -18, -15, 12, 8, p.shadow, p.mid, p.outline, p.outline);
        this._oRect(ctx, -20, -7, 14, 5, p.shadow, p.outline);
        // Extended sweep leg
        this._sRect(ctx, 2, -12, 42, 9, p.mid, p.highlight, p.shadow, p.outline);
        this._oRect(ctx, 44, -14, 14, 12, p.shadow, p.outline);
    }

    // ───────────────────── VISUAL EFFECTS ─────────────────────

    _spawnHitSparks(x, y, isBlock) {
        const count = isBlock ? 5 : 10;
        const baseColor = isBlock ? [100, 150, 255] : [255, 220, 50];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8 - 2,
                life: 8 + Math.random() * 5,
                maxLife: 13,
                size: isBlock ? 2 + Math.random() * 2 : 3 + Math.random() * 3,
                r: baseColor[0], g: baseColor[1], b: baseColor[2]
            });
        }
    }

    spawnBlockSparks(x, y) {
        this._spawnHitSparks(x, y, true);
    }

    spawnAttackSparks(x, y) {
        this._spawnHitSparks(x, y, false);
    }

    triggerScreenShake(frames) {
        this.screenShake.frames = Math.max(this.screenShake.frames, frames || 4);
    }

    _drawParticles(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const pt = this.particles[i];
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.vy += 0.3;
            pt.life--;
            const alpha = pt.life / pt.maxLife;
            ctx.fillStyle = `rgba(${pt.r},${pt.g},${pt.b},${alpha})`;
            ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
            if (pt.life <= 0) this.particles.splice(i, 1);
        }
    }

    _addFloatingText(x, y, text, color) {
        this.floatingTexts.push({ x, y, text, color, life: 40, maxLife: 40 });
    }

    _drawFloatingTexts(ctx) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 1.2;
            ft.life--;
            const alpha = ft.life / ft.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = ft.color;
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 8;
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.shadowBlur = 0;
            ctx.restore();
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    _drawStaggerStars(ctx, x, y) {
        const count = 4;
        for (let i = 0; i < count; i++) {
            const angle = (this.animFrame * 0.1) + (i * Math.PI * 2 / count);
            const sx = x + Math.cos(angle) * 16;
            const sy = y + Math.sin(angle) * 6;
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 6;
            ctx.fillRect(sx - 2, sy - 2, 4, 4);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx - 1, sy - 1, 2, 2);
        }
    }

    _drawComboCounter(ctx, x, y, count, color) {
        const scale = Math.min(1 + count * 0.15, 2.5);
        const fontSize = Math.floor(12 * scale);
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = `${fontSize}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.shadowColor = color;
        ctx.shadowBlur = 10 + count * 2;
        ctx.fillText(`${count} HIT COMBO!`, x, y);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ───────────────────── GROUND SHADOWS ─────────────────────
    _drawGroundShadow(ctx, player, side) {
        const x = player.x;
        const isJumping = player.state === 'jumping';
        const isCrouching = player.state === 'crouching';
        const shadowY = this.groundY + 2;

        // Squish/stretch based on state
        let radiusX = 22;
        let radiusY = 6;
        let alpha = 0.35;

        if (isJumping) {
            radiusX = 14;
            radiusY = 3;
            alpha = 0.18;
        } else if (isCrouching) {
            radiusX = 28;
            radiusY = 7;
            alpha = 0.4;
        } else if (player.state === 'sweep') {
            radiusX = 36;
            radiusY = 5;
            alpha = 0.3;
        } else if (player.state === 'dodging') {
            radiusX = 18;
            radiusY = 4;
            alpha = 0.25;
        }

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, shadowY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.fill();
        ctx.restore();
    }

    // ───────────────────── DUST PARTICLES ─────────────────────
    _spawnDustCloud(x, y, type) {
        const counts = { hit: 6, landing: 8, dodge: 5, sweep: 10 };
        const count = counts[type] || 5;
        for (let i = 0; i < count; i++) {
            const gray = 120 + Math.random() * 80;
            this.dustParticles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y - Math.random() * 4,
                vx: (Math.random() - 0.5) * (type === 'dodge' ? 4 : 2.5),
                vy: -Math.random() * 1.5 - 0.5,
                life: 15 + Math.random() * 10,
                maxLife: 25,
                size: 3 + Math.random() * 4,
                r: gray, g: gray - 20, b: gray - 40
            });
        }
    }

    _drawDustParticles(ctx) {
        for (let i = this.dustParticles.length - 1; i >= 0; i--) {
            const d = this.dustParticles[i];
            d.x += d.vx;
            d.y += d.vy;
            d.vy += 0.05;
            d.vx *= 0.96;
            d.size *= 0.98;
            d.life--;
            const alpha = (d.life / d.maxLife) * 0.5;
            ctx.fillStyle = `rgba(${d.r},${d.g},${d.b},${alpha})`;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
            ctx.fill();
            if (d.life <= 0) this.dustParticles.splice(i, 1);
        }
    }

    _trackStateTransitions(gameState) {
        ['p1', 'p2'].forEach(side => {
            const p = gameState.players[side];
            const prevState = this.prevStates[side];

            // Landing from jump
            if (prevState === 'jumping' && p.state !== 'jumping') {
                this._spawnDustCloud(p.x, this.groundY, 'landing');
            }
            // Dodge start: trailing dust
            if (p.state === 'dodging' && prevState !== 'dodging') {
                this._spawnDustCloud(p.x, this.groundY, 'dodge');
            }
            // Sweep: floor dust
            if (p.state === 'sweep' && prevState !== 'sweep') {
                this._spawnDustCloud(p.x + (p.facing === 'right' ? 30 : -30), this.groundY, 'sweep');
            }
            this.prevStates[side] = p.state;
        });
    }

    // ───────────────────── ENHANCED HIT EFFECTS ─────────────────────
    _spawnEnhancedHitSparks(x, y) {
        for (let i = 0; i < 15; i++) {
            const bright = Math.random() > 0.5;
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 10 - 3,
                life: 10 + Math.random() * 8,
                maxLife: 18,
                size: bright ? 5 + Math.random() * 4 : 3 + Math.random() * 3,
                r: bright ? 255 : 255,
                g: bright ? 255 : 200,
                b: bright ? 220 : 50
            });
        }
    }

    // ───────────────────── ENERGY TRAIL ─────────────────────
    _drawEnergyTrail(ctx, state, pal, side) {
        ctx.save();
        const glowColor = side === 'p1' ? 'rgba(0,255,255,' : 'rgba(255,0,255,';
        const solidColor = side === 'p1' ? '#00ffff' : '#ff00ff';

        ctx.shadowColor = solidColor;
        ctx.shadowBlur = 18;
        ctx.strokeStyle = solidColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6 + 0.2 * Math.sin(this.animFrame * 0.3);

        if (state === 'uppercut') {
            ctx.beginPath();
            ctx.arc(16, -100, 35, Math.PI * 0.8, Math.PI * 1.8);
            ctx.stroke();
            ctx.strokeStyle = `${glowColor}0.3)`;
            ctx.lineWidth = 8;
            ctx.shadowBlur = 25;
            ctx.beginPath();
            ctx.arc(16, -100, 30, Math.PI * 0.8, Math.PI * 1.8);
            ctx.stroke();
        } else if (state === 'sweep') {
            ctx.beginPath();
            ctx.arc(20, -8, 35, -Math.PI * 0.15, Math.PI * 0.35);
            ctx.stroke();
            ctx.strokeStyle = `${glowColor}0.3)`;
            ctx.lineWidth = 8;
            ctx.shadowBlur = 25;
            ctx.beginPath();
            ctx.arc(20, -8, 30, -Math.PI * 0.15, Math.PI * 0.35);
            ctx.stroke();
        }

        ctx.restore();
    }

    // ───────────────────── SUPER METER ─────────────────────
    drawSuperMeter(x, y, meter, side) {
        const ctx = this.ctx;
        const barWidth = 200;
        const barHeight = 8;
        const meterVal = Math.max(0, Math.min(100, meter));
        const fillWidth = (meterVal / 100) * barWidth;
        const isFull = meterVal >= 100;

        // Background
        ctx.fillStyle = '#111';
        ctx.fillRect(x, y, barWidth, barHeight);

        // Fill (gold/yellow)
        if (isFull) {
            const pulse = 0.7 + 0.3 * Math.sin(this.animFrame * 0.15);
            ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 12 + 6 * Math.sin(this.animFrame * 0.15);
        } else {
            ctx.fillStyle = '#cc9900';
            ctx.shadowBlur = 0;
        }
        ctx.fillRect(x, y, fillWidth, barHeight);
        ctx.shadowBlur = 0;

        // Border
        ctx.strokeStyle = isFull ? '#ffd700' : '#666';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // "SUPER" label when full
        if (isFull) {
            ctx.fillStyle = '#ffd700';
            ctx.font = '6px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 8;
            ctx.fillText('SUPER', x + barWidth / 2, y + 7);
            ctx.shadowBlur = 0;
        }
    }

    // ───────────────────── HUD ─────────────────────
    drawHUD(gameState) {
        const ctx = this.ctx;
        this.drawHealthBar(50, 30, gameState.players.p1, 'p1');
        this.drawHealthBar(550, 30, gameState.players.p2, 'p2');

        // Super meters (if available from engine)
        if (gameState.players.p1.superMeter !== undefined) {
            this.drawSuperMeter(50, 55, gameState.players.p1.superMeter, 'p1');
        }
        if (gameState.players.p2.superMeter !== undefined) {
            this.drawSuperMeter(550, 55, gameState.players.p2.superMeter, 'p2');
        }

        this.drawTimer(gameState.timer);
        this.drawRoundLabel(gameState.round);
        this.drawRoundIndicators(gameState.roundWins, gameState.round);
    }

    drawHealthBar(x, y, player, side) {
        const ctx = this.ctx;
        const barWidth = 200;
        const barHeight = 20;
        const color = this.colors[side];

        // Portrait icon
        const iconSize = 28;
        const iconX = side === 'p1' ? x - iconSize - 6 : x + barWidth + 6;
        ctx.fillStyle = side === 'p1' ? '#003344' : '#440044';
        ctx.fillRect(iconX, y - 4, iconSize, iconSize);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(iconX, y - 4, iconSize, iconSize);
        ctx.fillStyle = color;
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const letter = (player.model || '?')[0].toUpperCase();
        ctx.fillText(letter, iconX + iconSize / 2, y + iconSize / 2 + 1);

        // Model name
        ctx.fillStyle = color;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = side === 'p1' ? 'left' : 'right';
        ctx.fillText(player.model || '', side === 'p1' ? x : x + barWidth, y - 8);

        // Bar background
        ctx.fillStyle = '#111';
        ctx.fillRect(x, y, barWidth, barHeight);

        // Delayed damage bar (white/gray that drains slower)
        const targetHealth = player.health;
        const dispKey = side;
        if (this.displayHealth[dispKey] > targetHealth) {
            this.displayHealth[dispKey] -= 0.4;
        } else {
            this.displayHealth[dispKey] = targetHealth;
        }
        const delayedWidth = (this.displayHealth[dispKey] / 100) * barWidth;
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.fillRect(x, y, delayedWidth, barHeight);

        // Actual health fill
        const healthWidth = (player.health / 100) * barWidth;
        let healthColor;
        if (player.health > 50) healthColor = this.colors.yellow;
        else if (player.health > 20) healthColor = '#ff8800';
        else healthColor = this.colors.red;
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y, healthWidth, barHeight);

        // Flash red when below 20%
        if (player.health <= 20 && player.health > 0) {
            const flash = Math.sin(this.animFrame * 0.3) * 0.3 + 0.3;
            ctx.fillStyle = `rgba(255,0,0,${flash})`;
            ctx.fillRect(x, y, barWidth, barHeight);
        }

        // Bar border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // Health number
        ctx.fillStyle = '#fff';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(Math.max(0, Math.ceil(player.health)), x + barWidth / 2, y + 15);
    }

    drawTimer(time) {
        const ctx = this.ctx;
        ctx.fillStyle = this.colors.yellow;
        ctx.font = '28px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 8;
        ctx.fillText(String(Math.max(0, time)), this.width / 2, 48);
        ctx.shadowBlur = 0;
    }

    drawRoundLabel(round) {
        const ctx = this.ctx;
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`ROUND ${round || 1}`, this.width / 2, 62);
    }

    drawRoundIndicators(roundWins, currentRound) {
        const ctx = this.ctx;
        const size = 12;
        for (let i = 0; i < 3; i++) {
            const px = 130 + (i * 20);
            ctx.fillStyle = i < (roundWins?.p1 || 0) ? this.colors.p1 : '#222';
            ctx.fillRect(px - size / 2, 70 - size / 2, size, size);
            ctx.strokeStyle = this.colors.p1;
            ctx.lineWidth = 1;
            ctx.strokeRect(px - size / 2, 70 - size / 2, size, size);
        }
        for (let i = 0; i < 3; i++) {
            const px = 620 + (i * 20);
            ctx.fillStyle = i < (roundWins?.p2 || 0) ? this.colors.p2 : '#222';
            ctx.fillRect(px - size / 2, 70 - size / 2, size, size);
            ctx.strokeStyle = this.colors.p2;
            ctx.lineWidth = 1;
            ctx.strokeRect(px - size / 2, 70 - size / 2, size, size);
        }
    }

    _drawActionLog(ctx) {
        ctx.save();
        ctx.font = '7px "Press Start 2P", monospace';
        // P1 log (left)
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,255,255,0.5)';
        const p1Logs = this.actionLogs.p1.slice(-3);
        p1Logs.forEach((txt, i) => {
            ctx.fillText(txt, 10, this.height - 30 + i * 10);
        });
        // P2 log (right)
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(255,0,255,0.5)';
        const p2Logs = this.actionLogs.p2.slice(-3);
        p2Logs.forEach((txt, i) => {
            ctx.fillText(txt, this.width - 10, this.height - 30 + i * 10);
        });
        ctx.restore();
    }

    // ───────────────────── OVERLAYS ─────────────────────
    drawRoundIntroOverlay(round) {
        const ctx = this.ctx;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.fillStyle = this.colors.yellow;
        ctx.font = '48px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = this.colors.yellow;
        ctx.shadowBlur = 20;
        ctx.fillText(`ROUND ${round}`, this.width / 2, this.height / 2 - 30);
        ctx.fillStyle = this.colors.red;
        ctx.shadowColor = this.colors.red;
        ctx.fillText('FIGHT!', this.width / 2, this.height / 2 + 40);
        ctx.shadowBlur = 0;
    }

    drawKOOverlay(winner) {
        const ctx = this.ctx;
        const color = this.colors[winner];

        // Slow fade-in
        if (!this.koOverlayActive) {
            this.koOverlayActive = true;
            this.koOverlayAlpha = 0;
        }
        if (this.koOverlayAlpha < 0.7) {
            this.koOverlayAlpha += 0.02;
        }

        ctx.fillStyle = `rgba(0, 0, 0, ${this.koOverlayAlpha})`;
        ctx.fillRect(0, 0, this.width, this.height);

        // Pulsing glow on "K.O." text
        const glowSize = 30 + 15 * Math.sin(this.animFrame * 0.12);
        ctx.fillStyle = color;
        ctx.font = '64px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = color;
        ctx.shadowBlur = glowSize;
        ctx.globalAlpha = Math.min(this.koOverlayAlpha / 0.7, 1);
        ctx.fillText('K.O.', this.width / 2, this.height / 2);

        // Winner flash text below K.O.
        ctx.font = '14px "Press Start 2P", monospace';
        ctx.shadowBlur = 15;
        const flashAlpha = 0.5 + 0.5 * Math.sin(this.animFrame * 0.2);
        ctx.globalAlpha = flashAlpha * Math.min(this.koOverlayAlpha / 0.7, 1);
        ctx.fillText(`${winner.toUpperCase()} WINS`, this.width / 2, this.height / 2 + 50);

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    // ───────────────────── DOM METHODS ─────────────────────
    showCharacterSelect(models, onSelect) {
        const overlay = document.createElement('div');
        overlay.className = 'select-overlay';
        overlay.id = 'selectOverlay';

        const title = document.createElement('h2');
        title.className = 'select-title';
        title.textContent = 'SELECT YOUR FIGHTERS';
        overlay.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'select-grid';

        const p1Column = document.createElement('div');
        p1Column.className = 'select-column';
        const p1Title = document.createElement('div');
        p1Title.className = 'select-column-title';
        p1Title.textContent = 'PLAYER 1';
        p1Column.appendChild(p1Title);

        const p2Column = document.createElement('div');
        p2Column.className = 'select-column';
        const p2Title = document.createElement('div');
        p2Title.className = 'select-column-title';
        p2Title.textContent = 'PLAYER 2';
        p2Column.appendChild(p2Title);

        let p1Selected = null;
        let p2Selected = null;

        models.forEach(modelId => {
            const p1Card = document.createElement('div');
            p1Card.className = 'model-card';
            p1Card.textContent = modelId;
            p1Card.onclick = () => {
                p1Column.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
                p1Card.classList.add('selected');
                p1Selected = modelId;
                if (p1Selected && p2Selected && p1Selected !== p2Selected) {
                    onSelect('p1', p1Selected);
                    onSelect('p2', p2Selected);
                    overlay.remove();
                }
            };
            p1Column.appendChild(p1Card);

            const p2Card = document.createElement('div');
            p2Card.className = 'model-card';
            p2Card.textContent = modelId;
            p2Card.onclick = () => {
                p2Column.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
                p2Card.classList.add('selected');
                p2Selected = modelId;
                if (p1Selected && p2Selected && p1Selected !== p2Selected) {
                    onSelect('p1', p1Selected);
                    onSelect('p2', p2Selected);
                    overlay.remove();
                }
            };
            p2Column.appendChild(p2Card);
        });

        grid.appendChild(p1Column);
        grid.appendChild(p2Column);
        overlay.appendChild(grid);
        document.body.appendChild(overlay);
    }

    showRoundIntro(round, model1Name, model2Name) {
        console.log(`Round ${round}: ${model1Name} vs ${model2Name}`);
    }

    showKO(winnerSide) {
        console.log(`${winnerSide} wins!`);
    }

    showVictoryScreen(winnerSide, winnerModel, score, onRematch) {
        // Remove any existing victory overlay
        const existing = document.getElementById('victoryOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'victory-overlay';
        overlay.id = 'victoryOverlay';

        const winColor = winnerSide.toLowerCase() === 'p1' ? '#00ffff' : '#ff00ff';

        // "WINNER" title
        const title = document.createElement('div');
        title.className = 'victory-title';
        title.textContent = 'WINNER';
        title.style.color = winColor;
        title.style.textShadow = `0 0 20px ${winColor}, 0 0 40px ${winColor}`;
        overlay.appendChild(title);

        // Winning model name
        const model = document.createElement('div');
        model.className = 'victory-model';
        model.textContent = winnerModel;
        model.style.color = winColor;
        model.style.textShadow = `0 0 15px ${winColor}, 0 0 30px ${winColor}`;
        overlay.appendChild(model);

        // Score display
        const scoreEl = document.createElement('div');
        scoreEl.className = 'victory-score';
        scoreEl.textContent = `${score.p1} - ${score.p2}`;
        overlay.appendChild(scoreEl);

        // Rematch button
        const btn = document.createElement('button');
        btn.className = 'arcade-btn victory-rematch';
        btn.textContent = 'REMATCH';
        btn.onclick = () => {
            overlay.remove();
            if (onRematch) onRematch();
        };
        overlay.appendChild(btn);

        document.body.appendChild(overlay);
    }

    updateThought(side, text) {
        const panel = side === 'left' ? this.leftPanel : this.rightPanel;
        if (panel) panel.classList.add('panel-active');

        const thoughtDiv = side === 'left' ?
            document.getElementById('leftThought') :
            document.getElementById('rightThought');
        if (!thoughtDiv) return;

        const p = document.createElement('p');
        p.classList.add('thought-msg');
        p.textContent = text;
        thoughtDiv.appendChild(p);
        thoughtDiv.scrollTop = thoughtDiv.scrollHeight;
        while (thoughtDiv.children.length > 20) {
            thoughtDiv.removeChild(thoughtDiv.firstChild);
        }

        // Remove active glow from the other panel
        const otherPanel = side === 'left' ? this.rightPanel : this.leftPanel;
        if (otherPanel) otherPanel.classList.remove('panel-active');
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.GameRenderer = GameRenderer;
}
