# ARC Spatial Signal Intelligence Engine

Browser-first **spatial signal intelligence**, **RF mapping**, **Wi‑Fi analysis**, and **geospatial sensor fusion** research package for the broader ARC / Lucifer / Synth ecosystem.

> **Status:** real prototype package with multiple browser-first builds, architecture docs, and legacy references. This repository is **not** a deployed production SIGINT platform, but it **does** contain working prototype surfaces rather than documentation alone.

---

## What this repository is

This repository is the public-facing research and prototype node for a spatial intelligence engine that treats signal observations as events embedded in **space**, **time**, and **uncertainty**.

The repo currently includes:

- **canonical browser-first prototype packages**
- **GPS fallback map builds**
- **structure-locked / blueprint-aligned mapping experiments**
- **synthetic RF and Wi‑Fi sensor simulation logic**
- **signal estimation and room inference scaffolding**
- **architecture, roadmap, and math documentation**
- **legacy builds preserved for reference**

This means the repo should be understood as a **prototype + architecture package** — more than a concept-only README, but still short of a production-grade validated field system.

---

## Start here

### Primary routes

- **Canonical prototype package:** [`ARC_Spatial_Signal_Intelligence_Engine_Canonical_v1/`](ARC_Spatial_Signal_Intelligence_Engine_Canonical_v1/)
- **RG Fusion service-oriented prototype:** [`ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed/`](ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed/)
- **Offline GPS fallback map shell:** [`ARC_v17_gps_fallback_map/`](ARC_v17_gps_fallback_map/)
- **Root architecture docs:** [`docs/`](docs/)

### Fastest local run path

If you want the simplest browser-first local shell, start with:

```bash
cd ARC_Spatial_Signal_Intelligence_Engine_Canonical_v1
python3 -m http.server 8080 -d app
```

Then open `http://localhost:8080`.

You can also run the root offline fallback shell from:

```text
ARC_v17_gps_fallback_map/index.html
```

---

## Core concept

The engine is designed around a staged signal-to-space pipeline:

1. **Signal ingestion** — Wi‑Fi, RF, GPS, and custom observation streams
2. **Processing** — normalization, filtering, and quality scoring
3. **Propagation modeling** — path-loss and attenuation assumptions
4. **Fusion** — temporal smoothing and multi-sensor reconciliation
5. **Spatial field updates** — tile/grid estimation over geospatial space
6. **Visualization** — heatmaps, tracks, overlays, and diagnostics

Signals are treated as **physical observations with uncertainty**, not just isolated readings.

---

## What is currently implemented vs. planned

### Present in this repository now

- browser-first local prototype builds
- synthetic signal simulation scaffolding
- estimator and room-inference modules
- blueprint / structure-aligned mapping experiments
- GPS fallback map shells
- local demo/operator panels
- multiple packaged prototype variants with changelog history

### Still not represented as production-ready

- validated real-world RF ingest stack
- authenticated multi-user deployment
- field-proven sensor fusion service backend
- reproducible benchmark suite with external evidence
- full test coverage and release-grade packaging

That distinction is important for trust.

---

## Repository layout

```text
A-real-time-spatial-signal-intelligence-engine/
├─ README.md
├─ CHANGELOG.md
├─ LICENSE
├─ CONTRIBUTING.md
├─ SECURITY.md
├─ CODE_OF_CONDUCT.md
├─ package.json
├─ .gitignore
├─ docs/
│  ├─ architecture.md
│  ├─ math-model.md
│  ├─ roadmap.md
│  ├─ stack.md
│  ├─ code-surface-audit.md
│  ├─ seo-promotion.md
│  └─ repo-setup-checklist.md
├─ ARC_Spatial_Signal_Intelligence_Engine_Canonical_v1/
├─ ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed/
├─ ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed 5/
├─ ARC_v17_gps_fallback_map/
└─ arc_serverless_v10_complete/
```

---

## Prototype packages in this repo

| Package | Role | Notes |
|---|---|---|
| [`ARC_Spatial_Signal_Intelligence_Engine_Canonical_v1`](ARC_Spatial_Signal_Intelligence_Engine_Canonical_v1/) | Canonical browser-first package | Best first stop for public repo visitors |
| [`ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed`](ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed/) | richer operator / fusion package | Includes broader ops-style framing |
| [`ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed 5`](ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed%205/) | duplicate/alternate packaged variant | Preserved package state from exported build |
| [`ARC_v17_gps_fallback_map`](ARC_v17_gps_fallback_map/) | offline-safe fallback map shell | Fast local map-based prototype |
| [`arc_serverless_v10_complete`](arc_serverless_v10_complete/) | older browser package | Useful as historical reference only |

---

## Ecosystem position

This repository is part of the wider ARC / AGI / simulation stack:

- [**Proto-AGI**](https://github.com/GareBear99/Proto-AGI) — high-level AGI framing and stack composition
- [**ARC-Core**](https://github.com/GareBear99/ARC-Core) — intelligence fusion, entities, proposals, cases, and correlation logic
- [**arc-lucifer-cleanroom-runtime**](https://github.com/GareBear99/arc-lucifer-cleanroom-runtime) — blank-slate runtime loop and directive execution discipline
- [**ARC-Turbo-OS**](https://github.com/GareBear99/ARC-Turbo-OS) — seed-rooted branch-aware runtime concepts
- [**Arc-RAR**](https://github.com/GareBear99/Arc-RAR) — archive / transfer layer for cross-system portability
- [**Proto-Synth_Grid_Engine**](https://github.com/GareBear99/Proto-Synth_Grid_Engine) — virtual simulated physics capacity-weighted substrate
- [**Seeded-Universe-Recreation-Engine**](https://github.com/GareBear99/Seeded-Universe-Recreation-Engine) — deterministic seeded cosmological simulation
- [**LuciferAI_Local**](https://github.com/GareBear99/LuciferAI_Local) — local AI execution and fallback cognition surface
- [**AGI_Photon-Quantum-Computing**](https://github.com/GareBear99/AGI_Photon-Quantum-Computing) — photonic compute and SSOT intelligence research

Within that ecosystem, this repo occupies the **spatial signal intelligence / geospatial propagation / sensor-fusion** lane.

---

## Mathematical foundation

A baseline propagation model can be represented by the log-distance path-loss equation:

```text
Pr(d) = Pt + Gt + Gr − L(d)
L(d) = L0 + 10n log10(d / d0)
```

Where:

- `Pr(d)` is received power at distance `d`
- `Pt` is transmit power
- `Gt`, `Gr` are antenna gains
- `L(d)` is estimated path loss
- `n` is the environment-dependent path-loss exponent

The current repository does not claim validated field calibration across environments. The equation and spatial-field approach should be treated as prototype/research scaffolding in this package state.

---

## Quick start

### Root docs

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/math-model.md`](docs/math-model.md)
- [`docs/roadmap.md`](docs/roadmap.md)
- [`docs/stack.md`](docs/stack.md)

### Serve the canonical package

```bash
cd ARC_Spatial_Signal_Intelligence_Engine_Canonical_v1
python3 -m http.server 8080 -d app
```

### Serve the RG fusion package

```bash
cd ARC_Spatial_Intelligence_RG_Fusion_v8_1_Fixed
python3 -m http.server 8080 -d app
```

### Serve the offline fallback shell

```bash
cd ARC_v17_gps_fallback_map
python3 -m http.server 8080
```

---

## Public positioning

This repository should currently be presented as:

- a **browser-first spatial signal intelligence prototype package**
- a **geospatial RF / Wi‑Fi mapping research repo**
- a **sensor-fusion and spatial-estimation architecture foundation**
- a **public-facing ecosystem node** connected to ARC-Core and the wider AGI/runtime stack

It should **not** yet be presented as a verified production SIGINT product.

---

## Search-facing summary

Relevant search paths for this repo include:

- spatial signal intelligence engine
- RF mapping prototype
- Wi‑Fi analysis browser demo
- geospatial sensor fusion engine
- signal propagation modeling JavaScript
- browser-based signal intelligence visualization
- spatial computing for RF / Wi‑Fi fields
- structure-locked signal estimation

---

## License

MIT. See [LICENSE](LICENSE).
