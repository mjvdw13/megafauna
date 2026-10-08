// ============================================================================
// TOUCH CONTROLS
// On-screen controls for phones and tablets, for player 1 (vs CPU and online).
// A floating stick on the left half of the screen, a diamond of fight buttons
// on the right laid out like a controller's face buttons, plus shield and grab.
//
//   TouchPad       the state the controls produce, ORed into player 1's input
//                  each step like a controller (see gamepad.js). No DOM, so the
//                  tests can drive it.
//   TouchControls  the DOM overlay that feeds a TouchPad.
//
// Stick: push to move, up jumps (tap jump), flick sideways to run (or flick
// twice, like double-tapping a key). Each scene can relabel or hide buttons
// through a `touchButtons` getter, e.g. { attack: 'OK', smash: 'BACK' } in menus.
// ============================================================================

export const TOUCH_STICK = Object.freeze({
    radius: 56,        // px the knob can travel from where the thumb landed
    deadZone: 0.35,    // left / right below this is ignored
    vertical: 0.55,    // up / down need a firmer push, so walking doesn't jump or crouch
    run: 0.85,         // a sideways flick past this...
    runFrames: 4       // ...within this many steps of leaving the middle starts a run
});

const BUTTON_ACTIONS = ['jump', 'attack', 'smash', 'special', 'shield', 'grab'];

/** Buttons shown in menus when a scene doesn't say otherwise. */
export const MENU_TOUCH_BUTTONS = Object.freeze({ attack: 'OK', smash: 'BACK' });

/** The fight layout: every button, labelled with its move. */
export const FIGHT_TOUCH_BUTTONS = Object.freeze({
    jump: 'JUMP', attack: 'ATTACK', smash: 'SMASH', special: 'SPECIAL', shield: 'SHIELD', grab: 'GRAB'
});

export class TouchPad {
    constructor() {
        this.reset();
    }

    reset() {
        this.held = new Set();
        this.downs = new Set();   // buttons pressed since the last poll, so a very quick tap still counts
        this.menuPresses = new Set();
        this.stick = { x: 0, y: 0 };
        this.previous = {};
        this.sinceNeutral = Infinity;
        this.ranThisPush = false;
    }

    press(action) {
        if (!this.held.has(action)) this.downs.add(action);
        this.held.add(action);
    }

    release(action) { this.held.delete(action); }

    /** Stick position, each axis -1..1 (y is down-positive, like the screen). */
    setStick(x, y) { this.stick = { x, y }; }

    /** A menu-level button (back, mute) was tapped; read once by takeMenu. */
    pressMenu(name) { this.menuPresses.add(name); }

    takeMenu(name) { return this.menuPresses.delete(name); }

    /** OR this step's touch state into a player's input (keyboard and controller already applied). */
    applyTo(input) {
        const { x, y } = this.stick;
        const held = {
            left: x < -TOUCH_STICK.deadZone, right: x > TOUCH_STICK.deadZone,
            up: y < -TOUCH_STICK.vertical, down: y > TOUCH_STICK.vertical
        };
        for (const action of BUTTON_ACTIONS) held[action] = this.held.has(action) || this.downs.has(action);
        const pressed = (key) => held[key] && (!this.previous[key] || this.downs.has(key));

        for (const action of ['left', 'right', 'up', 'down', 'jump', 'attack', 'smash', 'special', 'shield']) {
            input[action] = input[action] || held[action];
            input[`${action}Pressed`] = input[`${action}Pressed`] || pressed(action);
        }
        // Grab: shield + attack in one press, like a controller's L1.
        if (held.grab) input.shield = true;
        if (pressed('grab')) { input.shield = true; input.attack = true; input.attackPressed = true; }
        input.confirmPressed = input.confirmPressed || pressed('attack');
        input.cancelPressed = input.cancelPressed || pressed('smash');

        // Flick to run: the stick went from the middle to nearly all the way out in a few steps.
        const out = Math.abs(x);
        if (out < TOUCH_STICK.deadZone) { this.sinceNeutral = 0; this.ranThisPush = false; }
        else this.sinceNeutral++;
        if (out >= TOUCH_STICK.run && !this.ranThisPush && this.sinceNeutral <= TOUCH_STICK.runFrames) {
            input.dash = Math.sign(x);
            this.ranThisPush = true;
        }

        this.previous = held;
        this.downs.clear();
        return input;
    }
}

/** Best guess at whether this device is mainly driven by touch. */
export function isTouchDevice() {
    const media = (query) => typeof matchMedia === 'function' && matchMedia(query).matches;
    return media('(pointer: coarse)') || (globalThis.navigator?.maxTouchPoints > 0 && !media('(pointer: fine)'));
}

export class TouchControls {
    /**
     * @param parent  element to add the overlay to
     * @param pad     the TouchPad to feed
     * @param onShare called from the tap itself (browsers only share or copy inside a user gesture)
     */
    constructor(parent, pad, { onShare } = {}) {
        this.pad = pad;
        this.visible = false;
        this.layoutKey = '';
        this.root = document.createElement('div');
        this.root.id = 'touch';
        this.root.hidden = true;
        this.root.innerHTML = `
            <div class="zone"></div>
            <div class="stick idle"><div class="knob"></div></div>
            ${BUTTON_ACTIONS.map((a) => `<div class="btn ${a}" data-action="${a}"></div>`).join('')}
            <div class="btn top mute">SOUND</div>
            <div class="btn top exit"></div>
            <div class="btn share"></div>`;
        parent.appendChild(this.root);
        const hint = document.createElement('div');
        hint.id = 'rotate-hint';
        hint.textContent = 'TURN YOUR PHONE SIDEWAYS';
        parent.appendChild(hint);

        this.buttons = {};
        for (const el of this.root.querySelectorAll('[data-action]')) {
            this.buttons[el.dataset.action] = el;
            this.hold(el, el.dataset.action);
        }
        this.buttons.exit = this.root.querySelector('.exit');
        this.buttons.share = this.root.querySelector('.share');
        this.tap(this.root.querySelector('.mute'), () => pad.pressMenu('mute'));
        this.tap(this.buttons.exit, () => pad.pressMenu('back'));
        this.buttons.share.addEventListener('click', () => onShare?.());
        this.trackStick(this.root.querySelector('.zone'), this.root.querySelector('.stick'));
    }

    setVisible(visible) {
        if (visible === this.visible) return;
        this.visible = visible;
        this.root.hidden = !visible;
        document.body.classList.toggle('touch', visible);
        if (!visible) this.pad.reset();
    }

    /**
     * Show the buttons the current scene uses, with its labels; hide the rest.
     * @param buttons  { action or 'exit' or 'share': label }
     */
    setLayout(buttons) {
        const key = JSON.stringify(buttons);
        if (key === this.layoutKey) return;
        this.layoutKey = key;
        for (const [name, el] of Object.entries(this.buttons)) {
            const label = buttons[name];
            el.hidden = !label;
            if (label) el.textContent = label;
            else { el.classList.remove('active'); this.pad.release(name); }
        }
    }

    hold(el, action) {
        el.addEventListener('pointerdown', (e) => {
            el.setPointerCapture(e.pointerId);
            el.classList.add('active');
            this.pad.press(action);
            e.preventDefault();
        });
        const up = () => { el.classList.remove('active'); this.pad.release(action); };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
    }

    tap(el, onTap) {
        el.addEventListener('pointerdown', (e) => {
            el.classList.add('active');
            onTap();
            e.preventDefault();
        });
        const up = () => el.classList.remove('active');
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
    }

    /** The stick appears under the thumb wherever it lands in the zone, and rests in the corner otherwise. */
    trackStick(zone, stick) {
        const knob = stick.querySelector('.knob');
        const R = TOUCH_STICK.radius;
        let id = null, ox = 0, oy = 0;
        zone.addEventListener('pointerdown', (e) => {
            if (id !== null) return;
            id = e.pointerId;
            zone.setPointerCapture(id);
            ox = e.clientX;
            oy = e.clientY;
            stick.style.left = `${ox}px`;
            stick.style.top = `${oy}px`;
            stick.classList.remove('idle');
            knob.style.transform = '';
            e.preventDefault();
        });
        zone.addEventListener('pointermove', (e) => {
            if (e.pointerId !== id) return;
            let dx = e.clientX - ox, dy = e.clientY - oy;
            const len = Math.hypot(dx, dy);
            if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
            this.pad.setStick(dx / R, dy / R);
        });
        const end = (e) => {
            if (e.pointerId !== id) return;
            id = null;
            stick.classList.add('idle');
            stick.style.left = stick.style.top = '';
            knob.style.transform = '';
            this.pad.setStick(0, 0);
        };
        zone.addEventListener('pointerup', end);
        zone.addEventListener('pointercancel', end);
    }
}
