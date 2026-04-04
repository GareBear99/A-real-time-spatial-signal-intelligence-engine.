# Math Model

## Baseline propagation model

A simple starting point for received power estimation is the log-distance path loss model:

Pr(d) = Pt + Gt + Gr − L(d)
L(d) = L0 + 10n log10(d / d0)

This is a baseline only and should not be treated as sufficient for all environments.

## Fusion model

A baseline temporal estimate can use a Kalman-style update:

x̂k = x̂k−1 + Kk(zk − Hx̂k−1)

Future work should document:

- measurement noise assumptions
- environmental priors
- confidence weighting
- non-line-of-sight handling
- multipath heuristics
