# OOTIE Phase 5 Pre-Production Quality

Development-only status as of 2026-10-01. Production is unchanged.

## Browser and install surface

- Route-specific titles and shared Open Graph metadata are applied at runtime.
- Development Preview is explicitly `noindex,nofollow,noarchive`.
- The web app manifest uses OOTIE theme colors and a maskable brand icon.
- The service worker caches only same-origin static shell assets and a public offline page. Requests with authorization headers, cross-origin APIs, and private route navigations are excluded.

## Error and monitoring boundary

- Route-load, offline, service-worker registration, and unexpected Vue errors have a global recovery surface.
- Broken images fall back to the local OOTIE icon instead of a broken browser glyph.
- Monitoring remains provider-neutral and disabled unless configured.

## Legal copy status

Privacy, terms, and AI image pages are informational drafts. They do not claim legal review or regulatory compliance. The AI page states that try-on and outfit imagery are visual simulations, not exact fit, size, color, or material guarantees.

## Dependency decision

Vite 5 and Vitest 3 advisories require major upgrades to clear. Phase 5 does not apply those major upgrades. Plan and validate Vite 8 / plugin-vue 6 and Vitest 5 as a separate tooling migration before Production.
