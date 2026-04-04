# Architecture

The ARC Spatial Signal Intelligence Engine is organized around a staged signal-to-space pipeline:

1. ingest observations
2. normalize and score readings
3. model propagation assumptions
4. fuse observations over time
5. update a spatial field representation
6. render or export the result

## Modules

### Ingestion
Adapters for Wi‑Fi scans, RF receivers, GPS-tagged readings, and future custom hardware.

### Processing
Observation cleanup, normalization, confidence scoring, and quality checks.

### Propagation
Distance/path-loss estimation, attenuation assumptions, and future terrain-aware modeling.

### Fusion
Temporal smoothing and multi-sensor state estimation.

### Spatial grid
A tile/grid representation that stores estimated signal characteristics across space.

### Visualization
Heatmaps, tracks, overlays, and diagnostics.
