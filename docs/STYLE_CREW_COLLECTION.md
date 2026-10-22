# OOTIE Style Crew — team-curated collection

Six fictional adult styling characters illustrate office, rain, rail commute, gallery, flower market and coastal scenarios. Imagery includes East Asian, European and Black characters, varied body types, ages and poses. The built-in ImageGen tool created the six original PNGs on 2026-10-23. They are not YouCam try-on outputs or photographs of real customers.

Assets: `public/images/editorial/scene-{office,rain,train,gallery,market,coast}.png`. Original generated files were preserved. No cropping or identity inference was used.

The public UI attributes this collection to OOTIE Style Crew. Profiles explicitly identify themselves as team-curated styling characters. Their reserved `.example` authentication addresses cannot receive email; these editorial accounts are banned from sign-in, and random passwords were not distributed or committed. They are not the jury account.

`scripts/publish-style-crew.mjs` inserts six stories, six SOS styling briefs, twelve source-backed wardrobe pieces owned by the corresponding characters, twenty-four like rows, eighteen individually authored comment rows, twelve saved-outfit rows, twelve follows and twelve suggestions. Counts come from the respective rows. Suggested pieces belong to the requester and are among that SOS's selected items. No self-help entries, arbitrary numeric likes, fake purchase history, fake customer adoption or revenue are created.

Retries ignore existing relationships; they preserve visitor actions and comments. The ignored publication manifest records exact prepared IDs so the team can later review or archive only this collection. No removal was performed.

The twelve public clothing photos come from merchant catalog sources recorded in `src/data/juryWardrobeExtras.json`. Source attribution is not a redistribution license. Before final competition submission, confirm photo permissions or replace with team-owned/authorized photos.

Jury wardrobe extension is separate: `scripts/extend-jury-wardrobe.mjs` added twelve private pieces to the eight existing pieces, for twenty total, without resetting prior favorites or wear records. Prices and purchase dates remain unknown rather than invented.

Migration 030 is prepared to expose only aggregate public post counts, never saver IDs. Execution was blocked by automatic security review pending explicit owner confirmation. The current frontend falls back to existing public like/comment counts and omits unavailable save totals. It does not bypass this approval through the gateway.
