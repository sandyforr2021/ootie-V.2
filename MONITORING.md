# OOTIE Monitoring Foundation

Phase 5 adds an optional browser monitoring boundary without connecting a paid vendor.

- `src/services/monitoring.js` is the single client reporting interface.
- Reporting is disabled unless `VITE_MONITORING_PROVIDER` is configured.
- Development errors are logged after recursive field scrubbing.
- Keys containing token, authorization, password, secret, prompt, photo, image, payment, or card are redacted.
- AI prompts, private photos, auth tokens, passwords, and payment details must never be attached to monitoring events.

Before Production, choose a provider, configure environment-specific sampling, verify source-map access controls, and test data scrubbing. Do not add a provider key to Git.
