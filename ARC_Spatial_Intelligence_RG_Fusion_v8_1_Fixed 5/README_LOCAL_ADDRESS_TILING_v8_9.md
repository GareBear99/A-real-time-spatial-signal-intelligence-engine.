# Local Address Tiling v8.9

Adds a local-only address vault and zoom-aware tile / parcel overlay layer.

## Added
- Address input + canonicalization
- Manual lat/lng anchoring and Use Active Device Fix
- Address Vault with search, open, export, delete
- JSON and CSV import/export
- Multi-zoom tile stack generation (z6, z10, z12, z14, z16, z18)
- Occupancy overlay: regional tiles at low zoom, block cells at mid zoom, parcel anchors at high zoom
- Nearest saved address hint to active device fix

## Local-only
No cloud backend and no network geocoder are used in this patch.
