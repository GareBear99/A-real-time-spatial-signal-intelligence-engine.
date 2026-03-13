# ARC Spatial Intelligence RG Fusion v8 — Service Architecture

## Added
- Local service architecture layer with OpenAPI export, SQL schema export, and service manifest export
- Workspace auth + RBAC panel with local role gating for sensitive actions
- Cross-tab collaboration presence and event feed via BroadcastChannel + localStorage
- Local benchmark harness for UI/service export timing and repeatable lightweight scoring
- Updated product identity to RG Fusion v8

## Notes
This is still a local-first browser scaffold. It does not claim to be a real hosted backend. It provides the architecture, operator surfaces, and export artifacts needed to move toward one.

## v8.1 Fixes
- fixed boot-order crash caused by theme rendering before map DOM init
- added defensive null guards around map/runtime DOM surfaces
- corrected v8 ready log/version messaging
- made service layer boot whether DOMContentLoaded has already fired or not
