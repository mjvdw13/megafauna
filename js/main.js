// ============================================================================
// START GAME
// ============================================================================
const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);
game.start();
window.game = game;
