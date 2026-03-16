# SERVICE_V8

RG Fusion v8 adds a **local-first service architecture scaffold** on top of the v7 ops prototype.

## What it does
- Exposes a browser-side model of future API/server responsibilities
- Exports an OpenAPI draft, SQL schema draft, and deployment/service manifest
- Adds local RBAC gating for sensitive controls
- Adds cross-tab operator presence + shared event feed
- Adds a benchmark harness for local runtime/export timing

## What it does not do
- It is not a real server
- It does not provide real authentication or signed tokens
- It does not persist to a production database
- It does not provide websocket or cloud ingest

## Why this matters
This layer closes the gap between a sophisticated local prototype and a credible production migration path. The next step after v8 would be implementing the exported contracts in a real API service.
