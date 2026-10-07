# OOTIE Personal Canonical Workspace

The active workspace is the root of this independent repository, returned by `git rev-parse --show-toplevel`. GitHub repository: [sandyforr2021-debug/ootie-personal](https://github.com/sandyforr2021-debug/ootie-personal). The local main branch tracks origin/main after the initial source upload.

The original OOTIE-main checkout, nested mirror, legacy, backups and previous Git history are not part of this repository. Work in this clone when contributing to the independent project.

## Commands

```powershell
npm ci
npm ci --prefix gateway
npm run check:syntax
npm test
npm run build
npm run check:production-readiness
```

Maintain canonical src/, scripts/, tests/, gateway/, deploy/, production/ and supabase/personal_baseline/ source. Environment values, credentials, user backups, build outputs and local verification stay outside committed source.

Local checks do not authorize database writes, Production promotion, paid AI calls, seed resets or deployments. Existing cloud services continue independently of GitHub changes.
