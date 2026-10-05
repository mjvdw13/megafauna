// ============================================================================
// FIGHT HUD
// Health bars (with a trailing "damage ghost"), timer, round wins, combo counter.
// Bars shake and flash the chunk just lost when hit, and pulse at low health.
// The combo counter pops on every hit, heats up in color as it grows, totals
// the combo's damage, and rates the combo when it ends (NICE! ... MEGA!).
// ============================================================================
import { SCREEN } from '../config.js';
import { beginUi, inkPanel, inkRectPath, inkStar, uiInk } from './ink-ui.js';
import { drawText, DISPLAY_FONT } from './text.js';

const BAR = { width: 400, height: 30, y: 36, margin: 112 };
const GHOST_DELAY = 30;
const CHUNK_FLASH = 8;      // frames the chunk just lost stays white
const LOW_HEALTH = 0.25;
const COMBO_HOLD = 80;      // frames the counter stays up after a combo ends
const RATING_FRAMES = 70;

/** [minimum hits, text, level (1-4, for the sting), color]. */
const RATINGS = [[10, 'MEGA!', 4, '#ff4fa3'], [7, 'AWESOME!', 3, '#ff5a36'], [5, 'GREAT!', 2, '#ff9f1c'], [3, 'NICE!', 1, '#f7c948']];
const comboColor = (hits) => (hits >= 9 ? '#ff4fa3' : hits >= 6 ? '#ff5a36' : hits >= 4 ? '#ff9f1c' : '#f7c948');

export class FightHud {
    constructor() {
        this.players = [];
        this.finished = [];
    }

    reset(fighters) {
        this.players = fighters.map((f) => ({
            fighter: f, ghost: f.health, lastHealth: f.health, delay: 0, shake: 0, chunkFlash: 0, combo: null, rating: null
        }));
        this.finished = [];
    }

    /** The portrait's pose follows the fighter: celebrating, reeling, or idle. */
    portraitState(fighter) {
        const sm = fighter.stateMachine;
        if (sm.is('victory')) return 'victory';
        if (sm.isInHitstun() || sm.isKnockedDown() || sm.is('defeat')) return 'hitstun';
        return 'idle';
    }

    /** A clean hit by player `index` (0 or 1). Counts toward that player's combo. */
    comboHit(index, hit) {
        const p = this.players[index];
        if (!p || !hit.comboHit) return;
        if (hit.comboHit <= 1 || !p.combo || p.combo.ended) {
            this.endCombo(p);
            p.combo = { hits: 1, damage: hit.damage, pop: 1, timer: COMBO_HOLD, ended: false, victim: this.players[1 - index].fighter };
        } else {
            p.combo.hits = hit.comboHit;
            p.combo.damage += hit.damage;
            p.combo.pop = 1;
        }
    }

    endCombo(p) {
        const c = p.combo;
        if (!c || c.ended) return;
        c.ended = true;
        c.timer = COMBO_HOLD;
        const rating = RATINGS.find(([min]) => c.hits >= min);
        if (rating) {
            p.rating = { text: rating[1], level: rating[2], color: rating[3], age: 0 };
            this.finished.push({ player: this.players.indexOf(p), hits: c.hits, damage: c.damage, level: rating[2] });
        }
    }

    /** Combos that ended with a rating since the last call: [{ player, hits, damage, level }]. */
    finishedCombos() {
        const finished = this.finished;
        this.finished = [];
        return finished;
    }

    update() {
        for (const p of this.players) {
            const f = p.fighter;
            if (f.health < p.lastHealth) {
                const lost = p.lastHealth - f.health;
                p.delay = GHOST_DELAY;
                p.shake = Math.max(p.shake, Math.min(14, 3 + lost * 0.7));
                p.chunkFlash = CHUNK_FLASH;
            }
            p.lastHealth = f.health;
            if (p.delay > 0) p.delay--;
            else if (p.ghost > f.health) p.ghost = Math.max(f.health, p.ghost - f.maxHealth * 0.012);
            p.ghost = Math.max(p.ghost, f.health);
            p.shake *= 0.8;
            if (p.chunkFlash > 0) p.chunkFlash--;

            const c = p.combo;
            if (c) {
                c.pop *= 0.78;
                // A combo lasts while the victim is still reeling from the last hit.
                if (!c.ended && !c.victim.stateMachine.isInHitstun()) this.endCombo(p);
                if (c.ended && --c.timer <= 0) p.combo = null;
            }
            if (p.rating && ++p.rating.age > RATING_FRAMES) p.rating = null;
        }
    }

    render(ctx, { wins, roundsToWin, seconds, time = 0, studio = null }) {
        beginUi(time);
        this.players.forEach((p, i) => this.renderPlayer(ctx, p, i, wins[i], roundsToWin, studio, time));
        this.renderTimer(ctx, seconds);
    }

    renderPlayer(ctx, p, index, wins, roundsToWin, studio, time) {
        const f = p.fighter;
        const flip = index === 1;
        const jx = (Math.random() - 0.5) * 2 * p.shake, jy = (Math.random() - 0.5) * p.shake;
        const x = (flip ? SCREEN.width - BAR.margin - BAR.width : BAR.margin) + jx;
        const y = BAR.y + jy;
        const portraitX = (flip ? SCREEN.width - 98 : 18) + jx;
        const pct = f.health / f.maxHealth;
        const low = pct > 0 && pct <= LOW_HEALTH;

        // Portrait card
        inkPanel(ctx, portraitX, 14 + jy, 80, 80, { fill: f.color, radius: 14 });
        ctx.save();
        ctx.clip(inkRectPath(portraitX + 4, 18 + jy, 72, 72, 10));
        ctx.fillStyle = '#fdf3dc';
        ctx.fillRect(portraitX, 14 + jy, 80, 80);
        studio?.draw(ctx, { x: portraitX + 3, y: 17 + jy, width: 74, height: 74 }, f.def, { key: `hud-${index}`, state: this.portraitState(f), facingRight: !flip, portrait: true });
        ctx.restore();

        // Low health: the bar throbs with a red glow.
        if (low) {
            const throb = 0.5 + 0.5 * Math.sin(time * 0.25);
            ctx.save();
            ctx.shadowColor = `rgba(255,60,40,${0.5 + 0.4 * throb})`;
            ctx.shadowBlur = 10 + 14 * throb;
            ctx.fillStyle = '#3b2a24';
            ctx.fill(inkRectPath(x, y, BAR.width, BAR.height, 8));
            ctx.restore();
        }

        // Health bar: dark backing, trailing damage ghost (white the moment it's lost, then hot red), colored fill.
        inkPanel(ctx, x, y, BAR.width, BAR.height, { fill: '#3b2a24', radius: 8, shadow: true });
        ctx.save();
        ctx.clip(inkRectPath(x + 3, y + 3, BAR.width - 6, BAR.height - 6, 6));
        const fill = (value, color) => {
            const w = (value / f.maxHealth) * BAR.width;
            ctx.fillStyle = color;
            ctx.fillRect(flip ? x + BAR.width - w : x, y, w, BAR.height);
        };
        fill(p.ghost, p.chunkFlash > 0 ? '#ffffff' : '#ff6a3d');
        let color = pct > 0.5 ? '#6cc04a' : pct > LOW_HEALTH ? '#f2c230' : '#e2543b';
        if (low && Math.sin(time * 0.25) > 0.3) color = '#ff7b5c';
        fill(f.health, color);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x, y + 5, BAR.width, 5);
        ctx.restore();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#2a1d17';
        ctx.stroke(inkRectPath(x, y, BAR.width, BAR.height, 8));

        drawText(ctx, f.name.toUpperCase(), flip ? x + BAR.width : x, y - 7, {
            size: 24, font: DISPLAY_FONT, weight: 'normal', align: flip ? 'right' : 'left', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5
        });
        drawText(ctx, `${Math.ceil(f.health)}`, flip ? x + 10 : x + BAR.width - 10, y + 21, {
            size: 18, align: flip ? 'left' : 'right', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 4
        });

        // Round wins
        for (let w = 0; w < roundsToWin; w++) {
            const cx = flip ? x + BAR.width - 14 - w * 30 : x + 14 + w * 30;
            inkStar(ctx, cx, y + BAR.height + 18, 11, w < wins ? '#f7c948' : '#6b5a4e');
        }

        this.renderCombo(ctx, p, flip);
    }

    /** "5 HITS / 38 DAMAGE" on the attacker's side, and the rating when it ends. */
    renderCombo(ctx, p, flip) {
        const side = flip ? -1 : 1;
        const cx = flip ? SCREEN.width - 190 : 190;
        const c = p.combo;
        if (c && c.hits >= 2) {
            const alpha = c.ended ? Math.min(1, c.timer / 20) : 1;
            const scale = 1 + 0.7 * c.pop;
            const color = comboColor(c.hits);
            ctx.save();
            ctx.translate(cx + (Math.random() - 0.5) * 8 * c.pop, 168);
            ctx.rotate(-0.07 * side);
            ctx.scale(scale, scale);
            drawText(ctx, `${c.hits}`, -6, 0, { size: 72, font: DISPLAY_FONT, weight: 'normal', align: 'right', baseline: 'middle', color, outline: '#2a1d17', outlineWidth: 9, alpha });
            drawText(ctx, 'HITS', 0, 6, { size: 34, font: DISPLAY_FONT, weight: 'normal', align: 'left', baseline: 'middle', color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 6, alpha });
            ctx.restore();
            drawText(ctx, `${c.damage} DAMAGE`, cx, 222, { size: 20, color: '#fdf3dc', outline: '#2a1d17', outlineWidth: 5, alpha });
        }
        const r = p.rating;
        if (r) {
            const slide = Math.max(0, 1 - r.age / 6);
            const pop = r.age < 6 ? 1.6 - 0.6 * (r.age / 6) : 1;
            const alpha = r.age > RATING_FRAMES - 15 ? (RATING_FRAMES - r.age) / 15 : 1;
            ctx.save();
            ctx.translate(cx - side * 160 * slide, 262);
            ctx.rotate(-0.05 * side);
            ctx.scale(pop, pop);
            drawText(ctx, r.text, 0, 0, { size: 48, font: DISPLAY_FONT, weight: 'normal', baseline: 'middle', color: r.color, outline: '#2a1d17', outlineWidth: 8, alpha });
            ctx.restore();
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
