# Inference Core v6

## What changed
The v6 estimator upgrades the old strongest-sensor weighted centroid with three extra layers:
1. sensor reliability learned from recent history
2. floor-aware penalties for cross-floor mismatch
3. candidate cloud generation for approximate posterior visualization

## Accuracy lab
The built-in accuracy lab runs deterministic Monte Carlo trials inside the locked structure and reports:
- RMSE
- P50 error
- P95 error
- mean confidence

## Calibration wizard
The wizard derives a custom profile from current live history and stores it in memory for the active runtime as `wizard`.
