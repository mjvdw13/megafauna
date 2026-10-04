// ============================================================================
// GAME
// ============================================================================
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.input = new InputHandler();
        this.physics = new Physics();
        this.state = GameState.TITLE;
        this.player1 = null;
        this.player2 = null;
        this.p1Selection = 0;
        this.p2Selection = 1;
        this.p1Ready = false;
        this.p2Ready = false;
        this.roundState = 'intro';
        this.roundTimer = 0;
        this.matchTimer = 99 * 60;
        this.p1Wins = 0;
        this.p2Wins = 0;
        this.winner = 0;
        this.titlePulse = 0;
        this.characters = [
            { name: 'Riley', class: Riley, color: '#c0392b', desc: 'Balanced dog fighter' },
            { name: 'Quackers', class: Quackers, color: '#f1c40f', desc: 'Duck with double jump!' }
        ];
        // Visual effects
        this.effects = [];
        this.screenShake = 0;
        // Pixel art sprites
        this.pixelArt = new PixelArtGenerator();
        this.pixelArt.generateAll();
    }

    // Add a hit effect at position
    addHitEffect(x, y, type = 'hit') {
        this.effects.push({
            x, y, type,
            life: 20,
            maxLife: 20,
            particles: this.createParticles(x, y, type)
        });
        // Add screen shake
        this.screenShake = type === 'heavy' ? 12 : 6;
    }

    createParticles(x, y, type) {
        const particles = [];
        const count = type === 'heavy' ? 12 : 8;
        const colors = type === 'block' ? ['#3498db', '#5dade2', '#85c1e9'] : ['#f1c40f', '#e74c3c', '#fff'];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const speed = 3 + Math.random() * 5;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 4 + Math.random() * 6,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 15 + Math.random() * 10
            });
        }
        return particles;
    }

    updateEffects() {
        // Update screen shake
        if (this.screenShake > 0) this.screenShake *= 0.85;
        if (this.screenShake < 0.5) this.screenShake = 0;

        // Update effects
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life--;
            // Update particles
            for (const p of effect.particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; // gravity
                p.vx *= 0.95;
                p.life--;
                p.size *= 0.95;
            }
            if (effect.life <= 0) this.effects.splice(i, 1);
        }
    }

    renderEffects() {
        for (const effect of this.effects) {
            const alpha = effect.life / effect.maxLife;
            // Draw impact flash
            if (effect.life > effect.maxLife - 5) {
                const flashSize = 40 + (effect.maxLife - effect.life) * 8;
                this.ctx.globalAlpha = alpha * 0.8;
                this.ctx.fillStyle = '#fff';
                this.ctx.beginPath();
                this.ctx.arc(effect.x, effect.y, flashSize, 0, Math.PI * 2);
                this.ctx.fill();
            }
            // Draw particles
            for (const p of effect.particles) {
                if (p.life > 0 && p.size > 0.5) {
                    this.ctx.globalAlpha = Math.min(1, p.life / 10);
                    this.ctx.fillStyle = p.color;
                    this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
                }
            }
        }
        this.ctx.globalAlpha = 1;
    }

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(time) {
        const dt = time - this.lastTime;
        this.lastTime = time;
        this.input.update();
        this.update(dt);
        this.render();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.state === GameState.TITLE) this.updateTitle();
        else if (this.state === GameState.CHARACTER_SELECT) this.updateCharSelect();
        else if (this.state === GameState.FIGHTING) this.updateFight();
        else if (this.state === GameState.RESULT) this.updateResult();
    }

    updateTitle() {
        this.titlePulse += 0.05;
        if (this.input.menuInput.confirm || this.input.player1.lightAttackPressed || this.input.player2.lightAttackPressed) {
            this.state = GameState.CHARACTER_SELECT;
            this.p1Ready = false; this.p2Ready = false;
        }
    }

    updateCharSelect() {
        if (!this.p1Ready) {
            if (this.input.player1.leftPressed) this.p1Selection = (this.p1Selection - 1 + this.characters.length) % this.characters.length;
            if (this.input.player1.rightPressed) this.p1Selection = (this.p1Selection + 1) % this.characters.length;
            if (this.input.player1.lightAttackPressed) this.p1Ready = true;
        } else if (this.input.player1.heavyAttackPressed) this.p1Ready = false;

        if (!this.p2Ready) {
            if (this.input.player2.leftPressed) this.p2Selection = (this.p2Selection - 1 + this.characters.length) % this.characters.length;
            if (this.input.player2.rightPressed) this.p2Selection = (this.p2Selection + 1) % this.characters.length;
            if (this.input.player2.lightAttackPressed) this.p2Ready = true;
        } else if (this.input.player2.heavyAttackPressed) this.p2Ready = false;

        if (this.p1Ready && this.p2Ready) {
            this.startMatch();
        }
        if (this.input.menuInput.back) this.state = GameState.TITLE;
    }

    startMatch() {
        const P1Class = this.characters[this.p1Selection].class;
        const P2Class = this.characters[this.p2Selection].class;
        this.player1 = new P1Class({ playerNumber: 1, x: 200, facingRight: true, pixelArt: this.pixelArt });
        this.player2 = new P2Class({ playerNumber: 2, x: 1000, facingRight: false, pixelArt: this.pixelArt });
        this.p1Wins = 0; this.p2Wins = 0;
        this.startRound();
        this.state = GameState.FIGHTING;
    }

    startRound() {
        this.player1.reset(200, true);
        this.player2.reset(1000, false);
        this.roundState = 'intro';
        this.roundTimer = 0;
        this.matchTimer = 99 * 60;
        this.effects = [];
        this.screenShake = 0;
    }

    updateFight() {
        this.roundTimer++;
        if (this.roundState === 'intro') {
            if (this.roundTimer >= 120) { this.roundState = 'fight'; this.roundTimer = 0; }
        } else if (this.roundState === 'fight') {
            this.matchTimer--;
            const p1Input = this.input.getPlayerInput(1);
            const p2Input = this.input.getPlayerInput(2);
            this.handleAttack(this.player1, p1Input);
            this.handleAttack(this.player2, p2Input);
            this.player1.update(p1Input, this.player2);
            this.player2.update(p2Input, this.player1);
            this.physics.update(this.player1);
            this.physics.update(this.player2);
            this.physics.resolveCollision(this.player1, this.player2);
            this.updateEffects();
            if (this.player1.isDead() || this.player2.isDead() || this.matchTimer <= 0) {
                this.roundState = 'ko'; this.roundTimer = 0;
                if (this.player1.isDead()) this.player1.stateMachine.setState(CharacterStates.DEFEAT);
                if (this.player2.isDead()) this.player2.stateMachine.setState(CharacterStates.DEFEAT);
                if (!this.player1.isDead()) this.player1.stateMachine.setState(CharacterStates.VICTORY);
                if (!this.player2.isDead()) this.player2.stateMachine.setState(CharacterStates.VICTORY);
            }
        } else if (this.roundState === 'ko') {
            if (this.roundTimer >= 180) {
                if (this.player2.isDead() || this.player1.health > this.player2.health) this.p1Wins++;
                else if (this.player1.isDead() || this.player2.health > this.player1.health) this.p2Wins++;
                if (this.p1Wins >= 2) { this.winner = 1; this.state = GameState.RESULT; }
                else if (this.p2Wins >= 2) { this.winner = 2; this.state = GameState.RESULT; }
                else this.startRound();
            }
        }
    }

    handleAttack(player, input) {
        if (!player.stateMachine.canAct()) return;
        let attackKey = null;
        if (input.lightAttackPressed) attackKey = player.isGrounded ? (player.stateMachine.isCrouching() ? 'lightCrouch' : 'lightStand') : 'lightAir';
        else if (input.heavyAttackPressed) attackKey = player.isGrounded ? (player.stateMachine.isCrouching() ? 'heavyCrouch' : 'heavyStand') : 'heavyAir';
        if (attackKey) { player.stateMachine.setState(CharacterStates.ATTACKING); player.startAttack(attackKey); }
    }

    updateResult() {
        if (this.input.menuInput.confirm || this.input.player1.lightAttackPressed) {
            this.p1Ready = false; this.p2Ready = false;
            this.state = GameState.CHARACTER_SELECT;
        }
        if (this.input.menuInput.back) this.state = GameState.TITLE;
    }

    render() {
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, this.width, this.height);
        if (this.state === GameState.TITLE) this.renderTitle();
        else if (this.state === GameState.CHARACTER_SELECT) this.renderCharSelect();
        else if (this.state === GameState.FIGHTING) this.renderFight();
        else if (this.state === GameState.RESULT) this.renderResult();
    }

    renderTitle() {
        // Background
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#1a1a2e'); grad.addColorStop(1, '#16213e');
        this.ctx.fillStyle = grad; this.ctx.fillRect(0, 0, this.width, this.height);
        // Title
        const scale = 1 + Math.sin(this.titlePulse) * 0.05;
        this.ctx.font = `bold ${Math.floor(72 * scale)}px Arial`;
        this.ctx.fillStyle = '#e94560';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MEGAFAUNA', this.width / 2, 200);
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText('Browser Fighting Game', this.width / 2, 260);
        // Prompt
        this.ctx.font = '28px Arial';
        this.ctx.fillStyle = Math.floor(this.titlePulse * 2) % 2 ? '#fff' : '#888';
        this.ctx.fillText('Press ENTER or J to Start', this.width / 2, 400);
        // Controls
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#666';
        this.ctx.fillText('P1: WASD + JKL   |   P2: Arrows + Numpad 1-3', this.width / 2, 550);
    }

    renderCharSelect() {
        this.ctx.fillStyle = '#0f3460';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.font = 'bold 48px Arial';
        this.ctx.fillStyle = '#e94560';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SELECT YOUR FIGHTER', this.width / 2, 60);
        // P1 panel
        this.renderCharPanel(200, 150, this.p1Selection, this.p1Ready, 'P1', '#3498db');
        // P2 panel
        this.renderCharPanel(780, 150, this.p2Selection, this.p2Ready, 'P2', '#e74c3c');
        // VS
        this.ctx.font = 'bold 64px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText('VS', this.width / 2, 350);
        // Instructions
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#888';
        this.ctx.fillText('A/D or Arrows to select, J/Num1 to confirm, K/Num2 to cancel, ESC to go back', this.width / 2, 650);
    }

    renderCharPanel(x, y, selection, ready, label, labelColor) {
        const char = this.characters[selection];
        this.ctx.fillStyle = ready ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.1)';
        this.ctx.fillRect(x, y, 300, 350);
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillStyle = labelColor;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(label, x + 150, y + 40);
        this.ctx.font = 'bold 36px Arial';
        this.ctx.fillStyle = char.color;
        this.ctx.fillText(char.name, x + 150, y + 100);
        this.ctx.font = '18px Arial';
        this.ctx.fillStyle = '#ccc';
        this.ctx.fillText(char.desc, x + 150, y + 140);
        // Preview
        const spriteName = char.name.toLowerCase();
        const preview = this.pixelArt.getSprite(spriteName, 'idle', 0);
        if (preview) {
            this.ctx.save(); this.ctx.imageSmoothingEnabled = false;
            this.ctx.drawImage(preview, x + 110, y + 180, 80, 120);
            this.ctx.restore();
        } else {
            this.ctx.fillStyle = char.color;
            this.ctx.fillRect(x + 110, y + 180, 80, 120);
        }
        if (ready) {
            this.ctx.font = 'bold 28px Arial';
            this.ctx.fillStyle = '#2ecc71';
            this.ctx.fillText('READY!', x + 150, y + 330);
        } else {
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText('<', x + 30, y + 250);
            this.ctx.fillText('>', x + 270, y + 250);
        }
    }

    renderFight() {
        // Apply screen shake
        this.ctx.save();
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake * 2;
            const shakeY = (Math.random() - 0.5) * this.screenShake * 2;
            this.ctx.translate(shakeX, shakeY);
        }
        // Background
        const bg = this.pixelArt.getBackground();
        if (bg) {
            this.ctx.drawImage(bg, 0, 0);
        } else {
            const grad = this.ctx.createLinearGradient(0, 0, 0, 450);
            grad.addColorStop(0, '#87CEEB'); grad.addColorStop(1, '#E0F6FF');
            this.ctx.fillStyle = grad; this.ctx.fillRect(0, 0, this.width, 450);
            this.ctx.fillStyle = '#6B8E23'; this.ctx.fillRect(0, 350, this.width, 100);
            this.ctx.fillStyle = '#8B4513'; this.ctx.fillRect(0, 450, this.width, 270);
            this.ctx.fillStyle = '#654321'; this.ctx.fillRect(0, 450, this.width, 20);
            this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
            this.ctx.fillRect(0, 0, 50, this.height);
            this.ctx.fillRect(this.width - 50, 0, 50, this.height);
        }
        // Characters
        this.player1.render(this.ctx);
        this.player2.render(this.ctx);
        // Hit effects
        this.renderEffects();
        this.ctx.restore();
        // UI
        this.renderHealthBar(50, 30, 400, 30, this.player1.health, this.player1.maxHealth, false);
        this.renderHealthBar(830, 30, 400, 30, this.player2.health, this.player2.maxHealth, true);
        // Timer
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(this.width / 2 - 45, 10, 90, 55);
        this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.width / 2 - 45, 10, 90, 55);
        this.ctx.font = 'bold 36px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(Math.ceil(this.matchTimer / 60).toString().padStart(2, '0'), this.width / 2, 52);
        // Names
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.player1.name, 50, 25);
        this.ctx.textAlign = 'right';
        this.ctx.fillText(this.player2.name, this.width - 50, 25);
        // Win dots
        for (let i = 0; i < 2; i++) {
            this.ctx.fillStyle = i < this.p1Wins ? '#f1c40f' : '#333';
            this.ctx.beginPath(); this.ctx.arc(480 + i * 25, 50, 8, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.fillStyle = i < this.p2Wins ? '#f1c40f' : '#333';
            this.ctx.beginPath(); this.ctx.arc(800 - i * 25, 50, 8, 0, Math.PI * 2); this.ctx.fill();
        }
        // Overlays
        if (this.roundState === 'intro') {
            this.ctx.font = 'bold 72px Arial';
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            if (this.roundTimer < 60) this.ctx.fillText(`ROUND ${this.p1Wins + this.p2Wins + 1}`, this.width / 2, this.height / 2);
            else this.ctx.fillText('FIGHT!', this.width / 2, this.height / 2);
        } else if (this.roundState === 'ko') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, this.height / 2 - 60, this.width, 120);
            this.ctx.font = 'bold 96px Arial';
            this.ctx.fillStyle = '#e94560';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('K.O.!', this.width / 2, this.height / 2 + 30);
        }
    }

    renderHealthBar(x, y, w, h, health, max, flip) {
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x, y, w, h);
        const pct = health / max;
        const color = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f1c40f' : '#e74c3c';
        const hw = pct * w;
        this.ctx.fillStyle = color;
        if (flip) this.ctx.fillRect(x + w - hw, y, hw, h);
        else this.ctx.fillRect(x, y, hw, h);
        this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, w, h);
    }

    renderResult() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.font = 'bold 64px Arial';
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('WINNER!', this.width / 2, 200);
        const winnerChar = this.winner === 1 ? this.characters[this.p1Selection] : this.characters[this.p2Selection];
        this.ctx.font = 'bold 56px Arial';
        this.ctx.fillStyle = winnerChar.color;
        this.ctx.fillText(winnerChar.name, this.width / 2, 300);
        this.ctx.font = '28px Arial';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(`Player ${this.winner}`, this.width / 2, 360);
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = '#888';
        this.ctx.fillText('Press ENTER or J for Character Select', this.width / 2, 500);
        this.ctx.fillText('Press ESC for Title Screen', this.width / 2, 540);
    }
}
