# ADR 0005: MapTiler and MapLibre

- Status: Accepted
- Date: 2026-08-27

## Decision

Use MapTiler SDK/MapLibre for maps and PostGIS for spatial truth. Browser keys are separate per environment, restricted by allowed origins, and safe to expose only through the public config entrypoint.

## Consequences

Map data is loaded by viewport with clustering and request cancellation. Sensitive locations must be redacted before reaching public map responses.
