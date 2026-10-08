// ============================================================================
// RESULT SCENE
// Online, both buttons go back to the online lobby (still connected) to pick
// again; ESC leaves the online game.
// ============================================================================
import { CPU_LEVELS } from '../ai/cpu-controller.js';
import { SCREEN } from '../config.js';
import { getCharacter } from '../fighters/roster.js';
import { clearInviteFromUrl } from '../net/online.js';
import { drawText, DISPLAY_FONT } from '../ui/text.js';

export class ResultScene {
    constructor(game) {
        this.game = game;
        this.time = 0;
    }

    enter(match) {
        this.match = match;
        this.winnerDef = getCharacter(match.winner === 1 ? match.p1 : match.p2);
        this.time = 0;
        const { audio } = this.game;
        audio.music.stop();
        audio.play('fanfare');
        audio.announce(`${this.winnerDef.name} wins!`, { pitch: 0.7, rate: 0.9 });
    }

    get winnerLabel() {
        const { winner, cpu, online } = this.match;
        if (online) return winner === online.localIndex + 1 ? 'You win!' : 'Your friend wins!';
        if (!cpu) return `Player ${winner}`;
        return winner === 1 ? 'You beat the CPU!' : `CPU (${CPU_LEVELS[cpu].label}) wins`;
    }

    update() {
        this.time++;
        const { input } = this.game;
        if (this.time < 30) return; // ignore button mashing carried over from the fight
        if (this.match.online) {
            if (input.menu.back) {
                this.match.online.close();
                this.game.online = null;
                clearInviteFromUrl();
                this.game.changeScene('title');
            } else if (input.anyConfirm() || input.player1.specialPressed || input.player2.specialPressed) {
                this.game.changeScene('online');
            }
            return;
        }
        if (input.player1.specialPressed || input.player2.specialPressed) this.game.changeScene('fight', this.match);
        else if (input.anyConfirm()) this.game.changeScene('characterSelect');
        else if (input.menu.back) this.game.changeScene('title');
    }

    render(ctx) {
        const { width, height } = SCREEN;
        const grad = ctx.createRadialGradient(width / 2, 330, 40, width / 2, 330, 700);
        grad.addColorStop(0, '#f2b45a'); grad.addColorStop(1, '#8c3d3a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Rotating light rays behind the winner
        ctx.save();
        ctx.translate(width / 2, 340);
        ctx.rotate(this.time * 0.004);
        ctx.fillStyle = 'rgba(255,240,200,0.18)';
        for (let i = 0; i < 12; i++) {
            ctx.rotate(Math.PI / 6);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-60, -700); ctx.lineTo(60, -700); ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        drawText(ctx, 'WINNER!', width / 2, 118, { size: 110, font: DISPLAY_FONT, weight: 'normal', color: '#f7c948', outline: '#2a1d17', outlineWidth: 12 });
        this.game.studio.draw(ctx, { x: width / 2 - 230, y: 150, width: 460, height: 290 }, this.winnerDef, { key: 'result', state: 'victory' });
        drawText(ctx, this.winnerDef.name.toUpperCase(), width / 2, 490, { size: 80, font: DISPLAY_FONT, weight: 'normal', color: this.winnerDef.color, outline: '#2a1d17', outlineWidth: 9 });
        drawText(ctx, this.winnerLabel, width / 2, 540, { size: 32, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5 });

        const help = this.match.online ? 'J / Enter / ✕: Pick again for a rematch   ·   ESC: Leave the online game' : 'J / Enter / ✕: Character Select   ·   L / Num3 / ○: Rematch   ·   ESC: Title';
        drawText(ctx, help, width / 2, 640, { size: 24, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5 });
    }
}
