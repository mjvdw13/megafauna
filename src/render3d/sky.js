// ============================================================================
// SKY
// Each stage's sky is rendered once into a cube map, which serves as both the
// background and the ambient lighting (image-based lighting). Daytime skies
// use three's physical atmosphere model; night skies are a painted gradient.
// ============================================================================
import * as THREE from 'three';
import { Sky } from 'three/addons/Sky.js';

/** Unit vector for a sun at `elevation` degrees above the horizon, `azimuth` degrees (0 = straight ahead, behind the stage). */
export function sunDirection(elevation, azimuth = 0) {
    const el = THREE.MathUtils.degToRad(elevation), az = THREE.MathUtils.degToRad(azimuth);
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

function atmosphere({ elevation = 30, azimuth = 0, turbidity = 4, rayleigh = 1.2, mie = 0.004, mieG = 0.8 }) {
    const sky = new Sky();
    sky.scale.setScalar(10);
    const u = sky.material.uniforms;
    u.turbidity.value = turbidity;
    u.rayleigh.value = rayleigh;
    u.mieCoefficient.value = mie;
    u.mieDirectionalG.value = mieG;
    u.sunPosition.value.copy(sunDirection(elevation, azimuth));
    return sky;
}

/** A vertical gradient dome (night skies, haze). stops: [[height -1..1, color], ...] low to high. */
function gradientDome(stops) {
    const g = new THREE.SphereGeometry(10, 48, 24);
    const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
    const colors = stops.map(([h, hex]) => [h, new THREE.Color(hex)]);
    for (let i = 0; i < p.count; i++) {
        const h = p.getY(i) / 10;
        let j = 0;
        while (j < colors.length - 2 && h > colors[j + 1][0]) j++;
        const [h0, c0] = colors[j], [h1, c1] = colors[j + 1];
        col.copy(c0).lerp(c1, THREE.MathUtils.clamp((h - h0) / (h1 - h0), 0, 1));
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
}

/**
 * Render a sky once. spec: { elevation, azimuth, turbidity, rayleigh, mie } for daylight,
 * or { gradient: [[height, color], ...] } for a painted (night) sky.
 * Returns { background, environment } textures.
 */
export function bakeSky(renderer, spec) {
    const skyScene = new THREE.Scene();
    skyScene.add(spec.gradient ? gradientDome(spec.gradient) : atmosphere(spec));
    const cube = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
    new THREE.CubeCamera(0.1, 100, cube).update(renderer, skyScene);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(skyScene).texture;
    pmrem.dispose();
    skyScene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    return { background: cube.texture, environment };
}
