// ============================================================================
// INPUT HANDLER
// ============================================================================
class InputHandler {
    constructor() {
        this.keys = new Map();
        this.previousKeys = new Map();
        this.player1 = this.createPlayerInput();
        this.player2 = this.createPlayerInput();
        this.menuInput = { confirm: false, back: false };
        window.addEventListener('keydown', (e) => { this.keys.set(e.code, true); e.preventDefault(); });
        window.addEventListener('keyup', (e) => { this.keys.set(e.code, false); });
    }

    createPlayerInput() {
        return { left: false, right: false, up: false, down: false, lightAttack: false, heavyAttack: false, special: false,
                 horizontal: 0, vertical: 0, leftPressed: false, rightPressed: false, upPressed: false, downPressed: false,
                 lightAttackPressed: false, heavyAttackPressed: false, specialPressed: false };
    }

    isKeyDown(code) { return this.keys.get(code) || false; }
    isKeyPressed(code) { return this.isKeyDown(code) && !this.previousKeys.get(code); }

    update() {
        // P1: WASD + JKL
        this.player1.left = this.isKeyDown('KeyA'); this.player1.right = this.isKeyDown('KeyD');
        this.player1.up = this.isKeyDown('KeyW'); this.player1.down = this.isKeyDown('KeyS');
        this.player1.lightAttack = this.isKeyDown('KeyJ'); this.player1.heavyAttack = this.isKeyDown('KeyK');
        this.player1.special = this.isKeyDown('KeyL');
        this.player1.leftPressed = this.isKeyPressed('KeyA'); this.player1.rightPressed = this.isKeyPressed('KeyD');
        this.player1.upPressed = this.isKeyPressed('KeyW'); this.player1.downPressed = this.isKeyPressed('KeyS');
        this.player1.lightAttackPressed = this.isKeyPressed('KeyJ'); this.player1.heavyAttackPressed = this.isKeyPressed('KeyK');
        this.player1.specialPressed = this.isKeyPressed('KeyL');
        this.player1.horizontal = (this.player1.right ? 1 : 0) - (this.player1.left ? 1 : 0);
        // P2: Arrows + Numpad
        this.player2.left = this.isKeyDown('ArrowLeft'); this.player2.right = this.isKeyDown('ArrowRight');
        this.player2.up = this.isKeyDown('ArrowUp'); this.player2.down = this.isKeyDown('ArrowDown');
        this.player2.lightAttack = this.isKeyDown('Numpad1'); this.player2.heavyAttack = this.isKeyDown('Numpad2');
        this.player2.special = this.isKeyDown('Numpad3');
        this.player2.leftPressed = this.isKeyPressed('ArrowLeft'); this.player2.rightPressed = this.isKeyPressed('ArrowRight');
        this.player2.upPressed = this.isKeyPressed('ArrowUp'); this.player2.downPressed = this.isKeyPressed('ArrowDown');
        this.player2.lightAttackPressed = this.isKeyPressed('Numpad1'); this.player2.heavyAttackPressed = this.isKeyPressed('Numpad2');
        this.player2.specialPressed = this.isKeyPressed('Numpad3');
        this.player2.horizontal = (this.player2.right ? 1 : 0) - (this.player2.left ? 1 : 0);
        // Menu
        this.menuInput.confirm = this.isKeyPressed('Enter') || this.isKeyPressed('Space');
        this.menuInput.back = this.isKeyPressed('Escape');
        // Copy current keys to previous AFTER checking presses
        this.previousKeys = new Map(this.keys);
    }

    getPlayerInput(num) { return num === 1 ? this.player1 : this.player2; }
}
