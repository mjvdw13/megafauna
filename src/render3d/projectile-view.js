// ============================================================================
// PROJECTILE VIEW
// 3-D projectiles in flight: Riley's bark (sound waves), Quackers' egg,
// Randy's boulder, Dad's bad breath, Gary's fireball and ember patch. Each one
// follows its gameplay projectile.
// ============================================================================
import * as THREE from 'three';
import { addRest, DETAIL, withDetail } from './materials.js';
import { fbm } from './noise.js';

const PX = 0.01;

let softTexture = null;
function soft() {
    if (!softTexture) {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.5, 'rgba(255,255,255,0.4)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        softTexture = new THREE.CanvasTexture(c);
        softTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return softTexture;
}

/** A rounder smoke puff than soft(): solid in the middle with a short falloff, so puffs keep their shape. */
let puffTexture = null;
function puff() {
    if (!puffTexture) {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.55, 'rgba(255,255,255,0.8)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        puffTexture = new THREE.CanvasTexture(c);
        puffTexture.colorSpace = THREE.SRGBColorSpace;
    }
    return puffTexture;
}

const BUILD = {
    bark(p) {
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32, Math.PI * 0.8), new THREE.MeshBasicMaterial({ color: p.owner.accentColor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
            ring.rotation.z = -Math.PI * 0.4;
            ring.rotation.y = Math.PI / 2 - 0.35;
            g.add(ring);
        }
        return g;
    },
    egg() {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#f6efe0', roughness: 0.35, clearcoat: 0.3 }));
        m.scale.set(0.09, 0.12, 0.09);
        m.castShadow = true;
        return m;
    },
    boulder() {
        const g = new THREE.IcosahedronGeometry(1, 3);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(pos, i);
            v.multiplyScalar(0.82 + fbm(v.x * 1.7 + 3, v.y * 1.7, v.z * 1.7, 4) * 0.4);
            pos.setXYZ(i, v.x, v.y, v.z);
        }
        g.computeVertexNormals();
        const m = new THREE.Mesh(addRest(g), withDetail(new THREE.MeshStandardMaterial({ color: '#7e7468', roughness: 0.95 }), { mode: DETAIL.ROCK, freq: 9, strength: 1.2, tint: 0.2, freq2: 2 }));
        m.castShadow = true;
        return m;
    },
    breath() {
        // Separate puffs in a sickly yellow-green that stands out from foliage, darker olive ones for body.
        const colors = ['#c9d24a', '#7f8c26', '#dfe37a', '#9fac34'];
        const g = new THREE.Group();
        for (let i = 0; i < 11; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff(), color: colors[i % colors.length], transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
            const a = i * 2.4, r = i === 0 ? 0 : 0.25 + (i % 3) * 0.12;
            s.userData.offset = [Math.cos(a) * r, Math.sin(a) * r * 0.7, Math.sin(i * 0.9) * 0.2];
            s.userData.size = 0.38 + ((i * 7) % 5) * 0.06;
            g.add(s);
        }
        return g;
    },
    fireball() {
        // A white-hot core inside orange glow, with a tail of cooling flames behind.
        const g = new THREE.Group();
        // The outer glow is blended normally so it stays orange over bright water and sky.
        const glow = (color, opacity, additive = true) => new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false }));
        const layers = [['#ff5a14', 0.9, 0.62, false], ['#ffb02e', 1, 0.42], ['#fff4c8', 1, 0.24]];
        for (const [color, opacity, size, additive] of layers) {
            const s = glow(color, opacity, additive);
            s.userData = { size, trail: 0 };
            g.add(s);
        }
        for (let i = 1; i <= 6; i++) {
            const s = glow(i < 3 ? '#ff9a1f' : '#e8401a', 0.75 - i * 0.1);
            s.userData = { size: 0.42 - i * 0.04, trail: i };
            g.add(s);
        }
        return g;
    },
    embers() {
        // A smouldering patch: glowing coals on the ground with flames dancing over them.
        const g = new THREE.Group();
        const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ map: soft(), color: '#ff4a10', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        bed.rotation.x = -Math.PI / 2;
        bed.userData.bed = true;
        g.add(bed);
        for (let i = 0; i < 9; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: i % 3 === 0 ? '#ffd36a' : '#ff7a1a', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
            s.userData = { u: (i / 8) * 2 - 1, z: ((i * 5) % 7) / 7 - 0.5, phase: i * 1.7 };
            g.add(s);
        }
        return g;
    }
};

export class ProjectileViews {
    constructor(world) {
        this.world = world;
        this.views = new Map();
    }

    sync(projectiles, time) {
        const live = new Set(projectiles);
        for (const [p, obj] of this.views) if (!live.has(p)) { this.world.scene.remove(obj); this.views.delete(p); }
        for (const p of projectiles) {
            let obj = this.views.get(p);
            if (!obj) {
                const build = BUILD[p.kind];
                if (!build) continue;
                obj = build(p);
                this.world.scene.add(obj);
                this.views.set(p, obj);
            }
            obj.position.set(this.world.toWorldX(p.centerX), this.world.toWorldY(p.centerY), 0);
            const fade = Math.max(0, 1 - p.age / p.life);
            if (p.kind === 'bark') {
                obj.children.forEach((ring, i) => {
                    const r = p.height * PX * (0.3 + i * 0.22);
                    ring.scale.set(r, r, r);
                    ring.position.x = p.dir * i * 0.06;
                    ring.material.opacity = fade * (0.9 - i * 0.22);
                });
                obj.scale.x = p.dir;
            } else if (p.kind === 'egg') {
                obj.rotation.z = -p.age * 0.25 * p.dir;
            } else if (p.kind === 'boulder') {
                obj.scale.setScalar(p.width * PX * 0.5);
                obj.rotation.z = -(p.centerX * PX) / (p.width * PX * 0.5);
            } else if (p.kind === 'breath') {
                // Puffs billow outward and bob as the cloud drifts.
                const size = p.width * PX, spread = 1 + Math.min(1, p.age / p.life) * 0.35;
                obj.children.forEach((s, i) => {
                    const [ox, oy, oz] = s.userData.offset;
                    s.position.set(ox * size * spread + Math.sin(time * 2 + i) * 0.03, oy * size * spread + Math.sin(time * 2.6 + i * 1.3) * 0.025, oz * size);
                    s.scale.setScalar(size * s.userData.size * (1 + 0.08 * Math.sin(time * 3 + i)));
                    s.material.opacity = 0.85 * Math.min(1, fade * 2);
                });
            } else if (p.kind === 'fireball') {
                const flicker = 1 + 0.12 * Math.sin(time * 40 + p.age);
                obj.children.forEach((s, i) => {
                    const { size, trail } = s.userData;
                    s.position.set(-p.vx * PX * trail * 0.9,Math.sin(time * 30 + i * 2) * 0.012 * trail, 0);
                    s.scale.setScalar(size * flicker * (1 + Math.min(1, p.age / 6) * 0.15));
                    s.material.rotation = time * 6 + i;
                });
            } else if (p.kind === 'embers') {
                // Sits on the ground; flames flicker over it and die down as it burns out.
                const w = p.width * PX / 2, life = Math.min(1, fade * 4) * Math.min(1, p.age / 8);
                obj.position.y = this.world.toWorldY(p.y + p.height);
                obj.children.forEach((s) => {
                    if (s.userData.bed) {
                        s.position.y = 0.01;
                        s.scale.set(w * 1.1, w * 0.55, 1);
                        s.material.opacity = 0.75 * life;
                        return;
                    }
                    const { u, z, phase } = s.userData;
                    const lick = 0.5 + 0.5 * Math.sin(time * 9 + phase) * Math.sin(time * 5.3 + phase * 2);
                    const h = (0.24 + 0.3 * lick) * life;
                    s.position.set(u * w * 0.85, h * 0.45, z * 0.35);
                    s.scale.set(0.2 + 0.08 * lick, h, 1);
                    s.material.opacity = 0.9 * life;
                });
            }
        }
    }

    clear() {
        for (const obj of this.views.values()) this.world.scene.remove(obj);
        this.views.clear();
    }
}
