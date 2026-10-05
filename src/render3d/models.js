// ============================================================================
// MODEL CACHE
// Each character's 3D model is built once (it takes a few hundred ms) and
// reused for every fighter, menu slot and portrait as a cheap clone.
// ============================================================================
import { buildModel } from './creature.js';

const templates = new Map();

export function getTemplate(def) {
    let template = templates.get(def.id);
    if (!template) {
        template = buildModel(def.model);
        templates.set(def.id, template);
    }
    return template;
}

export function hasTemplate(def) { return templates.has(def.id); }
