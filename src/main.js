// ============================================================================
// ENTRY POINT
// ============================================================================
import { Game } from './core/game.js';

// Wait briefly for the hand-lettered fonts so the first frames don't flash fallback text.
const fontsReady = Promise.all([document.fonts.load('40px Bangers'), document.fonts.load('20px "Patrick Hand"')]);
await Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 1500))]).catch(() => {});

const game = new Game(document.getElementById('game-canvas'));
window.game = game; // handy for poking at state from the dev console
await game.preload();
game.start();
