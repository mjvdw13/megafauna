// ============================================================================
// PAPER
// A grain + vignette overlay drawn over every frame so the whole game looks
// printed on paper. Generated once at startup.
// ============================================================================
import { createCanvas } from './canvas.js';

export function createPaperOverlay(width, height) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Grain: speckles of slightly-off-white, multiplied over the frame.
    const image = ctx.createImageData(width, height);
    for (let i = 0; i < image.data.length; i += 4) {
        const v = 255 - Math.floor(Math.random() * Math.random() * 46);
        image.data[i] = v;
        image.data[i + 1] = v - 3;
        image.data[i + 2] = v - 10;
        image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);

    // Paper fibers
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#6b5a45';
    ctx.lineWidth = 1;
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * width, y = Math.random() * height, a = Math.random() * Math.PI, len = 4 + Math.random() * 14;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }

    // Vignette
    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.45, width / 2, height / 2, width * 0.72);
    vignette.addColorStop(0, 'rgba(255,255,255,0)');
    vignette.addColorStop(1, 'rgba(120,95,70,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    return canvas;
}

/** Multiply the overlay onto the frame. */
export function drawPaper(ctx, overlay) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(overlay, 0, 0);
    ctx.restore();
}
