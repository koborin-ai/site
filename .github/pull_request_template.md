## Change type

Select one and apply the matching GitHub label:

- [ ] `change:behavior` (externally observable behavior changes)
- [ ] `change:structure` (refactor / internal-only; no intended behavior change)

## Areas

- [ ] `app`
- [ ] `infra`
- [ ] `docs/meta`
- [ ] `ci`

## Summary

- What changed?
- Why?

## Verification

### App

- Behavior change:
  - `cd app && npm run lint && npm run build`
- Structure change:
  - `cd app && npm run lint`

### Infra

- `cd infra && npm run build && npm run lint && npm run typecheck`

## Review notes

- What could break?
- Any manual GCP steps?

