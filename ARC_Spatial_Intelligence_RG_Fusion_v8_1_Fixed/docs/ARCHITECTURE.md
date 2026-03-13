# Architecture Overview

## Canonical Runtime Surface

The canonical runtime is the browser-first v17 fallback map shell:

- `app/index.html`
- `app/arc/app.bundle.js`

Supporting source fragments are preserved in `app/arc/`, but the active browser runtime currently loads the bundled script.

## Runtime Flow

1. Boot initializes UI and map shell.
2. Structure dataset is loaded into the selection workflow.
3. User locks a structure.
4. Blueprint state is optionally loaded from localStorage.
5. Sensors are generated inside the selected structure.
6. Simulation emits synthetic RF observations.
7. Weighted estimator computes an inferred device point.
8. HUD panels update confidence, zone, selection state, and logs.
9. SVG/Canvas overlays render structure, paths, sensors, truth, and estimates.

## Major Subsystems

### Structure Lock Layer
Constrains simulation and estimation to a selected building polygon.

### Blueprint Overlay Layer
Allows per-structure floorplan alignment using image upload, opacity, scale, and offset controls.

### Synthetic Sensor Layer
Creates anchor sensors and emits synthetic signal observations for demo/training use.

### Estimation Layer
Uses weighted averaging from observation strength and polygon clamping to produce a bounded estimate.

### Visualization Layer
Combines OSM tile rendering, SVG overlays, RF canvas, and HUD cards.

## Known Limitations

- Synthetic-only sensor model
- No validated real RF propagation model
- No authenticated device scanning
- No persistence beyond local blueprint alignment state
- Bundle-first runtime reduces auditability until source is re-split
