# Wardrobe purchase costs and local weather — 2026-10-23

Implemented without a paid service or additional YouCam generation.

- Purchase fields: amount, original ISO currency, optional actual purchase date.
- New entry defaults: English USD, Traditional Chinese TWD, Japanese JPY, Spanish EUR. The currency selector supports ten currencies. Editing preserves the recorded currency.
- Existing prices retain their original TWD meaning. Changing language formats numbers; it never converts or relabels the original amount.
- Migration 029 on OOTIE project `hoxkrmadzjnyjaqjbyxc` adds currency and changes integer price storage to decimal. Existing amounts were preserved; no dependent price views were found. Ownership/RLS and the drumstand project were not changed.
- Ledger groups totals by currency, counts missing prices separately, and calculates per-piece cost per wear only with a recorded amount and at least one wear. Zero-cost gifts remain different from missing prices. No exchange rates or accounting depreciation are claimed.
- Real authenticated persistence acceptance: jury-owned piece saved USD 99.95 and five wears, read back from Supabase, then restored all original values. The displayed cost per wear would be USD 19.99. Evidence remains in ignored `backups/currency-persistence.local.json`.
- Weather: manual city search lists distinct regions/countries, then uses the selected coordinates. Current model temperature, apparent temperature, daily range, rain probability, local forecast time and attribution are displayed. No GPS permission or fabricated fallback weather.
- Actual Taipei request returned temperature 23°C, apparent 24°C, daily range 23–26°C and rain probability 100% at forecast time 2026-10-23 02:15 Asia/Taipei. This is a time-specific acceptance result, not a fixed product value.
- Styling guidance is local logic based on temperature and rain, with links to actual visible wardrobe pieces. It does not submit another paid AI job.
- Provider: [Open-Meteo documentation](https://open-meteo.com/en/docs). The free endpoint is for non-commercial use; a future revenue-producing release must review the provider's [commercial terms](https://open-meteo.com/en/pricing). No subscription was started.

Statistics headings, chart labels and yearly summaries now use four-language messages. Missing wear records are described as missing records rather than never-worn facts. Lifetime wear counts are identified as lifetime totals. A complete site-wide keyboard/mobile/locale audit remains pending.
