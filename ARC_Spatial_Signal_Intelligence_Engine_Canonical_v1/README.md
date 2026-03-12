# ARC Spatial Signal Intelligence Engine — Canonical v1

ARC is a browser-first spatial signal intelligence prototype focused on structure-locked mapping, synthetic RF/WiFi sensor simulation, GPS fallback map rendering, and blueprint-aligned interior estimation.

This package consolidates the uploaded project into **one canonical GitHub-ready version**.

## Canonical Runtime

The canonical runtime is the **v17 GPS Fallback Map** build located in:

```text
app/
```

Open `app/index.html` in a browser to run the current offline-safe shell.

## What This Canonical Package Includes

- **Canonical app runtime** using the v17 structure-locked GPS fallback map shell
- **Bundled local app code** in `app/arc/`
- **Legacy v10 source reference** preserved in `legacy/v10_source/`
- **Architecture, roadmap, and packaging docs** in `docs/`
- **GitHub metadata recommendations** for repo positioning and search discoverability

## Core Capabilities

- Structure search and lock workflow
- Synthetic multi-sensor RF observation generation inside a selected structure
- Weighted location estimation with confidence scoring
- Blueprint image overlay alignment per structure
- OSM fallback tile rendering with local overlay layers
- Selection, estimator, and debug HUD panels
- Browser-only runtime with no backend requirement for the canonical demo shell

## Quick Start

### Option 1 — Open directly

Open:

```text
app/index.html
```

### Option 2 — Serve locally

Python:

```bash
cd app
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Recommended GitHub Repo Name

```text
ARC-Spatial-Signal-Intelligence-Engine
```

## Recommended GitHub Description

```text
Browser-first spatial signal intelligence prototype for structure-locked RF/WiFi mapping, blueprint overlays, and synthetic geospatial sensor estimation.
```

## Recommended GitHub Topics

```text
signal-intelligence
rf-analysis
wifi-analysis
geospatial
sensor-fusion
mapping
signal-processing
spatial-computing
simulation
browser-demo
osint
```

## Canonical Package Notes

- **v17 is the canonical runtime** for this package.
- **v10 is preserved only as legacy reference**, not as the primary app.
- The current build is still a prototype/research shell, not a validated real-world RF intelligence platform.
- The estimator and room/zone inference are synthetic/demo logic and should be treated as simulation scaffolding.

## Next Recommended Upgrade Path

1. Split `app.bundle.js` into audited source modules and rebuild pipeline.
2. Add deterministic scenario files for repeatable simulations.
3. Add a proper test harness for estimator, geometry, and polygon constraints.
4. Add export/import of simulation sessions.
5. Add visible architecture diagrams and screenshots to the repo.
6. Add release tags and GitHub Pages demo hosting.

