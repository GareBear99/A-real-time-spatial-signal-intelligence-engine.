# LuciferAI Spatial Intelligence Engine — RG Fusion v6

A lighter Lucifer-purple spatial intelligence command center fused with RG-style operations flow and a stronger inference core.

## New in v6
- sensor reliability scoring that adapts from recent observation error history
- floor-aware inference and operator floor selection
- candidate cloud rendering around the estimate
- calibration wizard that derives a custom profile from live history
- accuracy lab with Monte Carlo testing, RMSE, P50, and P95 reports
- manifest export for runtime/audit handoff
- geofence breach detection and scenario presets

## Main runtime
- `app/index.html`

## Core operator surfaces
- Dashboard
- Operations
- Signals
- Sessions
- Settings / Accuracy Lab

## Notes
This remains a browser-first local prototype, but v6 pushes the estimator closer to a real research-grade spatial fusion surface.


## v7 additions

- Ingestion gateway for pasted JSON/CSV/NMEA-ish tracks
- Mock live polling loop for imported or generated tracks
- Local operator roster and incident workflow
- Evidence pack export for investigations

This package remains a local browser app. It simulates backend/ops behaviors in-browser and does not ship a real authenticated multi-user service.


## v8 Service Architecture

This package now includes a local-first service architecture layer with: 
- OpenAPI export
- SQL schema export
- service/deployment manifest export
- local RBAC gating
- cross-tab collaboration presence/events
- benchmark harness
