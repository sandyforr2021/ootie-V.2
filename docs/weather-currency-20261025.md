# Multilingual cities and display currency

- City lookup now uses a server-side GeoNames index (34,153 cities / 310,565
  alternative names), with Photon/OSM for smaller places and qualified queries.
- Full Taiwan city aliases including 台/臺 resolve with country code TW.
- Results include country and administrative region; same-name places remain
  separate choices. City aliases use one location regardless of UI language.
- The index is a reference snapshot, not exhaustive coverage of every village,
  spelling or historical name. Some place labels retain native/English names.
- Currency display maps zh-TW to TWD, en to USD, ja to JPY and es to EUR.
- Prices, purchase currencies and stored totals are never rewritten by changing
  languages. Cost summaries retain original-currency groups and convert each
  displayed amount using a common daily reference snapshot.
- Daily USD-based rates come from fawazahmed0/currency-api. Cross rates use
  `amount / sourceRate * targetRate`; only the displayed result is rounded.
- Converted amounts have an approximation sign, original price and dated source
  notice. A recent cache lasts at most seven days; unavailable/unsupported rates
  retain original currency. This is not a historical purchase FX or checkout quote.
- New price entry defaults to the UI currency; editing retains its saved currency.

Build: `npm run build` completed. No automated test suite was run for this change.
Read-only provider observations covered Taipei/台北/臺北, Kaohsiung/高雄,
東京/Tokio, 紐約/Nueva York/ニューヨーク/New York, Madrid and London.
Browser inspection confirmed daily rates dated 2026-10-24 and locale-sensitive
formatting of TWD 1,000 as USD 30.69, JPY 4,813 and EUR 27.39 (reference only).
