// ============================================================================
// FIGHT HUD
// Health bars (with a trailing "damage ghost"), timer, round wins, combo counter.
// ============================================================================
import { SCREEN } from '../config.js';
import { beginUi, inkPanel, inkRectPath, inkStar, uiInk } from './ink-ui.js';
import { drawText, DISPLAY_FONT } from './text.js';

const BAR = { width: 400, height: 30, y: 36, margin: 112 };
const GHOST_DELAY = 30;

export class FightHud {
    constructor() {
        this.players = [];
    }

    reset(fighters) {
        this.players = fighters.map((f, i) => ({
            fighter: f, ghost: f.health, lastHealth: f.health, delay: 0, combo: 0, comboTimer: 0
        }));
    }

    /** The portrait's pose follows the fighter: celebrating, reeling, or idle. */
    portraitState(fighter) {
        const sm = fighter.stateMachine;
        if (sm.is('victory')) return 'victory';
        if (sm.isInHitstun() || sm.isKnockedDown() || sm.is('defeat')) return 'hitstun';
        return 'idle';
    }

    update() {
        for (const p of this.players) {
            const f = p.fighter;
            if (f.health < p.lastHealth) p.delay = GHOST_DELAY;
            p.lastHealth = f.health;
            if (p.delay > 0) p.delay--;
            else if (p.ghost > f.health) p.ghost = Math.max(f.health, p.ghost - f.maxHealth * 0.012);
        }
        // Combo shown on the attacker's side: the number of hits the *other* fighter has taken.
        this.players.forEach((p, i) => {
            const victim = this.players[1 - i]?.fighter;
            if (victim && victim.comboHitCount >= 2) { p.combo = victim.comboHitCount; p.comboTimer = 60; }
            else if (p.comboTimer > 0) p.comboTimer--;
        });
    }

    render(ctx, { wins, roundsToWin, seconds, time = 0, studio = null }) {
        beginUi(time);
        this.players.forEach((p, i) => this.renderPlayer(ctx, p, i, wins[i], roundsToWin, studio));
        this.renderTimer(ctx, seconds);
    }

    renderPlayer(ctx, p, index, wins, roundsToWin, studio) {
        const f = p.fighter;
        const flip = index === 1;
        const x = flip ? SCREEN.width - BAR.margin - BAR.width : BAR.margin;
        const portraitX = flip ? SCREEN.width - 98 : 18;

        // Portrait card
        inkPanel(ctx, portraitX, 14, 80, 80, { fill: f.color, radius: 14 });
        ctx.save();
        ctx.clip(inkRectPath(portraitX + 4, 18, 72, 72, 10));
        ctx.fillStyle = '#fdf3dc';
        ctx.fillRect(portraitX, 14, 80, 80);
        studio?.draw(ctx, { x: portraitX + 3, y: 17, width: 74, height: 74 }, f.def, { key: `hud-${index}`, state: this.portraitState(f), facingRight: !flip, portrait: true });
        ctx.restore();

        // Health bar: cream backing, trailing damage ghost, colored fill with a painted highlight.
        inkPanel(ctx, x, BAR.y, BAR.width, BAR.height, { fill: '#3b2a24', radius: 8, shadow: true });
        ctx.save();
        ctx.clip(inkRectPath(x + 3, BAR.y + 3, BAR.width - 6, BAR.height - 6, 6));
        const fill = (value, color) => {
            const w = (value / f.maxHealth) * BAR.width;
            ctx.fillStyle = color;
            ctx.fillRect(flip ? x + BAR.width - w : x, BAR.y, w, BAR.height);
        };
        fill(p.ghost, '#fff3d6');
        const pct = f.health / f.maxHealth;
        fill(f.health, pct > 0.5 ? '#6cc04a' : pct > 0.25 ? '#f2c230' : '#e2543b');
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x, BAR.y + 5, BAR.width, 5);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2a1d17';
        ctx.stroke(inkRectPath(x, BAR.y, BAR.width, BAR.height, 8));

        drawText(ctx, f.name.toUpperCase(), flip ? x + BAR.width : x, BAR.y - 7, {
            size: 24, font: DISPLAY_FONT, weight: 'normal', align: flip ? 'right' : 'left', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5
        });
        drawText(ctx, `${Math.ceil(f.health)}`, flip ? x + 10 : x + BAR.width - 10, BAR.y + 21, {
            size: 18, align: flip ? 'left' : 'right', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 4
        });

        // Round wins
        for (let w = 0; w < roundsToWin; w++) {
            const cx = flip ? x + BAR.width - 14 - w * 30 : x + 14 + w * 30;
            inkStar(ctx, cx, BAR.y + BAR.height + 18, 11, w < wins ? '#f7c948' : '#6b5a4e');
        }

        // Combo counter
        if (p.comboTimer > 0) {
            const alpha = Math.min(1, p.comboTimer / 20);
            const cx = flip ? SCREEN.width - 180 : 180;
            drawText(ctx, `${p.combo} HITS!`, cx, 160, { size: 44, font: DISPLAY_FONT, weight: 'normal', color: '#f7c948', outline: '#2a1d17', outlineWidth: 7, alpha });
            drawText(ctx, 'COMBO', cx, 186, { size: 20, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5, alpha });
        }
    }

    renderTimer(ctx, seconds) {
        const cx = SCREEN.width / 2;
        ctx.fillStyle = 'rgba(42,29,23,0.35)';
        ctx.fill(uiInk.ellipse(cx + 4, 50, 42, 40, 0, 14));
        const badge = uiInk.ellipse(cx, 46, 42, 40, 0, 14);
        ctx.fillStyle = '#fdf3dc';
        ctx.fill(badge);
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#2a1d17';
        ctx.stroke(badge);
        drawText(ctx, String(seconds).padStart(2, '0'), cx, 62, { size: 44, font: DISPLAY_FONT, weight: 'normal', color: seconds <= 10 ? '#d63c2a' : '#2a1d17' });
    }
}
