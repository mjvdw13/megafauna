# three.js (vendored)

[three.js](https://threejs.org) r170 (npm `three@0.170.0`), MIT licensed (see `LICENSE`).
Vendored so the game keeps running with no install or build step.

- `three.module.min.js` is `build/three.module.min.js` from the package.
- `addons/` holds the few files the game uses from `examples/jsm/`, unmodified.
  They import from the bare specifier `three`, which the import map in `index.html` points at the file above.

To upgrade: copy the same files from a newer `three` package and update the version above.
