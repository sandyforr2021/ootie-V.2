# OOTIE Development Demo Account

This account exists only in `OOTIE-personal-dev`. It must never be copied to Production.

- Email: `ootie.demo@dev.example.com`
- User ID: `057ac876-912b-40d6-925b-b35c7f81b6b1`
- Profile ID: `fddc2a9c-adba-43d5-8c37-5dc153275462`
- Password: stored in the gitignored local file `DEMO_ACCOUNT.local.md`

The password is intentionally absent from committed source, browser code and Vite environment variables. Running the seed writes or refreshes the ignored handoff file.

## Reseed

Set the Development-only server variables, then run:

```powershell
npm run seed:demo
```

For a deterministic row reset before reseeding, also set `OOTIE_DEMO_RESET=true`. The reset only targets deterministic Demo row IDs in `OOTIE-personal-dev`; it does not delete arbitrary members or touch Production.

Required server-only variables are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OOTIE_DEMO_EMAIL`, and `OOTIE_DEMO_PASSWORD`. Never prefix the service-role key or password with `VITE_`.
